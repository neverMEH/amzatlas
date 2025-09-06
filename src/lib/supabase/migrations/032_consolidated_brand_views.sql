-- Consolidated migration
-- Generated on: 2025-09-06T10:41:59.871Z
-- Combined from:
--   - 032_add_refresh_helper_functions.sql
--   - 032_add_refresh_helper_functions_fixed.sql
--   - 032_create_brand_dashboard_views_fixed.sql
--   - 032_recreate_asin_performance_by_brand.sql


-- ================================================================
-- Section from: 032_add_refresh_helper_functions.sql
-- ================================================================

-- Migration: 032_add_refresh_helper_functions.sql
-- Description: Add helper functions needed by edge functions for refresh operations
-- Created: 2025-09-05

-- Function to refresh materialized views (used by refresh-summary-tables)
CREATE OR REPLACE FUNCTION refresh_materialized_view(view_name TEXT)
RETURNS void AS $$
BEGIN
  -- Validate the view exists and is a materialized view
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_matviews 
    WHERE schemaname || '.' || matviewname = view_name
  ) THEN
    RAISE EXCEPTION 'Materialized view % does not exist', view_name;
  END IF;
  
  -- Execute refresh
  EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY ' || view_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION refresh_materialized_view TO service_role;

-- Function to execute SQL (used by summary table refreshes)
-- Note: This should be used carefully and only with trusted input
CREATE OR REPLACE FUNCTION execute_sql(sql TEXT)
RETURNS void AS $$
BEGIN
  -- Basic SQL injection protection
  IF sql ~* '(drop|truncate|delete|grant|revoke|alter)\s' THEN
    RAISE EXCEPTION 'Unsafe SQL operation detected';
  END IF;
  
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION execute_sql TO service_role;

-- Function to get table columns (used by generic refresh)
CREATE OR REPLACE FUNCTION get_table_columns(schema_name TEXT, table_name TEXT)
RETURNS TABLE(column_name TEXT, data_type TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::TEXT,
    c.data_type::TEXT
  FROM information_schema.columns c
  WHERE c.table_schema = schema_name
    AND c.table_name = table_name
  ORDER BY c.ordinal_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_table_columns TO service_role;

-- Function to get table row count (for monitoring)
CREATE OR REPLACE FUNCTION get_table_row_count(schema_name TEXT, table_name TEXT)
RETURNS BIGINT AS $$
DECLARE
  row_count BIGINT;
BEGIN
  EXECUTE format('SELECT COUNT(*) FROM %I.%I', schema_name, table_name) INTO row_count;
  RETURN row_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_table_row_count TO service_role;

-- Function to validate refresh completion
CREATE OR REPLACE FUNCTION validate_refresh_completion(
  p_table_schema TEXT,
  p_table_name TEXT,
  p_expected_min_rows INTEGER DEFAULT 1
)
RETURNS TABLE(
  is_valid BOOLEAN,
  row_count BIGINT,
  last_updated TIMESTAMP WITH TIME ZONE,
  message TEXT
) AS $$
DECLARE
  v_row_count BIGINT;
  v_last_updated TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get row count
  v_row_count := get_table_row_count(p_table_schema, p_table_name);
  
  -- Get last updated time (assuming updated_at column exists)
  BEGIN
    EXECUTE format(
      'SELECT MAX(updated_at) FROM %I.%I', 
      p_table_schema, 
      p_table_name
    ) INTO v_last_updated;
  EXCEPTION
    WHEN undefined_column THEN
      -- If no updated_at column, try created_at
      BEGIN
        EXECUTE format(
          'SELECT MAX(created_at) FROM %I.%I', 
          p_table_schema, 
          p_table_name
        ) INTO v_last_updated;
      EXCEPTION
        WHEN undefined_column THEN
          v_last_updated := NULL;
      END;
  END;
  
  -- Return validation result
  RETURN QUERY
  SELECT 
    v_row_count >= p_expected_min_rows AS is_valid,
    v_row_count,
    v_last_updated,
    CASE 
      WHEN v_row_count < p_expected_min_rows THEN 
        format('Table has %s rows, expected at least %s', v_row_count, p_expected_min_rows)
      WHEN v_last_updated IS NULL THEN
        'Could not determine last update time'
      WHEN v_last_updated < CURRENT_TIMESTAMP - INTERVAL '25 hours' THEN
        format('Table last updated %s, may be stale', v_last_updated)
      ELSE 
        'Validation passed'
    END AS message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION validate_refresh_completion TO service_role;

-- Add index on refresh_config for edge function queries
CREATE INDEX IF NOT EXISTS idx_refresh_config_enabled_next 
ON sqp.refresh_config(is_enabled, next_refresh_at) 
WHERE is_enabled = true;



-- ================================================================
-- Section from: 032_add_refresh_helper_functions_fixed.sql
-- ================================================================

-- Migration: 032_add_refresh_helper_functions_fixed.sql
-- Description: Add helper functions needed by edge functions for refresh operations
-- Created: 2025-09-05
-- Fixed: Handle existing functions by dropping them first

-- Drop existing functions if they exist with different signatures
DROP FUNCTION IF EXISTS get_table_columns(text, text);
DROP FUNCTION IF EXISTS get_table_row_count(text, text);
DROP FUNCTION IF EXISTS refresh_materialized_view(text);
DROP FUNCTION IF EXISTS execute_sql(text);
DROP FUNCTION IF EXISTS validate_refresh_completion(text, text, integer);

-- Function to refresh materialized views (used by refresh-summary-tables)
CREATE OR REPLACE FUNCTION refresh_materialized_view(view_name TEXT)
RETURNS void AS $$
BEGIN
  -- Validate the view exists and is a materialized view
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_matviews 
    WHERE schemaname || '.' || matviewname = view_name
  ) THEN
    RAISE EXCEPTION 'Materialized view % does not exist', view_name;
  END IF;
  
  -- Execute refresh
  EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY ' || view_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION refresh_materialized_view TO service_role;

-- Function to execute SQL (used by summary table refreshes)
-- Note: This should be used carefully and only with trusted input
CREATE OR REPLACE FUNCTION execute_sql(sql TEXT)
RETURNS void AS $$
BEGIN
  -- Basic SQL injection protection
  IF sql ~* '(drop|truncate|delete|grant|revoke|alter)\s' THEN
    RAISE EXCEPTION 'Unsafe SQL operation detected';
  END IF;
  
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION execute_sql TO service_role;

-- Function to get table columns (used by generic refresh)
CREATE FUNCTION get_table_columns(schema_name TEXT, table_name TEXT)
RETURNS TABLE(column_name TEXT, data_type TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::TEXT,
    c.data_type::TEXT
  FROM information_schema.columns c
  WHERE c.table_schema = schema_name
    AND c.table_name = table_name
  ORDER BY c.ordinal_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_table_columns TO service_role;

-- Function to get table row count (for monitoring)
CREATE FUNCTION get_table_row_count(schema_name TEXT, table_name TEXT)
RETURNS BIGINT AS $$
DECLARE
  row_count BIGINT;
BEGIN
  EXECUTE format('SELECT COUNT(*) FROM %I.%I', schema_name, table_name) INTO row_count;
  RETURN row_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_table_row_count TO service_role;

-- Function to validate refresh completion
CREATE FUNCTION validate_refresh_completion(
  p_table_schema TEXT,
  p_table_name TEXT,
  p_expected_min_rows INTEGER DEFAULT 1
)
RETURNS TABLE(
  is_valid BOOLEAN,
  row_count BIGINT,
  last_updated TIMESTAMP WITH TIME ZONE,
  message TEXT
) AS $$
DECLARE
  v_row_count BIGINT;
  v_last_updated TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get row count
  v_row_count := get_table_row_count(p_table_schema, p_table_name);
  
  -- Get last updated time (assuming updated_at column exists)
  BEGIN
    EXECUTE format(
      'SELECT MAX(updated_at) FROM %I.%I', 
      p_table_schema, 
      p_table_name
    ) INTO v_last_updated;
  EXCEPTION
    WHEN undefined_column THEN
      -- If no updated_at column, try created_at
      BEGIN
        EXECUTE format(
          'SELECT MAX(created_at) FROM %I.%I', 
          p_table_schema, 
          p_table_name
        ) INTO v_last_updated;
      EXCEPTION
        WHEN undefined_column THEN
          v_last_updated := NULL;
      END;
  END;
  
  -- Return validation result
  RETURN QUERY
  SELECT 
    v_row_count >= p_expected_min_rows AS is_valid,
    v_row_count,
    v_last_updated,
    CASE 
      WHEN v_row_count < p_expected_min_rows THEN 
        format('Table has %s rows, expected at least %s', v_row_count, p_expected_min_rows)
      WHEN v_last_updated IS NULL THEN
        'Could not determine last update time'
      WHEN v_last_updated < CURRENT_TIMESTAMP - INTERVAL '25 hours' THEN
        format('Table last updated %s, may be stale', v_last_updated)
      ELSE 
        'Validation passed'
    END AS message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION validate_refresh_completion TO service_role;

-- Add index on refresh_config for edge function queries
CREATE INDEX IF NOT EXISTS idx_refresh_config_enabled_next 
ON sqp.refresh_config(is_enabled, next_refresh_at) 
WHERE is_enabled = true;



-- ================================================================
-- Section from: 032_create_brand_dashboard_views_fixed.sql
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
    SUM(sqp_table.asin_impression_count) as impressions,
    SUM(sqp_table.asin_click_count) as clicks,
    SUM(sqp_table.asin_cart_add_count) as cart_adds,
    SUM(sqp_table.asin_purchase_count) as purchases,
    CASE WHEN SUM(sqp_table.asin_click_count) > 0 
        THEN ROUND((SUM(sqp_table.asin_purchase_count)::numeric / SUM(sqp_table.asin_click_count)::numeric) * 100, 1)
        ELSE 0 
    END as cvr,
    CASE WHEN SUM(sqp_table.asin_impression_count) > 0 
        THEN ROUND((SUM(sqp_table.asin_click_count)::numeric / SUM(sqp_table.asin_impression_count)::numeric) * 100, 1)
        ELSE 0 
    END as ctr,
    -- Calculate share metrics at query level within brand
    ROUND((SUM(sqp_table.asin_impression_count)::numeric / SUM(SUM(sqp_table.asin_impression_count)) OVER (PARTITION BY b.id) * 100), 1) as impression_share,
    ROUND((SUM(sqp_table.asin_click_count)::numeric / SUM(SUM(sqp_table.asin_click_count)) OVER (PARTITION BY b.id) * 100), 1) as ctr_share,
    ROUND((SUM(sqp_table.asin_purchase_count)::numeric / SUM(SUM(sqp_table.asin_purchase_count)) OVER (PARTITION BY b.id) * 100), 1) as cvr_share,
    ROUND((SUM(sqp_table.asin_cart_add_count)::numeric / SUM(SUM(sqp_table.asin_cart_add_count)) OVER (PARTITION BY b.id) * 100), 1) as cart_add_share,
    ROUND((SUM(sqp_table.asin_purchase_count)::numeric / SUM(SUM(sqp_table.asin_purchase_count)) OVER (PARTITION BY b.id) * 100), 1) as purchase_share
FROM sqp.brands b
JOIN sqp.asin_brand_mapping abm ON b.id = abm.brand_id
JOIN sqp.asin_performance_data apd ON abm.asin = apd.asin
JOIN sqp.search_query_performance sqp_table ON apd.id = sqp_table.asin_performance_id
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



-- ================================================================
-- Section from: 032_recreate_asin_performance_by_brand.sql
-- ================================================================

-- Migration: Recreate asin_performance_by_brand view
-- This should be run AFTER migration 031 which fixes the ASIN column length

-- This view aggregates ASIN performance metrics by brand
-- It uses pattern matching to associate ASINs with brands based on product titles

CREATE OR REPLACE VIEW public.asin_performance_by_brand AS
WITH asin_brand_mapping AS (
  -- Map ASINs to brands using the brand matching RPC function
  SELECT DISTINCT
    apd.asin,
    apd.product_title,
    b.id as brand_id,
    b.brand_name
  FROM sqp.asin_performance_data apd
  CROSS JOIN LATERAL (
    SELECT * FROM sqp.match_brand_for_asin(apd.asin)
  ) b
  WHERE b.id IS NOT NULL
),
performance_aggregates AS (
  -- Aggregate performance metrics by ASIN
  SELECT 
    apd.asin,
    MAX(apd.product_title) as product_title,
    SUM(sqp.asin_impression_count) as total_impressions,
    SUM(sqp.asin_click_count) as total_clicks,
    SUM(sqp.asin_cart_add_count) as total_cart_adds,
    SUM(sqp.asin_purchase_count) as total_purchases,
    AVG(sqp.asin_impression_share) as avg_impression_share,
    AVG(sqp.asin_click_share) as avg_click_share,
    AVG(sqp.asin_cart_add_share) as avg_cart_add_share,
    AVG(sqp.asin_purchase_share) as avg_purchase_share
  FROM sqp.asin_performance_data apd
  LEFT JOIN sqp.search_query_performance sqp 
    ON apd.id = sqp.asin_performance_id
  GROUP BY apd.asin
)
SELECT 
  abm.brand_id,
  abm.brand_name,
  pa.asin,
  pa.product_title,
  COALESCE(pa.total_impressions, 0) as impressions,
  COALESCE(pa.total_clicks, 0) as clicks,
  COALESCE(pa.total_cart_adds, 0) as cart_adds,
  COALESCE(pa.total_purchases, 0) as purchases,
  -- Calculate click-through rate
  CASE 
    WHEN pa.total_impressions > 0 
    THEN ROUND((pa.total_clicks::NUMERIC / pa.total_impressions) * 100, 1)
    ELSE 0 
  END as click_through_rate,
  -- Calculate conversion rate
  CASE 
    WHEN pa.total_clicks > 0 
    THEN ROUND((pa.total_purchases::NUMERIC / pa.total_clicks) * 100, 1)
    ELSE 0 
  END as conversion_rate,
  -- Share metrics
  ROUND(COALESCE(pa.avg_impression_share, 0)::NUMERIC, 5) as impression_share,
  ROUND(COALESCE(pa.avg_click_share, 0)::NUMERIC, 5) as ctr_share,
  ROUND(COALESCE(pa.avg_purchase_share, 0)::NUMERIC, 5) as cvr_share,
  ROUND(COALESCE(pa.avg_cart_add_share, 0)::NUMERIC, 5) as cart_add_share,
  ROUND(COALESCE(pa.avg_purchase_share, 0)::NUMERIC, 5) as purchase_share
FROM asin_brand_mapping abm
JOIN performance_aggregates pa ON abm.asin = pa.asin
ORDER BY abm.brand_name, pa.total_impressions DESC;

-- Grant permissions
GRANT SELECT ON public.asin_performance_by_brand TO authenticated;
GRANT SELECT ON public.asin_performance_by_brand TO anon;
GRANT SELECT ON public.asin_performance_by_brand TO service_role;

-- Add comment
COMMENT ON VIEW public.asin_performance_by_brand IS 'Aggregates ASIN performance metrics grouped by brand, using automatic brand matching based on product titles';
