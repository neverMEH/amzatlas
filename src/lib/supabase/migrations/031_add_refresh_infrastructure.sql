-- Migration: 031_add_refresh_infrastructure.sql
-- Description: Add infrastructure for automated daily BigQuery refresh
-- Created: 2025-09-05

-- Create refresh configuration table
CREATE TABLE IF NOT EXISTS sqp.refresh_config (
    id SERIAL PRIMARY KEY,
    table_schema TEXT NOT NULL,
    table_name TEXT NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    refresh_frequency_hours INTEGER DEFAULT 24,
    priority INTEGER DEFAULT 100,
    last_refresh_at TIMESTAMP WITH TIME ZONE,
    next_refresh_at TIMESTAMP WITH TIME ZONE,
    custom_sync_params JSONB DEFAULT '{}',
    dependencies TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(table_schema, table_name)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_refresh_config_next_refresh 
ON sqp.refresh_config(next_refresh_at) 
WHERE is_enabled = true;

CREATE INDEX IF NOT EXISTS idx_refresh_config_priority 
ON sqp.refresh_config(priority DESC) 
WHERE is_enabled = true;

-- Create refresh audit log table
CREATE TABLE IF NOT EXISTS sqp.refresh_audit_log (
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

-- Create indexes for audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_status_time 
ON sqp.refresh_audit_log(status, refresh_started_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_table 
ON sqp.refresh_audit_log(table_schema, table_name, refresh_started_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_config_id 
ON sqp.refresh_audit_log(refresh_config_id, refresh_started_at DESC);

-- Create refresh dependencies table
CREATE TABLE IF NOT EXISTS sqp.refresh_dependencies (
    id SERIAL PRIMARY KEY,
    parent_config_id INTEGER REFERENCES sqp.refresh_config(id) ON DELETE CASCADE,
    dependent_config_id INTEGER REFERENCES sqp.refresh_config(id) ON DELETE CASCADE,
    dependency_type TEXT DEFAULT 'hard' CHECK (dependency_type IN ('hard', 'soft')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(parent_config_id, dependent_config_id)
);

-- Create indexes for dependencies
CREATE INDEX IF NOT EXISTS idx_dependencies_parent 
ON sqp.refresh_dependencies(parent_config_id);

CREATE INDEX IF NOT EXISTS idx_dependencies_dependent 
ON sqp.refresh_dependencies(dependent_config_id);

-- Create data quality metrics table
CREATE TABLE IF NOT EXISTS sqp.refresh_data_quality (
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

-- Create indexes for data quality
CREATE INDEX IF NOT EXISTS idx_quality_audit_id 
ON sqp.refresh_data_quality(audit_log_id);

CREATE INDEX IF NOT EXISTS idx_quality_threshold 
ON sqp.refresh_data_quality(is_within_threshold, created_at DESC);

-- Create refresh checkpoints table for edge function resumption
CREATE TABLE IF NOT EXISTS sqp.refresh_checkpoints (
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
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 hour')
);

-- Create partial unique index for active checkpoints
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkpoints_unique_active 
ON sqp.refresh_checkpoints(function_name, table_schema, table_name, status) 
WHERE status = 'active';

-- Create indexes for checkpoints
CREATE INDEX IF NOT EXISTS idx_checkpoints_active 
ON sqp.refresh_checkpoints(function_name, status) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_checkpoints_expired 
ON sqp.refresh_checkpoints(expires_at) 
WHERE status = 'active';

-- Create function to clean up expired checkpoints
CREATE OR REPLACE FUNCTION sqp.cleanup_expired_checkpoints()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE sqp.refresh_checkpoints 
    SET status = 'expired' 
    WHERE status = 'active' 
    AND expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Create auto-registration function for new tables
CREATE OR REPLACE FUNCTION sqp.auto_register_table_for_refresh()
RETURNS event_trigger AS $$
DECLARE
    obj record;
    table_name_only text;
BEGIN
    FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands()
    LOOP
        IF obj.command_tag IN ('CREATE TABLE', 'CREATE TABLE AS') 
           AND obj.schema_name = 'sqp' 
           AND obj.object_type = 'table' THEN
            
            -- Extract table name from fully qualified name
            table_name_only := split_part(obj.object_identity, '.', 2);
            
            -- Remove quotes if present
            table_name_only := replace(table_name_only, '"', '');
            
            INSERT INTO sqp.refresh_config (
                table_schema,
                table_name,
                is_enabled,
                refresh_frequency_hours,
                priority,
                next_refresh_at
            ) VALUES (
                obj.schema_name,
                table_name_only,
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

-- Create event trigger for auto-registration
DROP EVENT TRIGGER IF EXISTS auto_register_refresh_tables;
CREATE EVENT TRIGGER auto_register_refresh_tables
ON ddl_command_end
WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS')
EXECUTE FUNCTION sqp.auto_register_table_for_refresh();

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION sqp.update_refresh_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for timestamp updates
DROP TRIGGER IF EXISTS update_refresh_config_timestamp ON sqp.refresh_config;
CREATE TRIGGER update_refresh_config_timestamp
BEFORE UPDATE ON sqp.refresh_config
FOR EACH ROW
EXECUTE FUNCTION sqp.update_refresh_config_timestamp();

-- Helper functions for testing
CREATE OR REPLACE FUNCTION get_table_columns(schema_name text, table_name text)
RETURNS TABLE(column_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT c.column_name::text
  FROM information_schema.columns c
  WHERE c.table_schema = schema_name
  AND c.table_name = table_name;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_table_indexes(schema_name text, table_name text)
RETURNS TABLE(index_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT i.indexname::text
  FROM pg_indexes i
  WHERE i.schemaname = schema_name
  AND i.tablename = table_name;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION execute_sql(sql text)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Populate initial refresh configurations
INSERT INTO sqp.refresh_config (table_schema, table_name, priority, next_refresh_at) 
VALUES
    ('sqp', 'asin_performance_data', 90, CURRENT_TIMESTAMP + INTERVAL '1 hour'),
    ('sqp', 'search_query_performance', 85, CURRENT_TIMESTAMP + INTERVAL '1 hour'),
    ('sqp', 'search_performance_summary', 80, CURRENT_TIMESTAMP + INTERVAL '1 hour'),
    ('sqp', 'daily_sqp_data', 75, CURRENT_TIMESTAMP + INTERVAL '1 hour'),
    ('sqp', 'weekly_summary', 80, CURRENT_TIMESTAMP + INTERVAL '1 hour'),
    ('sqp', 'monthly_summary', 80, CURRENT_TIMESTAMP + INTERVAL '1 hour'),
    ('sqp', 'quarterly_summary', 80, CURRENT_TIMESTAMP + INTERVAL '1 hour'),
    ('sqp', 'yearly_summary', 80, CURRENT_TIMESTAMP + INTERVAL '1 hour')
ON CONFLICT (table_schema, table_name) DO NOTHING;

-- Set up table dependencies
WITH config_ids AS (
    SELECT 
        id,
        table_name
    FROM sqp.refresh_config
    WHERE table_schema = 'sqp'
)
INSERT INTO sqp.refresh_dependencies (parent_config_id, dependent_config_id)
SELECT 
    p.id as parent_config_id,
    d.id as dependent_config_id
FROM config_ids p
CROSS JOIN config_ids d
WHERE 
    -- asin_performance_data dependencies
    (p.table_name = 'asin_performance_data' 
     AND d.table_name IN ('search_performance_summary', 'weekly_summary', 'monthly_summary'))
    -- search_query_performance dependencies
    OR (p.table_name = 'search_query_performance' 
        AND d.table_name = 'search_performance_summary')
    -- summary table dependencies
    OR (p.table_name = 'weekly_summary' 
        AND d.table_name IN ('monthly_summary', 'quarterly_summary'))
    OR (p.table_name = 'monthly_summary' 
        AND d.table_name IN ('quarterly_summary', 'yearly_summary'))
    OR (p.table_name = 'quarterly_summary' 
        AND d.table_name = 'yearly_summary')
ON CONFLICT DO NOTHING;

-- Create monitoring views
CREATE OR REPLACE VIEW sqp.refresh_status_overview AS
SELECT 
    rc.table_schema,
    rc.table_name,
    rc.is_enabled,
    rc.priority,
    rc.last_refresh_at,
    rc.next_refresh_at,
    la.status as last_status,
    la.rows_processed as last_rows_processed,
    la.execution_time_ms as last_execution_time_ms,
    la.error_message as last_error
FROM sqp.refresh_config rc
LEFT JOIN LATERAL (
    SELECT *
    FROM sqp.refresh_audit_log al
    WHERE al.table_schema = rc.table_schema
    AND al.table_name = rc.table_name
    ORDER BY al.refresh_started_at DESC
    LIMIT 1
) la ON true
ORDER BY rc.priority DESC, rc.table_name;

-- Grant appropriate permissions
GRANT SELECT ON sqp.refresh_status_overview TO authenticated;
GRANT ALL ON sqp.refresh_config TO service_role;
GRANT ALL ON sqp.refresh_audit_log TO service_role;
GRANT ALL ON sqp.refresh_dependencies TO service_role;
GRANT ALL ON sqp.refresh_data_quality TO service_role;
GRANT ALL ON sqp.refresh_checkpoints TO service_role;

-- Grant sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sqp TO service_role;