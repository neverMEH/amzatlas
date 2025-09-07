-- Migration 048: Clean up refresh infrastructure to monitor correct tables
-- Purpose: Remove dead table monitoring, add critical pipeline tables
-- Based on: Refresh Infrastructure Analysis (Sep 6, 2025)
-- Note: Handles foreign key constraints properly

BEGIN;

-- Create backup of current refresh_config before changes
CREATE TABLE IF NOT EXISTS sqp.refresh_config_backup_pre_048 AS 
SELECT * FROM sqp.refresh_config;

-- Step 1: Handle foreign key constraints before deletion
-- First, update any audit log entries to null out the foreign key reference
UPDATE sqp.refresh_audit_log 
SET refresh_config_id = NULL
WHERE refresh_config_id IN (
    SELECT id FROM sqp.refresh_config 
    WHERE table_name IN (
        'webhook_configs',
        'webhook_deliveries',
        'monthly_summary',
        'quarterly_summary', 
        'weekly_summary',
        'yearly_summary',
        'daily_sqp_data',
        'search_performance_summary'
    )
);

-- Also remove any dependencies for tables we're deleting
DELETE FROM sqp.refresh_dependencies
WHERE parent_config_id IN (
    SELECT id FROM sqp.refresh_config 
    WHERE table_name IN (
        'webhook_configs',
        'webhook_deliveries',
        'monthly_summary',
        'quarterly_summary', 
        'weekly_summary',
        'yearly_summary',
        'daily_sqp_data',
        'search_performance_summary'
    )
) OR dependent_config_id IN (
    SELECT id FROM sqp.refresh_config 
    WHERE table_name IN (
        'webhook_configs',
        'webhook_deliveries',
        'monthly_summary',
        'quarterly_summary', 
        'weekly_summary',
        'yearly_summary',
        'daily_sqp_data',
        'search_performance_summary'
    )
);

-- Now safe to remove obsolete and never-refreshed tables from monitoring
DELETE FROM sqp.refresh_config 
WHERE table_name IN (
    -- Webhook tables (never refreshed, minimal activity)
    'webhook_configs',
    'webhook_deliveries',
    
    -- Summary tables that are never refreshed (likely materialized views)
    'monthly_summary',
    'quarterly_summary', 
    'weekly_summary',
    'yearly_summary',
    'daily_sqp_data',
    
    -- Search performance summary (has data but not actively refreshed)
    'search_performance_summary'
);

-- Step 2: Update priorities for existing core tables
UPDATE sqp.refresh_config 
SET priority = 95, refresh_frequency_hours = 12
WHERE table_name = 'search_query_performance';

UPDATE sqp.refresh_config
SET priority = 90, refresh_frequency_hours = 24  
WHERE table_name = 'asin_performance_data';

-- Step 3: Add critical pipeline monitoring tables
INSERT INTO sqp.refresh_config (
    table_schema, 
    table_name, 
    is_enabled, 
    refresh_frequency_hours, 
    priority, 
    next_refresh_at,
    custom_sync_params,
    dependencies
) VALUES 
-- Highest priority: Pipeline health monitoring
(
    'sqp', 
    'sync_log', 
    true, 
    6,  -- Monitor every 6 hours for pipeline health
    99, -- Highest priority
    NOW() + INTERVAL '6 hours',
    '{"monitor_type": "pipeline_health", "alert_on_failure": true}',
    ARRAY[]::text[]
),

-- High priority: Data quality validation  
(
    'sqp',
    'data_quality_checks',
    true,
    8,  -- Monitor every 8 hours
    95, -- Very high priority  
    NOW() + INTERVAL '8 hours',
    '{"monitor_type": "data_quality", "alert_on_threshold": true}',
    ARRAY['sync_log']
),

-- Core business intelligence tables
(
    'sqp',
    'brands', 
    true,
    24, -- Daily monitoring sufficient
    80,
    NOW() + INTERVAL '24 hours', 
    '{"monitor_type": "business_data"}',
    ARRAY[]::text[]
),

(
    'sqp',
    'asin_brand_mapping',
    true, 
    24, -- Daily monitoring sufficient
    78,
    NOW() + INTERVAL '24 hours',
    '{"monitor_type": "business_data"}',
    ARRAY['brands']
),

(
    'sqp',
    'product_type_mapping',
    true,
    48, -- Every 2 days (stable data)
    75,
    NOW() + INTERVAL '48 hours',
    '{"monitor_type": "reference_data"}', 
    ARRAY[]::text[]
);

-- Step 4: Update refresh dependencies for proper cascade monitoring
DELETE FROM sqp.refresh_dependencies;

INSERT INTO sqp.refresh_dependencies (parent_config_id, dependent_config_id, dependency_type)
SELECT 
    p.id as parent_config_id,
    d.id as dependent_config_id,
    'hard' as dependency_type
FROM sqp.refresh_config p
CROSS JOIN sqp.refresh_config d  
WHERE (p.table_name = 'sync_log' AND d.table_name IN ('data_quality_checks', 'asin_performance_data', 'search_query_performance'))
   OR (p.table_name = 'brands' AND d.table_name = 'asin_brand_mapping');

-- Step 5: Create monitoring views for the refresh monitor UI

-- View: Current pipeline health based on sync_log
CREATE OR REPLACE VIEW sqp.pipeline_health AS
SELECT 
    'BigQuery Sync Pipeline' as component,
    CASE 
        WHEN MAX(sl.started_at) > NOW() - INTERVAL '24 hours' 
             AND COUNT(CASE WHEN sl.sync_status = 'completed' THEN 1 END) > 0
        THEN 'healthy'
        WHEN MAX(sl.started_at) > NOW() - INTERVAL '48 hours'
        THEN 'warning' 
        ELSE 'critical'
    END as status,
    COUNT(CASE WHEN sl.sync_status = 'completed' THEN 1 END) as successful_syncs_24h,
    COUNT(CASE WHEN sl.sync_status = 'failed' THEN 1 END) as failed_syncs_24h,
    MAX(sl.started_at) as last_sync_time,
    SUM(sl.records_processed) as total_records_processed_24h
FROM sqp.sync_log sl
WHERE sl.started_at > NOW() - INTERVAL '24 hours';

-- View: Data freshness summary for core tables  
CREATE OR REPLACE VIEW sqp.data_freshness_summary AS
SELECT 
    rc.table_name,
    rc.table_schema,
    rc.priority,
    rc.last_refresh_at,
    rc.next_refresh_at,
    CASE 
        WHEN rc.last_refresh_at IS NULL THEN 'never_refreshed'
        WHEN rc.last_refresh_at < NOW() - INTERVAL '48 hours' THEN 'stale'
        WHEN rc.last_refresh_at < NOW() - INTERVAL '24 hours' THEN 'aging'
        ELSE 'fresh'
    END as freshness_status,
    EXTRACT(HOUR FROM (NOW() - rc.last_refresh_at)) as hours_since_refresh,
    -- Get actual table row counts for validation
    CASE 
        WHEN rc.table_name = 'sync_log' THEN (SELECT COUNT(*) FROM sqp.sync_log)
        WHEN rc.table_name = 'data_quality_checks' THEN (SELECT COUNT(*) FROM sqp.data_quality_checks)  
        WHEN rc.table_name = 'asin_performance_data' THEN (SELECT COUNT(*) FROM sqp.asin_performance_data)
        WHEN rc.table_name = 'search_query_performance' THEN (SELECT COUNT(*) FROM sqp.search_query_performance)
        WHEN rc.table_name = 'brands' THEN (SELECT COUNT(*) FROM sqp.brands)
        WHEN rc.table_name = 'asin_brand_mapping' THEN (SELECT COUNT(*) FROM sqp.asin_brand_mapping) 
        WHEN rc.table_name = 'product_type_mapping' THEN (SELECT COUNT(*) FROM sqp.product_type_mapping)
        ELSE 0
    END as current_row_count
FROM sqp.refresh_config rc
WHERE rc.is_enabled = true
ORDER BY rc.priority DESC, rc.table_name;

-- Step 6: Update audit log with migration info
INSERT INTO sqp.refresh_audit_log (
    refresh_config_id,
    table_schema, 
    table_name,
    refresh_started_at,
    refresh_completed_at,
    status,
    rows_processed,
    execution_time_ms,
    sync_metadata
) VALUES (
    NULL, -- No specific config ID for migration
    'sqp',
    'refresh_config', 
    NOW(),
    NOW(),
    'success',
    (SELECT COUNT(*) FROM sqp.refresh_config), -- New count after cleanup
    0,
    jsonb_build_object(
        'migration', '048_cleanup_refresh_infrastructure',
        'action', 'infrastructure_cleanup',
        'removed_tables', ARRAY[
            'webhook_configs', 'webhook_deliveries', 
            'monthly_summary', 'quarterly_summary', 
            'weekly_summary', 'yearly_summary', 
            'daily_sqp_data', 'search_performance_summary'
        ],
        'added_tables', ARRAY[
            'sync_log', 'data_quality_checks', 
            'brands', 'asin_brand_mapping', 'product_type_mapping'
        ]
    )
);

-- Step 7: Grant necessary permissions for monitoring views
GRANT SELECT ON sqp.pipeline_health TO anon, authenticated;
GRANT SELECT ON sqp.data_freshness_summary TO anon, authenticated;

-- Create public schema aliases for API access
CREATE OR REPLACE VIEW public.pipeline_health AS SELECT * FROM sqp.pipeline_health;
CREATE OR REPLACE VIEW public.data_freshness_summary AS SELECT * FROM sqp.data_freshness_summary;

GRANT SELECT ON public.pipeline_health TO anon, authenticated;
GRANT SELECT ON public.data_freshness_summary TO anon, authenticated;

COMMIT;

-- Verification queries (commented out for safety)
/*
-- Verify cleanup results:
SELECT 'After cleanup:' as status, COUNT(*) as refresh_config_count FROM sqp.refresh_config;
SELECT 'Tables now monitored:' as info, table_name, priority, refresh_frequency_hours 
FROM sqp.refresh_config ORDER BY priority DESC;
SELECT 'Pipeline health:' as info, * FROM sqp.pipeline_health;
SELECT 'Data freshness:' as info, table_name, freshness_status, hours_since_refresh 
FROM sqp.data_freshness_summary ORDER BY priority DESC;
*/