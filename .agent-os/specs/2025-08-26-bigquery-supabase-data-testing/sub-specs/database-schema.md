# Database Schema

This is the database schema implementation for the spec detailed in @.agent-os/specs/2025-08-26-bigquery-supabase-data-testing/spec.md

> Created: 2025-08-26
> Version: 1.0.0

## Schema Changes

### New Table: data_test_runs

```sql
CREATE TABLE sqp.data_test_runs (
    id BIGSERIAL PRIMARY KEY,
    test_name VARCHAR(255) NOT NULL,
    test_type VARCHAR(100) NOT NULL, -- 'sampling_strategy', 'data_quality', 'performance'
    run_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'running', -- 'running', 'completed', 'failed'
    bigquery_dataset VARCHAR(100) NOT NULL,
    supabase_table VARCHAR(100) NOT NULL,
    test_config JSONB NOT NULL, -- Stores sampling parameters, filters, etc.
    execution_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Rationale**: Central table to track all data testing runs with metadata. JSONB config allows flexible storage of different test parameters without schema changes.

### New Table: asin_sampling_results

```sql
CREATE TABLE sqp.asin_sampling_results (
    id BIGSERIAL PRIMARY KEY,
    test_run_id BIGINT REFERENCES sqp.data_test_runs(id) ON DELETE CASCADE,
    sampling_strategy VARCHAR(100) NOT NULL, -- 'random', 'stratified', 'systematic'
    sample_size INTEGER NOT NULL,
    total_population INTEGER NOT NULL,
    sampling_parameters JSONB, -- Strategy-specific parameters
    sampled_asins TEXT[], -- Array of ASINs in sample
    distribution_metrics JSONB, -- Category distribution, price ranges, etc.
    quality_score DECIMAL(5,4), -- 0.0000 to 1.0000
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Rationale**: Stores results from different ASIN sampling strategies to enable comparison and analysis of sampling effectiveness.

### New Table: data_quality_metrics

```sql
CREATE TABLE sqp.data_quality_metrics (
    id BIGSERIAL PRIMARY KEY,
    test_run_id BIGINT REFERENCES sqp.data_test_runs(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL, -- 'completeness', 'accuracy', 'consistency'
    metric_value DECIMAL(10,6) NOT NULL,
    metric_details JSONB, -- Detailed breakdown of the metric
    field_name VARCHAR(100), -- Specific field being measured (optional)
    threshold_passed BOOLEAN NOT NULL,
    threshold_value DECIMAL(10,6),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Rationale**: Granular storage of data quality metrics allows for detailed analysis and trend tracking over time.

### New Table: performance_benchmarks

```sql
CREATE TABLE sqp.performance_benchmarks (
    id BIGSERIAL PRIMARY KEY,
    test_run_id BIGINT REFERENCES sqp.data_test_runs(id) ON DELETE CASCADE,
    operation_type VARCHAR(100) NOT NULL, -- 'bigquery_query', 'supabase_insert', 'data_sync'
    operation_name VARCHAR(255) NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    rows_processed INTEGER,
    memory_usage_mb INTEGER,
    cost_estimate DECIMAL(10,6), -- For BigQuery operations
    optimization_suggestions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Rationale**: Tracks performance metrics to identify bottlenecks and optimization opportunities in data pipeline operations.

## Indexes

### Primary Performance Indexes

```sql
-- Efficient querying of test runs by type and status
CREATE INDEX idx_data_test_runs_type_status ON sqp.data_test_runs(test_type, status);

-- Time-based queries for recent test runs
CREATE INDEX idx_data_test_runs_timestamp ON sqp.data_test_runs(run_timestamp DESC);

-- Fast lookup of sampling results by strategy
CREATE INDEX idx_asin_sampling_strategy ON sqp.asin_sampling_results(sampling_strategy, sample_size);

-- Quality metrics analysis by metric type
CREATE INDEX idx_data_quality_metrics_name ON sqp.data_quality_metrics(metric_name, threshold_passed);

-- Performance benchmarks by operation type
CREATE INDEX idx_performance_benchmarks_operation ON sqp.performance_benchmarks(operation_type, operation_name);

-- Composite index for test run relationships
CREATE INDEX idx_sampling_results_test_run ON sqp.asin_sampling_results(test_run_id, created_at DESC);
CREATE INDEX idx_quality_metrics_test_run ON sqp.data_quality_metrics(test_run_id, metric_name);
CREATE INDEX idx_performance_benchmarks_test_run ON sqp.performance_benchmarks(test_run_id, operation_type);
```

**Performance Considerations**: 
- Indexes are designed to support common query patterns for test analysis
- Composite indexes optimize foreign key joins with filtering
- Descending timestamp indexes support recent-first queries

### JSONB Indexes

```sql
-- GIN indexes for JSONB columns to enable efficient querying
CREATE INDEX idx_test_runs_config_gin ON sqp.data_test_runs USING GIN (test_config);
CREATE INDEX idx_sampling_params_gin ON sqp.asin_sampling_results USING GIN (sampling_parameters);
CREATE INDEX idx_distribution_metrics_gin ON sqp.asin_sampling_results USING GIN (distribution_metrics);
CREATE INDEX idx_quality_details_gin ON sqp.data_quality_metrics USING GIN (metric_details);
```

**Rationale**: GIN indexes enable fast searches within JSONB fields for flexible configuration and metrics querying.

## Views

### View: asin_distribution_analysis

```sql
CREATE VIEW sqp.asin_distribution_analysis AS
SELECT 
    sr.sampling_strategy,
    sr.sample_size,
    AVG(sr.quality_score) as avg_quality_score,
    COUNT(*) as total_samples,
    AVG(sr.total_population) as avg_population,
    AVG(CARDINALITY(sr.sampled_asins)) as avg_sample_count,
    MIN(tr.run_timestamp) as first_run,
    MAX(tr.run_timestamp) as latest_run
FROM sqp.asin_sampling_results sr
JOIN sqp.data_test_runs tr ON sr.test_run_id = tr.id
WHERE tr.status = 'completed'
GROUP BY sr.sampling_strategy, sr.sample_size
ORDER BY sr.sampling_strategy, sr.sample_size;
```

**Rationale**: Provides aggregated analysis of ASIN sampling effectiveness across different strategies and sample sizes.

### View: data_quality_trends

```sql
CREATE VIEW sqp.data_quality_trends AS
SELECT 
    DATE_TRUNC('day', tr.run_timestamp) as test_date,
    dqm.metric_name,
    AVG(dqm.metric_value) as avg_metric_value,
    MIN(dqm.metric_value) as min_metric_value,
    MAX(dqm.metric_value) as max_metric_value,
    COUNT(*) as measurement_count,
    ROUND(
        (COUNT(*) FILTER (WHERE dqm.threshold_passed = true)::DECIMAL / COUNT(*)) * 100, 
        2
    ) as pass_rate_percent
FROM sqp.data_quality_metrics dqm
JOIN sqp.data_test_runs tr ON dqm.test_run_id = tr.id
WHERE tr.status = 'completed'
GROUP BY DATE_TRUNC('day', tr.run_timestamp), dqm.metric_name
ORDER BY test_date DESC, dqm.metric_name;
```

**Rationale**: Tracks data quality trends over time to identify degradation or improvement patterns.

### View: performance_summary

```sql
CREATE VIEW sqp.performance_summary AS
SELECT 
    pb.operation_type,
    pb.operation_name,
    AVG(pb.execution_time_ms) as avg_execution_time_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pb.execution_time_ms) as median_execution_time_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY pb.execution_time_ms) as p95_execution_time_ms,
    AVG(pb.rows_processed) as avg_rows_processed,
    AVG(pb.memory_usage_mb) as avg_memory_usage_mb,
    SUM(pb.cost_estimate) as total_cost_estimate,
    COUNT(*) as execution_count,
    MAX(tr.run_timestamp) as latest_run
FROM sqp.performance_benchmarks pb
JOIN sqp.data_test_runs tr ON pb.test_run_id = tr.id
WHERE tr.status = 'completed'
GROUP BY pb.operation_type, pb.operation_name
ORDER BY avg_execution_time_ms DESC;
```

**Rationale**: Aggregated performance metrics to identify slow operations and track performance improvements over time.

## Stored Procedures

### Procedure: cleanup_old_test_data

```sql
CREATE OR REPLACE FUNCTION sqp.cleanup_old_test_data(
    retention_days INTEGER DEFAULT 30
) RETURNS TABLE(
    deleted_test_runs INTEGER,
    deleted_sampling_results INTEGER,
    deleted_quality_metrics INTEGER,
    deleted_performance_benchmarks INTEGER
) AS $$
DECLARE
    cutoff_date TIMESTAMP WITH TIME ZONE;
    test_runs_deleted INTEGER;
    sampling_deleted INTEGER;
    quality_deleted INTEGER;
    performance_deleted INTEGER;
BEGIN
    -- Calculate cutoff date
    cutoff_date := NOW() - (retention_days || ' days')::INTERVAL;
    
    -- Delete old records (cascading deletes will handle related tables)
    WITH deleted_runs AS (
        DELETE FROM sqp.data_test_runs 
        WHERE run_timestamp < cutoff_date 
        AND status IN ('completed', 'failed')
        RETURNING id
    )
    SELECT COUNT(*) INTO test_runs_deleted FROM deleted_runs;
    
    -- Get counts of related deleted records
    GET DIAGNOSTICS 
        sampling_deleted = ROW_COUNT;
    
    -- Return summary
    RETURN QUERY SELECT 
        test_runs_deleted,
        0, -- sampling results deleted via cascade
        0, -- quality metrics deleted via cascade  
        0; -- performance benchmarks deleted via cascade
END;
$$ LANGUAGE plpgsql;
```

**Rationale**: Automated cleanup procedure to prevent unbounded growth of test data while preserving recent results for analysis.

### Procedure: get_test_run_summary

```sql
CREATE OR REPLACE FUNCTION sqp.get_test_run_summary(
    test_run_id_param BIGINT
) RETURNS TABLE(
    test_run_info JSONB,
    sampling_summary JSONB,
    quality_summary JSONB,
    performance_summary JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        -- Test run basic info
        to_jsonb(tr.*) as test_run_info,
        
        -- Sampling results summary
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'strategy', sampling_strategy,
                    'sample_size', sample_size,
                    'quality_score', quality_score,
                    'distribution_metrics', distribution_metrics
                )
            ) FROM sqp.asin_sampling_results WHERE test_run_id = test_run_id_param),
            '[]'::jsonb
        ) as sampling_summary,
        
        -- Quality metrics summary
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'metric_name', metric_name,
                    'metric_value', metric_value,
                    'threshold_passed', threshold_passed,
                    'field_name', field_name
                )
            ) FROM sqp.data_quality_metrics WHERE test_run_id = test_run_id_param),
            '[]'::jsonb
        ) as quality_summary,
        
        -- Performance summary
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'operation_type', operation_type,
                    'operation_name', operation_name,
                    'execution_time_ms', execution_time_ms,
                    'rows_processed', rows_processed,
                    'cost_estimate', cost_estimate
                )
            ) FROM sqp.performance_benchmarks WHERE test_run_id = test_run_id_param),
            '[]'::jsonb
        ) as performance_summary
        
    FROM sqp.data_test_runs tr
    WHERE tr.id = test_run_id_param;
END;
$$ LANGUAGE plpgsql;
```

**Rationale**: Convenience function to retrieve comprehensive test run data in a single call, reducing application complexity.

## Migrations

### Migration Order

1. **Create base tables** - Execute table creation statements in dependency order
2. **Create indexes** - Add performance indexes after tables are created
3. **Create views** - Build analytical views after base schema is established  
4. **Create procedures** - Add stored procedures for data management

### Migration Script Template

```sql
-- Migration: Add data testing schema
-- Version: 1.0.0
-- Date: 2025-08-26

BEGIN;

-- Create tables
\i create_data_test_tables.sql

-- Create indexes  
\i create_data_test_indexes.sql

-- Create views
\i create_data_test_views.sql

-- Create procedures
\i create_data_test_procedures.sql

-- Verify schema
SELECT 'Migration completed successfully' as status;

COMMIT;
```

**Performance Considerations**:
- Tables use BIGSERIAL for primary keys to handle large volumes
- JSONB columns provide flexibility while maintaining query performance
- Cascading deletes ensure referential integrity
- Indexes are optimized for expected query patterns
- Views provide pre-aggregated data for common analytics queries