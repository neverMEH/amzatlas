-- Consolidated migration
-- Generated on: 2025-09-06T10:41:59.868Z
-- Combined from:
--   - 031_fix_asin_column_final_safe.sql
--   - 031_add_keyword_analysis_functions.sql
--   - 031_add_refresh_infrastructure.sql
--   - 031_create_brand_dashboard_views.sql


-- ================================================================
-- Section from: 031_fix_asin_column_final_safe.sql
-- ================================================================

-- Migration: Fix ASIN column length constraint (Final Safe Version)
-- This version checks each object type individually before dropping

-- Step 1: Report on all objects we need to handle
DO $$
DECLARE
  obj RECORD;
BEGIN
  RAISE NOTICE '=== Checking all relevant objects ===';
  
  FOR obj IN
    SELECT 
      n.nspname as schema_name,
      c.relname as object_name,
      CASE c.relkind 
        WHEN 'r' THEN 'TABLE'
        WHEN 'v' THEN 'VIEW'
        WHEN 'm' THEN 'MATERIALIZED VIEW'
      END as object_type
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname IN (
      'search_query_performance', 
      'search_performance_summary',
      'asin_performance_data',
      'asin_performance_by_brand',
      'brand_search_query_metrics'
    )
    AND n.nspname IN ('public', 'sqp')
    ORDER BY n.nspname, c.relname
  LOOP
    RAISE NOTICE '  %.%: %', obj.schema_name, obj.object_name, obj.object_type;
  END LOOP;
END $$;

-- Step 2: Drop each object based on its actual type
DO $$
BEGIN
  -- Handle search_performance_summary (check if view or materialized view)
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
    AND c.relname = 'search_performance_summary'
    AND c.relkind = 'v'
  ) THEN
    DROP VIEW public.search_performance_summary CASCADE;
    RAISE NOTICE 'Dropped VIEW public.search_performance_summary';
  ELSIF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
    AND c.relname = 'search_performance_summary'
    AND c.relkind = 'm'
  ) THEN
    DROP MATERIALIZED VIEW public.search_performance_summary CASCADE;
    RAISE NOTICE 'Dropped MATERIALIZED VIEW public.search_performance_summary';
  END IF;
  
  -- Handle asin_performance_by_brand
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
    AND c.relname = 'asin_performance_by_brand'
    AND c.relkind = 'v'
  ) THEN
    DROP VIEW public.asin_performance_by_brand CASCADE;
    RAISE NOTICE 'Dropped VIEW public.asin_performance_by_brand';
  END IF;
  
  -- Handle asin_performance_data
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
    AND c.relname = 'asin_performance_data'
    AND c.relkind = 'v'
  ) THEN
    DROP VIEW public.asin_performance_data CASCADE;
    RAISE NOTICE 'Dropped VIEW public.asin_performance_data';
  END IF;
  
  -- Handle search_query_performance (only if it's a view)
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
    AND c.relname = 'search_query_performance'
    AND c.relkind = 'v'
  ) THEN
    DROP VIEW public.search_query_performance CASCADE;
    RAISE NOTICE 'Dropped VIEW public.search_query_performance';
  END IF;
  
  -- Handle brand_search_query_metrics
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'sqp' 
    AND c.relname = 'brand_search_query_metrics'
    AND c.relkind = 'm'
  ) THEN
    DROP MATERIALIZED VIEW sqp.brand_search_query_metrics CASCADE;
    RAISE NOTICE 'Dropped MATERIALIZED VIEW sqp.brand_search_query_metrics';
  END IF;
END $$;

-- Step 3: Alter the ASIN columns in tables
ALTER TABLE sqp.asin_performance_data 
ALTER COLUMN asin TYPE VARCHAR(20);

RAISE NOTICE 'Altered ASIN column in sqp.asin_performance_data to VARCHAR(20)';

-- Update other tables that have ASIN columns
DO $$
BEGIN
  -- Update search_query_performance if it has an asin column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sqp' 
    AND table_name = 'search_query_performance' 
    AND column_name = 'asin'
  ) THEN
    ALTER TABLE sqp.search_query_performance 
    ALTER COLUMN asin TYPE VARCHAR(20);
    RAISE NOTICE 'Altered ASIN column in sqp.search_query_performance to VARCHAR(20)';
  END IF;
  
  -- Update daily_sqp_data if it exists and has an asin column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sqp' 
    AND table_name = 'daily_sqp_data' 
    AND column_name = 'asin'
  ) THEN
    ALTER TABLE sqp.daily_sqp_data 
    ALTER COLUMN asin TYPE VARCHAR(20);
    RAISE NOTICE 'Altered ASIN column in sqp.daily_sqp_data to VARCHAR(20)';
  END IF;
  
  -- Update brands table if it has asin column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sqp' 
    AND table_name = 'brands' 
    AND column_name = 'asin'
  ) THEN
    ALTER TABLE sqp.brands 
    ALTER COLUMN asin TYPE VARCHAR(20);
    RAISE NOTICE 'Altered ASIN column in sqp.brands to VARCHAR(20)';
  END IF;
  
  -- Check for any tables in public schema with asin columns
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND column_name = 'asin'
    AND table_name IN (
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    )
  ) THEN
    FOR rec IN 
      SELECT table_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND column_name = 'asin'
      AND table_name IN (
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      )
    LOOP
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN asin TYPE VARCHAR(20)', rec.table_name);
      RAISE NOTICE 'Altered ASIN column in public.% to VARCHAR(20)', rec.table_name;
    END LOOP;
  END IF;
END $$;

-- Step 4: Recreate the basic asin_performance_data view
CREATE VIEW public.asin_performance_data AS
SELECT 
  id,
  start_date,
  end_date,
  asin,
  created_at,
  updated_at,
  product_title
FROM sqp.asin_performance_data;

GRANT SELECT ON public.asin_performance_data TO authenticated;
GRANT SELECT ON public.asin_performance_data TO anon;
GRANT SELECT ON public.asin_performance_data TO service_role;

RAISE NOTICE 'Created VIEW public.asin_performance_data';

-- Step 5: Recreate search_performance_summary view
CREATE VIEW public.search_performance_summary AS
WITH performance_data AS (
  SELECT 
    apd.asin,
    apd.start_date,
    apd.end_date,
    apd.product_title,
    sqp.search_query,
    sqp.search_query_score,
    sqp.search_query_volume,
    sqp.asin_impression_count,
    sqp.asin_click_count,
    sqp.asin_cart_add_count,
    sqp.asin_purchase_count,
    sqp.asin_impression_share,
    sqp.asin_click_share,
    sqp.asin_cart_add_share,
    sqp.asin_purchase_share
  FROM sqp.asin_performance_data apd
  LEFT JOIN sqp.search_query_performance sqp 
    ON apd.id = sqp.asin_performance_id
)
SELECT * FROM performance_data
WHERE search_query IS NOT NULL;

GRANT SELECT ON public.search_performance_summary TO authenticated;
GRANT SELECT ON public.search_performance_summary TO anon;
GRANT SELECT ON public.search_performance_summary TO service_role;

RAISE NOTICE 'Created VIEW public.search_performance_summary';

-- Step 6: Recreate public.search_query_performance if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'search_query_performance'
  ) THEN
    CREATE VIEW public.search_query_performance AS
    SELECT * FROM sqp.search_query_performance;
    
    GRANT SELECT ON public.search_query_performance TO authenticated;
    GRANT SELECT ON public.search_query_performance TO anon;
    GRANT SELECT ON public.search_query_performance TO service_role;
    
    RAISE NOTICE 'Created VIEW public.search_query_performance';
  END IF;
END $$;

-- Add documentation
COMMENT ON COLUMN sqp.asin_performance_data.asin IS 'Amazon Standard Identification Number - increased to VARCHAR(20) to handle longer ASINs';

-- Final status report
DO $$
DECLARE
  obj RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Migration Complete - Final Status ===';
  
  -- Check ASIN column lengths
  FOR obj IN
    SELECT 
      table_schema,
      table_name,
      character_maximum_length
    FROM information_schema.columns
    WHERE column_name = 'asin'
      AND table_schema IN ('sqp', 'public')
    ORDER BY table_schema, table_name
  LOOP
    RAISE NOTICE 'ASIN column in %.%: VARCHAR(%)', 
      obj.table_schema, obj.table_name, obj.character_maximum_length;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Run migration 032 to recreate asin_performance_by_brand view';
  RAISE NOTICE '2. Run migration 033 to recreate brand_search_query_metrics materialized view';
END $$;



-- ================================================================
-- Section from: 031_add_keyword_analysis_functions.sql
-- ================================================================

-- Migration: Add keyword analysis RPC functions
-- Description: Functions for keyword performance analysis
-- Created: 2025-08-30

-- Function to get keyword funnel totals
CREATE OR REPLACE FUNCTION sqp.get_keyword_funnel_totals(
  p_asin TEXT,
  p_keyword TEXT,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  impressions BIGINT,
  clicks BIGINT,
  cart_adds BIGINT,
  purchases BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(sqp.impressions), 0)::BIGINT as impressions,
    COALESCE(SUM(sqp.clicks), 0)::BIGINT as clicks,
    COALESCE(SUM(sqp.cart_adds), 0)::BIGINT as cart_adds,
    COALESCE(SUM(sqp.purchases), 0)::BIGINT as purchases
  FROM sqp.search_query_performance sqp
  WHERE sqp.asin = p_asin
    AND sqp.search_query = p_keyword
    AND sqp.start_date >= p_start_date
    AND sqp.start_date <= p_end_date;
END;
$$;

-- Function to get keyword market share across all ASINs
CREATE OR REPLACE FUNCTION sqp.get_keyword_market_share(
  p_keyword TEXT,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  asin TEXT,
  brand TEXT,
  title TEXT,
  impressions BIGINT,
  clicks BIGINT,
  purchases BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sqp.asin,
    apd.brand,
    apd.product_title as title,
    COALESCE(SUM(sqp.impressions), 0)::BIGINT as impressions,
    COALESCE(SUM(sqp.clicks), 0)::BIGINT as clicks,
    COALESCE(SUM(sqp.purchases), 0)::BIGINT as purchases
  FROM sqp.search_query_performance sqp
  LEFT JOIN sqp.asin_performance_data apd 
    ON sqp.asin = apd.asin 
    AND sqp.start_date = apd.start_date
  WHERE sqp.search_query = p_keyword
    AND sqp.start_date >= p_start_date
    AND sqp.start_date <= p_end_date
  GROUP BY sqp.asin, apd.brand, apd.product_title
  ORDER BY impressions DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION sqp.get_keyword_funnel_totals TO authenticated;
GRANT EXECUTE ON FUNCTION sqp.get_keyword_market_share TO authenticated;

-- Function to get funnel totals for multiple keywords
CREATE OR REPLACE FUNCTION sqp.get_multiple_keyword_funnels(
  p_asin TEXT,
  p_keywords TEXT[],
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  search_query TEXT,
  impressions BIGINT,
  clicks BIGINT,
  cart_adds BIGINT,
  purchases BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sqp.search_query,
    COALESCE(SUM(sqp.impressions), 0)::BIGINT as impressions,
    COALESCE(SUM(sqp.clicks), 0)::BIGINT as clicks,
    COALESCE(SUM(sqp.cart_adds), 0)::BIGINT as cart_adds,
    COALESCE(SUM(sqp.purchases), 0)::BIGINT as purchases
  FROM sqp.search_query_performance sqp
  WHERE sqp.asin = p_asin
    AND sqp.search_query = ANY(p_keywords)
    AND sqp.start_date >= p_start_date
    AND sqp.start_date <= p_end_date
  GROUP BY sqp.search_query;
END;
$$;

-- Function to get impression shares for keywords
CREATE OR REPLACE FUNCTION sqp.get_keyword_impression_shares(
  p_asin TEXT,
  p_keywords TEXT[],
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  search_query TEXT,
  impression_share NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH keyword_totals AS (
    SELECT 
      search_query,
      SUM(impressions) as keyword_impressions
    FROM sqp.search_query_performance
    WHERE search_query = ANY(p_keywords)
      AND start_date >= p_start_date
      AND start_date <= p_end_date
    GROUP BY search_query
  ),
  asin_totals AS (
    SELECT 
      search_query,
      SUM(impressions) as asin_impressions
    FROM sqp.search_query_performance
    WHERE asin = p_asin
      AND search_query = ANY(p_keywords)
      AND start_date >= p_start_date
      AND start_date <= p_end_date
    GROUP BY search_query
  )
  SELECT 
    kt.search_query,
    CASE 
      WHEN kt.keyword_impressions > 0 
      THEN ROUND((at.asin_impressions::numeric / kt.keyword_impressions::numeric), 4)
      ELSE 0
    END as impression_share
  FROM keyword_totals kt
  LEFT JOIN asin_totals at ON kt.search_query = at.search_query
  ORDER BY kt.search_query;
END;
$$;

-- Grant execute permissions for new functions
GRANT EXECUTE ON FUNCTION sqp.get_multiple_keyword_funnels TO authenticated;
GRANT EXECUTE ON FUNCTION sqp.get_keyword_impression_shares TO authenticated;

-- Create indexes to optimize these queries
CREATE INDEX IF NOT EXISTS idx_search_query_performance_keyword_date 
ON sqp.search_query_performance(search_query, start_date);

CREATE INDEX IF NOT EXISTS idx_search_query_performance_asin_keyword_date 
ON sqp.search_query_performance(asin, search_query, start_date);



-- ================================================================
-- Section from: 031_add_refresh_infrastructure.sql
-- ================================================================

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



-- ================================================================
-- Section from: 031_create_brand_dashboard_views.sql
-- ================================================================

-- Create materialized view for ASIN share metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.asin_share_metrics AS
WITH market_totals AS (
    SELECT 
        start_date,
        end_date,
        SUM(impressions) as total_market_impressions,
        SUM(clicks) as total_market_clicks,
        SUM(cart_adds) as total_market_cart_adds,
        SUM(purchases) as total_market_purchases
    FROM public.search_performance_summary
    GROUP BY start_date, end_date
),
asin_metrics AS (
    SELECT 
        sps.asin,
        sps.start_date,
        sps.end_date,
        SUM(sps.impressions) as asin_impressions,
        SUM(sps.clicks) as asin_clicks,
        SUM(sps.cart_adds) as asin_cart_adds,
        SUM(sps.purchases) as asin_purchases,
        CASE WHEN SUM(sps.clicks) > 0 
            THEN (SUM(sps.purchases)::numeric / SUM(sps.clicks)::numeric) * 100
            ELSE 0 
        END as asin_cvr,
        CASE WHEN SUM(sps.impressions) > 0 
            THEN (SUM(sps.clicks)::numeric / SUM(sps.impressions)::numeric) * 100
            ELSE 0 
        END as asin_ctr
    FROM public.search_performance_summary sps
    GROUP BY sps.asin, sps.start_date, sps.end_date
)
SELECT 
    am.asin,
    am.start_date,
    am.end_date,
    am.asin_impressions,
    am.asin_clicks,
    am.asin_cart_adds,
    am.asin_purchases,
    am.asin_cvr,
    am.asin_ctr,
    -- Share calculations
    ROUND((am.asin_impressions::numeric / NULLIF(mt.total_market_impressions, 0) * 100), 1) as impression_share,
    ROUND((am.asin_clicks::numeric / NULLIF(mt.total_market_clicks, 0) * 100), 1) as ctr_share,
    ROUND((am.asin_purchases::numeric / NULLIF(mt.total_market_purchases, 0) * 100), 1) as cvr_share,
    ROUND((am.asin_cart_adds::numeric / NULLIF(mt.total_market_cart_adds, 0) * 100), 1) as cart_add_share,
    ROUND((am.asin_purchases::numeric / NULLIF(mt.total_market_purchases, 0) * 100), 1) as purchase_share
FROM asin_metrics am
JOIN market_totals mt ON am.start_date = mt.start_date AND am.end_date = mt.end_date;

-- Create index for performance
CREATE INDEX idx_asin_share_metrics_asin_date ON sqp.asin_share_metrics(asin, start_date, end_date);

-- Create view for ASIN performance by brand with share metrics
CREATE OR REPLACE VIEW public.asin_performance_by_brand AS
SELECT 
    b.id as brand_id,
    b.display_name as brand_name,
    apd.asin,
    apd.product_title,
    -- Current period metrics (aggregated from all dates)
    COALESCE(SUM(asm.asin_impressions), 0) as impressions,
    COALESCE(SUM(asm.asin_clicks), 0) as clicks,
    COALESCE(SUM(asm.asin_cart_adds), 0) as cart_adds,
    COALESCE(SUM(asm.asin_purchases), 0) as purchases,
    -- Calculate rates
    CASE WHEN SUM(asm.asin_impressions) > 0 
        THEN ROUND((SUM(asm.asin_clicks)::numeric / SUM(asm.asin_impressions)::numeric) * 100, 1)
        ELSE 0 
    END as click_through_rate,
    CASE WHEN SUM(asm.asin_clicks) > 0 
        THEN ROUND((SUM(asm.asin_purchases)::numeric / SUM(asm.asin_clicks)::numeric) * 100, 1)
        ELSE 0 
    END as conversion_rate,
    -- Average share metrics
    COALESCE(AVG(asm.impression_share), 0) as impression_share,
    COALESCE(AVG(asm.ctr_share), 0) as ctr_share,
    COALESCE(AVG(asm.cvr_share), 0) as cvr_share,
    COALESCE(AVG(asm.cart_add_share), 0) as cart_add_share,
    COALESCE(AVG(asm.purchase_share), 0) as purchase_share
FROM sqp.brands b
JOIN sqp.asin_brand_mapping abm ON b.id = abm.brand_id
JOIN sqp.asin_performance_data apd ON abm.asin = apd.asin
LEFT JOIN sqp.asin_share_metrics asm ON apd.asin = asm.asin
GROUP BY b.id, b.display_name, apd.asin, apd.product_title;

-- Create materialized view for brand search query metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.brand_search_query_metrics AS
SELECT 
    b.id as brand_id,
    sqp_table.search_query,
    SUM(sqp_table.impressions) as impressions,
    SUM(sqp_table.clicks) as clicks,
    SUM(sqp_table.cart_adds) as cart_adds,
    SUM(sqp_table.purchases) as purchases,
    CASE WHEN SUM(sqp_table.clicks) > 0 
        THEN ROUND((SUM(sqp_table.purchases)::numeric / SUM(sqp_table.clicks)::numeric) * 100, 1)
        ELSE 0 
    END as cvr,
    CASE WHEN SUM(sqp_table.impressions) > 0 
        THEN ROUND((SUM(sqp_table.clicks)::numeric / SUM(sqp_table.impressions)::numeric) * 100, 1)
        ELSE 0 
    END as ctr,
    -- Calculate share metrics at query level within brand
    ROUND((SUM(sqp_table.impressions)::numeric / SUM(SUM(sqp_table.impressions)) OVER (PARTITION BY b.id) * 100), 1) as impression_share,
    ROUND((SUM(sqp_table.clicks)::numeric / SUM(SUM(sqp_table.clicks)) OVER (PARTITION BY b.id) * 100), 1) as ctr_share,
    ROUND((SUM(sqp_table.purchases)::numeric / SUM(SUM(sqp_table.purchases)) OVER (PARTITION BY b.id) * 100), 1) as cvr_share,
    ROUND((SUM(sqp_table.cart_adds)::numeric / SUM(SUM(sqp_table.cart_adds)) OVER (PARTITION BY b.id) * 100), 1) as cart_add_share,
    ROUND((SUM(sqp_table.purchases)::numeric / SUM(SUM(sqp_table.purchases)) OVER (PARTITION BY b.id) * 100), 1) as purchase_share
FROM sqp.brands b
JOIN sqp.asin_brand_mapping abm ON b.id = abm.brand_id
JOIN sqp.search_query_performance sqp_table ON abm.asin = sqp_table.asin
GROUP BY b.id, sqp_table.search_query;

-- Create index for performance
CREATE INDEX idx_brand_search_query_metrics_brand_id ON sqp.brand_search_query_metrics(brand_id);

-- Grant permissions
GRANT SELECT ON sqp.asin_share_metrics TO authenticated;
GRANT SELECT ON public.asin_performance_by_brand TO authenticated;
GRANT SELECT ON sqp.brand_search_query_metrics TO authenticated;

-- Refresh materialized views
REFRESH MATERIALIZED VIEW sqp.asin_share_metrics;
REFRESH MATERIALIZED VIEW sqp.brand_search_query_metrics;
