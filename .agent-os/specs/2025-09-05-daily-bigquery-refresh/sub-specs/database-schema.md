# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-09-05-daily-bigquery-refresh/spec.md

> Created: 2025-09-05
> Version: 1.0.0

## Schema Changes

### New Tables

#### 1. Refresh Configuration Table
```sql
CREATE TABLE sqp.refresh_config (
    id SERIAL PRIMARY KEY,
    table_schema TEXT NOT NULL,
    table_name TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    refresh_frequency_hours INTEGER DEFAULT 24,
    priority INTEGER DEFAULT 100,
    last_refresh_at TIMESTAMP WITH TIME ZONE,
    next_refresh_at TIMESTAMP WITH TIME ZONE,
    custom_sync_params JSONB DEFAULT '{}',
    dependencies TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(table_schema, table_name)
);

CREATE INDEX idx_refresh_config_next_refresh ON sqp.refresh_config(next_refresh_at) WHERE is_enabled = true;
CREATE INDEX idx_refresh_config_priority ON sqp.refresh_config(priority DESC) WHERE is_enabled = true;
```

#### 2. Refresh Audit Log Table
```sql
CREATE TABLE sqp.refresh_audit_log (
    id SERIAL PRIMARY KEY,
    refresh_config_id INTEGER REFERENCES sqp.refresh_config(id),
    table_schema TEXT NOT NULL,
    table_name TEXT NOT NULL,
    refresh_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    refresh_completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT CHECK (status IN ('running', 'success', 'failed', 'warning')),
    rows_processed INTEGER,
    rows_inserted INTEGER,
    rows_updated INTEGER,
    rows_deleted INTEGER,
    execution_time_ms INTEGER,
    memory_used_mb DECIMAL(10,2),
    error_message TEXT,
    error_details JSONB,
    bigquery_job_id TEXT,
    sync_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_status_time ON sqp.refresh_audit_log(status, refresh_started_at DESC);
CREATE INDEX idx_audit_log_table ON sqp.refresh_audit_log(table_schema, table_name, refresh_started_at DESC);
CREATE INDEX idx_audit_log_config_id ON sqp.refresh_audit_log(refresh_config_id, refresh_started_at DESC);
```

#### 3. Refresh Dependencies Table
```sql
CREATE TABLE sqp.refresh_dependencies (
    id SERIAL PRIMARY KEY,
    parent_config_id INTEGER REFERENCES sqp.refresh_config(id) ON DELETE CASCADE,
    dependent_config_id INTEGER REFERENCES sqp.refresh_config(id) ON DELETE CASCADE,
    dependency_type TEXT DEFAULT 'hard' CHECK (dependency_type IN ('hard', 'soft')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(parent_config_id, dependent_config_id)
);

CREATE INDEX idx_dependencies_parent ON sqp.refresh_dependencies(parent_config_id);
CREATE INDEX idx_dependencies_dependent ON sqp.refresh_dependencies(dependent_config_id);
```

#### 4. Data Quality Metrics Table
```sql
CREATE TABLE sqp.refresh_data_quality (
    id SERIAL PRIMARY KEY,
    audit_log_id INTEGER REFERENCES sqp.refresh_audit_log(id),
    metric_name TEXT NOT NULL,
    metric_value DECIMAL,
    expected_value DECIMAL,
    threshold_min DECIMAL,
    threshold_max DECIMAL,
    is_within_threshold BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quality_audit_id ON sqp.refresh_data_quality(audit_log_id);
CREATE INDEX idx_quality_threshold ON sqp.refresh_data_quality(is_within_threshold, created_at DESC);
```

#### 5. Refresh Checkpoints Table (For Edge Function Resumption)
```sql
CREATE TABLE sqp.refresh_checkpoints (
    id SERIAL PRIMARY KEY,
    function_name TEXT NOT NULL,
    table_schema TEXT NOT NULL,
    table_name TEXT NOT NULL,
    checkpoint_data JSONB NOT NULL,
    last_processed_row BIGINT,
    total_rows BIGINT,
    status TEXT CHECK (status IN ('active', 'completed', 'expired')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 hour'),
    UNIQUE(function_name, table_schema, table_name, status) WHERE status = 'active'
);

CREATE INDEX idx_checkpoints_active ON sqp.refresh_checkpoints(function_name, status) WHERE status = 'active';
CREATE INDEX idx_checkpoints_expired ON sqp.refresh_checkpoints(expires_at) WHERE status = 'active';

-- Cleanup trigger for expired checkpoints
CREATE OR REPLACE FUNCTION sqp.cleanup_expired_checkpoints()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sqp.refresh_checkpoints 
    SET status = 'expired' 
    WHERE status = 'active' 
    AND expires_at < CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Functions and Triggers

#### Auto-registration Trigger for New Tables
```sql
CREATE OR REPLACE FUNCTION sqp.auto_register_table_for_refresh()
RETURNS event_trigger AS $$
DECLARE
    obj record;
BEGIN
    FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands()
    LOOP
        IF obj.command_tag IN ('CREATE TABLE', 'CREATE TABLE AS') 
           AND obj.schema_name = 'sqp' 
           AND obj.object_type = 'table' THEN
            
            INSERT INTO sqp.refresh_config (
                table_schema,
                table_name,
                is_enabled,
                refresh_frequency_hours,
                priority,
                next_refresh_at
            ) VALUES (
                obj.schema_name,
                obj.object_identity::regclass::text,
                true,
                24,
                100,
                CURRENT_TIMESTAMP + INTERVAL '24 hours'
            )
            ON CONFLICT (table_schema, table_name) DO NOTHING;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE EVENT TRIGGER auto_register_refresh_tables
ON ddl_command_end
WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS')
EXECUTE FUNCTION sqp.auto_register_table_for_refresh();
```

#### Update Timestamp Trigger
```sql
CREATE OR REPLACE FUNCTION sqp.update_refresh_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_refresh_config_timestamp
BEFORE UPDATE ON sqp.refresh_config
FOR EACH ROW
EXECUTE FUNCTION sqp.update_refresh_config_timestamp();
```

### Initial Data Population

```sql
-- Register existing tables for refresh
INSERT INTO sqp.refresh_config (table_schema, table_name, priority, next_refresh_at) 
SELECT 
    'sqp' as table_schema,
    tablename as table_name,
    CASE 
        WHEN tablename LIKE '%_data' THEN 90  -- Higher priority for data tables
        WHEN tablename LIKE '%summary%' THEN 80  -- Medium priority for summaries
        ELSE 70  -- Lower priority for others
    END as priority,
    CURRENT_TIMESTAMP + INTERVAL '1 hour' as next_refresh_at
FROM pg_tables 
WHERE schemaname = 'sqp'
AND tablename IN (
    'asin_performance_data',
    'search_query_performance',
    'search_performance_summary',
    'daily_sqp_data',
    'weekly_summary',
    'monthly_summary',
    'quarterly_summary',
    'yearly_summary'
)
ON CONFLICT (table_schema, table_name) DO NOTHING;

-- Set up dependencies
INSERT INTO sqp.refresh_dependencies (parent_config_id, dependent_config_id)
SELECT 
    p.id as parent_config_id,
    d.id as dependent_config_id
FROM sqp.refresh_config p
CROSS JOIN sqp.refresh_config d
WHERE p.table_name = 'asin_performance_data'
AND d.table_name IN ('search_performance_summary', 'weekly_summary', 'monthly_summary')
ON CONFLICT DO NOTHING;
```

## Migrations

### Migration Order
This schema should be implemented as a new migration file in the sequence:
- `031_create_daily_refresh_system.sql`

### Dependencies
- Requires existing `sqp` schema
- Should run after all current SQP data tables are created
- Compatible with existing sync system

### Performance Considerations
- Indexes on `next_refresh_at` and `priority` enable efficient job queue processing
- Partitioning `refresh_audit_log` by month could be added for long-term scalability
- JSONB columns provide flexibility for custom parameters without schema changes

### Data Integrity
- Foreign key constraints ensure referential integrity between configuration and logs
- Check constraints validate status values and dependency types
- Unique constraints prevent duplicate configurations

### Operational Benefits
- Event trigger automatically registers new tables, eliminating manual configuration
- Dependency tracking ensures correct refresh order
- Audit trail provides complete visibility into refresh operations
- Data quality metrics enable proactive monitoring