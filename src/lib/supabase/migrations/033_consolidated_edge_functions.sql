-- Consolidated migration
-- Generated on: 2025-09-06T10:41:59.873Z
-- Combined from:
--   - 033_create_daily_brand_metrics_view.sql
--   - 033_create_minimal_public_views.sql
--   - 033_create_public_brand_query_view.sql
--   - 033_create_public_views_for_edge_functions.sql
--   - 033_create_public_views_for_edge_functions_current.sql
--   - 033_create_public_views_for_edge_functions_fixed.sql
--   - 033_recreate_brand_search_query_metrics.sql


-- ================================================================
-- Section from: 033_create_daily_brand_metrics_view.sql
-- ================================================================

-- Create a view that generates daily metrics from weekly data for brand sparklines
-- This view interpolates daily values from weekly totals for smooth sparkline visualization

CREATE OR REPLACE VIEW public.brand_daily_metrics AS
WITH daily_series AS (
  -- Generate a series of dates covering our data range
  SELECT generate_series(
    (SELECT MIN(start_date) FROM public.search_performance_summary),
    (SELECT MAX(end_date) FROM public.search_performance_summary),
    '1 day'::interval
  )::date AS date
),
brand_weekly_metrics AS (
  -- Aggregate weekly metrics by brand
  SELECT 
    abm.brand_id,
    sps.start_date,
    sps.end_date,
    SUM(sps.impressions) AS weekly_impressions,
    SUM(sps.clicks) AS weekly_clicks,
    SUM(sps.cart_adds) AS weekly_cart_adds,
    SUM(sps.purchases) AS weekly_purchases
  FROM public.search_performance_summary sps
  JOIN sqp.asin_brand_mapping abm ON sps.asin = abm.asin
  GROUP BY abm.brand_id, sps.start_date, sps.end_date
),
daily_interpolated AS (
  -- Distribute weekly totals evenly across days
  SELECT 
    bwm.brand_id,
    ds.date,
    -- Divide weekly totals by 7 to get average daily values
    ROUND(bwm.weekly_impressions::numeric / 7) AS impressions,
    ROUND(bwm.weekly_clicks::numeric / 7) AS clicks,
    ROUND(bwm.weekly_cart_adds::numeric / 7) AS cart_adds,
    ROUND(bwm.weekly_purchases::numeric / 7) AS purchases
  FROM daily_series ds
  JOIN brand_weekly_metrics bwm 
    ON ds.date >= bwm.start_date 
    AND ds.date <= bwm.end_date
)
SELECT 
  brand_id,
  date,
  impressions::integer,
  clicks::integer,
  cart_adds::integer,
  purchases::integer
FROM daily_interpolated
ORDER BY brand_id, date;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_brand_daily_metrics_brand_date 
  ON public.search_performance_summary(asin, start_date, end_date);

-- Grant permissions
GRANT SELECT ON public.brand_daily_metrics TO authenticated;

-- Add comment
COMMENT ON VIEW public.brand_daily_metrics IS 
  'Daily brand metrics interpolated from weekly data for sparkline visualization';



-- ================================================================
-- Section from: 033_create_minimal_public_views.sql
-- ================================================================

-- Migration: 033_create_minimal_public_views.sql
-- Description: Create minimal public schema views for edge functions
-- Created: 2025-09-05

-- Only create views for the essential refresh infrastructure tables
-- These should exist from migration 031

-- Infrastructure tables only
CREATE OR REPLACE VIEW public.refresh_config AS
SELECT * FROM sqp.refresh_config;

CREATE OR REPLACE VIEW public.refresh_audit_log AS
SELECT * FROM sqp.refresh_audit_log;

CREATE OR REPLACE VIEW public.refresh_checkpoints AS
SELECT * FROM sqp.refresh_checkpoints;

-- Grant permissions to service role
GRANT ALL ON public.refresh_config TO service_role;
GRANT ALL ON public.refresh_audit_log TO service_role;
GRANT ALL ON public.refresh_checkpoints TO service_role;

-- Also grant read permissions to authenticated role
GRANT SELECT ON public.refresh_config TO authenticated;
GRANT SELECT ON public.refresh_audit_log TO authenticated;
GRANT SELECT ON public.refresh_checkpoints TO authenticated;



-- ================================================================
-- Section from: 033_create_public_brand_query_view.sql
-- ================================================================

-- Migration: Create public view for brand search query metrics
-- Description: Expose brand search query metrics to public schema for API access

-- Create public view for brand search query metrics
CREATE OR REPLACE VIEW public.brand_search_query_metrics AS
SELECT * FROM sqp.brand_search_query_metrics;

-- Grant permissions
GRANT SELECT ON public.brand_search_query_metrics TO authenticated;
GRANT SELECT ON public.brand_search_query_metrics TO anon;

-- Create index on materialized view if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'sqp' 
        AND tablename = 'brand_search_query_metrics' 
        AND indexname = 'idx_brand_search_query_metrics'
    ) THEN
        CREATE INDEX idx_brand_search_query_metrics 
        ON sqp.brand_search_query_metrics(brand_id, impressions DESC);
    END IF;
END
$$;

-- Refresh the materialized view to ensure it has data
REFRESH MATERIALIZED VIEW sqp.brand_search_query_metrics;



-- ================================================================
-- Section from: 033_create_public_views_for_edge_functions.sql
-- ================================================================

-- Migration: 033_create_public_views_for_edge_functions.sql
-- Description: Create public schema views for edge functions to access sqp tables
-- Created: 2025-09-05

-- Create views in public schema that point to sqp tables
CREATE OR REPLACE VIEW public.refresh_config AS
SELECT * FROM sqp.refresh_config;

CREATE OR REPLACE VIEW public.refresh_audit_log AS
SELECT * FROM sqp.refresh_audit_log;

CREATE OR REPLACE VIEW public.refresh_checkpoints AS
SELECT * FROM sqp.refresh_checkpoints;

CREATE OR REPLACE VIEW public.asin_performance_data AS
SELECT * FROM sqp.asin_performance_data;

CREATE OR REPLACE VIEW public.search_query_performance AS
SELECT * FROM sqp.search_query_performance;

CREATE OR REPLACE VIEW public.daily_sqp_data AS
SELECT * FROM sqp.daily_sqp_data;

CREATE OR REPLACE VIEW public.weekly_summary AS
SELECT * FROM sqp.weekly_summary;

CREATE OR REPLACE VIEW public.monthly_summary AS
SELECT * FROM sqp.monthly_summary;

CREATE OR REPLACE VIEW public.quarterly_summary AS
SELECT * FROM sqp.quarterly_summary;

CREATE OR REPLACE VIEW public.yearly_summary AS
SELECT * FROM sqp.yearly_summary;

-- Grant permissions to service role
GRANT ALL ON public.refresh_config TO service_role;
GRANT ALL ON public.refresh_audit_log TO service_role;
GRANT ALL ON public.refresh_checkpoints TO service_role;
GRANT ALL ON public.asin_performance_data TO service_role;
GRANT ALL ON public.search_query_performance TO service_role;
GRANT ALL ON public.daily_sqp_data TO service_role;
GRANT ALL ON public.weekly_summary TO service_role;
GRANT ALL ON public.monthly_summary TO service_role;
GRANT ALL ON public.quarterly_summary TO service_role;
GRANT ALL ON public.yearly_summary TO service_role;



-- ================================================================
-- Section from: 033_create_public_views_for_edge_functions_current.sql
-- ================================================================

-- Migration: 033_create_public_views_for_edge_functions_current.sql
-- Description: Create public schema views for edge functions to access sqp tables
-- Created: 2025-09-05

-- Create views in public schema that point to sqp tables
-- Only includes current, non-deprecated tables

-- Infrastructure tables (from migration 031)
CREATE OR REPLACE VIEW public.refresh_config AS
SELECT * FROM sqp.refresh_config;

CREATE OR REPLACE VIEW public.refresh_audit_log AS
SELECT * FROM sqp.refresh_audit_log;

CREATE OR REPLACE VIEW public.refresh_checkpoints AS
SELECT * FROM sqp.refresh_checkpoints;

-- Main data tables (from migration 013)
CREATE OR REPLACE VIEW public.asin_performance_data AS
SELECT * FROM sqp.asin_performance_data;

CREATE OR REPLACE VIEW public.search_query_performance AS
SELECT * FROM sqp.search_query_performance;

-- Summary tables (from migration 001)
CREATE OR REPLACE VIEW public.weekly_summary AS
SELECT * FROM sqp.weekly_summary;

CREATE OR REPLACE VIEW public.monthly_summary AS
SELECT * FROM sqp.monthly_summary;

CREATE OR REPLACE VIEW public.quarterly_summary AS
SELECT * FROM sqp.quarterly_summary;

CREATE OR REPLACE VIEW public.yearly_summary AS
SELECT * FROM sqp.yearly_summary;

-- Grant permissions to service role
GRANT ALL ON public.refresh_config TO service_role;
GRANT ALL ON public.refresh_audit_log TO service_role;
GRANT ALL ON public.refresh_checkpoints TO service_role;
GRANT ALL ON public.asin_performance_data TO service_role;
GRANT ALL ON public.search_query_performance TO service_role;
GRANT ALL ON public.weekly_summary TO service_role;
GRANT ALL ON public.monthly_summary TO service_role;
GRANT ALL ON public.quarterly_summary TO service_role;
GRANT ALL ON public.yearly_summary TO service_role;

-- Also grant permissions to authenticated role for reading
GRANT SELECT ON public.refresh_config TO authenticated;
GRANT SELECT ON public.refresh_audit_log TO authenticated;
GRANT SELECT ON public.asin_performance_data TO authenticated;
GRANT SELECT ON public.search_query_performance TO authenticated;
GRANT SELECT ON public.weekly_summary TO authenticated;
GRANT SELECT ON public.monthly_summary TO authenticated;
GRANT SELECT ON public.quarterly_summary TO authenticated;
GRANT SELECT ON public.yearly_summary TO authenticated;



-- ================================================================
-- Section from: 033_create_public_views_for_edge_functions_fixed.sql
-- ================================================================

-- Migration: 033_create_public_views_for_edge_functions_fixed.sql
-- Description: Create public schema views for edge functions to access sqp tables
-- Created: 2025-09-05

-- Create views in public schema that point to sqp tables
-- Only create views for tables that exist

-- Infrastructure tables (from migration 031)
CREATE OR REPLACE VIEW public.refresh_config AS
SELECT * FROM sqp.refresh_config;

CREATE OR REPLACE VIEW public.refresh_audit_log AS
SELECT * FROM sqp.refresh_audit_log;

CREATE OR REPLACE VIEW public.refresh_checkpoints AS
SELECT * FROM sqp.refresh_checkpoints;

-- Main data tables (from migration 013)
CREATE OR REPLACE VIEW public.asin_performance_data AS
SELECT * FROM sqp.asin_performance_data;

CREATE OR REPLACE VIEW public.search_query_performance AS
SELECT * FROM sqp.search_query_performance;

-- Daily data table (from migration 011)
CREATE OR REPLACE VIEW public.daily_sqp_data AS
SELECT * FROM sqp.daily_sqp_data;

-- Summary tables (from migration 001)
CREATE OR REPLACE VIEW public.weekly_summary AS
SELECT * FROM sqp.weekly_summary;

CREATE OR REPLACE VIEW public.monthly_summary AS
SELECT * FROM sqp.monthly_summary;

CREATE OR REPLACE VIEW public.quarterly_summary AS
SELECT * FROM sqp.quarterly_summary;

CREATE OR REPLACE VIEW public.yearly_summary AS
SELECT * FROM sqp.yearly_summary;

-- Grant permissions to service role
GRANT ALL ON public.refresh_config TO service_role;
GRANT ALL ON public.refresh_audit_log TO service_role;
GRANT ALL ON public.refresh_checkpoints TO service_role;
GRANT ALL ON public.asin_performance_data TO service_role;
GRANT ALL ON public.search_query_performance TO service_role;
GRANT ALL ON public.daily_sqp_data TO service_role;
GRANT ALL ON public.weekly_summary TO service_role;
GRANT ALL ON public.monthly_summary TO service_role;
GRANT ALL ON public.quarterly_summary TO service_role;
GRANT ALL ON public.yearly_summary TO service_role;

-- Also grant permissions to authenticated role for reading
GRANT SELECT ON public.refresh_config TO authenticated;
GRANT SELECT ON public.refresh_audit_log TO authenticated;
GRANT SELECT ON public.asin_performance_data TO authenticated;
GRANT SELECT ON public.search_query_performance TO authenticated;
GRANT SELECT ON public.daily_sqp_data TO authenticated;
GRANT SELECT ON public.weekly_summary TO authenticated;
GRANT SELECT ON public.monthly_summary TO authenticated;
GRANT SELECT ON public.quarterly_summary TO authenticated;
GRANT SELECT ON public.yearly_summary TO authenticated;



-- ================================================================
-- Section from: 033_recreate_brand_search_query_metrics.sql
-- ================================================================

-- Migration: Recreate brand_search_query_metrics materialized view
-- This should be run AFTER migration 031 which fixes the ASIN column length

-- This materialized view aggregates search query performance metrics by brand
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.brand_search_query_metrics AS
WITH brand_mapping AS (
  -- Map ASINs to brands using the match_brand_for_asin function
  SELECT DISTINCT
    apd.asin,
    apd.product_title,
    b.id as brand_id,
    b.brand_name,
    b.normalized_name as brand_normalized_name
  FROM sqp.asin_performance_data apd
  CROSS JOIN LATERAL (
    SELECT * FROM sqp.match_brand_for_asin(apd.asin)
  ) b
  WHERE b.id IS NOT NULL
),
query_metrics AS (
  -- Aggregate metrics by brand and search query
  SELECT 
    bm.brand_id,
    bm.brand_name,
    sqp.search_query,
    COUNT(DISTINCT apd.asin) as asin_count,
    SUM(sqp.asin_impression_count) as total_impressions,
    SUM(sqp.asin_click_count) as total_clicks,
    SUM(sqp.asin_cart_add_count) as total_cart_adds,
    SUM(sqp.asin_purchase_count) as total_purchases,
    AVG(sqp.search_query_score) as avg_query_score,
    AVG(sqp.search_query_volume) as avg_query_volume,
    AVG(sqp.asin_impression_share) as avg_impression_share,
    AVG(sqp.asin_click_share) as avg_click_share,
    AVG(sqp.asin_cart_add_share) as avg_cart_add_share,
    AVG(sqp.asin_purchase_share) as avg_purchase_share,
    MIN(apd.start_date) as earliest_date,
    MAX(apd.end_date) as latest_date
  FROM sqp.asin_performance_data apd
  JOIN brand_mapping bm ON apd.asin = bm.asin
  LEFT JOIN sqp.search_query_performance sqp 
    ON apd.id = sqp.asin_performance_id
  WHERE sqp.search_query IS NOT NULL
  GROUP BY bm.brand_id, bm.brand_name, sqp.search_query
)
SELECT 
  brand_id,
  brand_name,
  search_query,
  asin_count,
  total_impressions,
  total_clicks,
  total_cart_adds,
  total_purchases,
  -- Calculate click-through rate
  CASE 
    WHEN total_impressions > 0 
    THEN ROUND((total_clicks::NUMERIC / total_impressions) * 100, 2)
    ELSE 0 
  END as click_through_rate,
  -- Calculate conversion rate
  CASE 
    WHEN total_clicks > 0 
    THEN ROUND((total_purchases::NUMERIC / total_clicks) * 100, 2)
    ELSE 0 
  END as conversion_rate,
  -- Calculate cart-to-purchase rate
  CASE 
    WHEN total_cart_adds > 0 
    THEN ROUND((total_purchases::NUMERIC / total_cart_adds) * 100, 2)
    ELSE 0 
  END as cart_to_purchase_rate,
  avg_query_score,
  avg_query_volume,
  avg_impression_share,
  avg_click_share,
  avg_cart_add_share,
  avg_purchase_share,
  earliest_date,
  latest_date
FROM query_metrics
WHERE total_impressions > 0
ORDER BY brand_name, total_impressions DESC;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bsqm_brand_id ON sqp.brand_search_query_metrics(brand_id);
CREATE INDEX IF NOT EXISTS idx_bsqm_brand_name ON sqp.brand_search_query_metrics(brand_name);
CREATE INDEX IF NOT EXISTS idx_bsqm_search_query ON sqp.brand_search_query_metrics(search_query);
CREATE INDEX IF NOT EXISTS idx_bsqm_impressions ON sqp.brand_search_query_metrics(total_impressions DESC);

-- Grant permissions
GRANT SELECT ON sqp.brand_search_query_metrics TO authenticated;
GRANT SELECT ON sqp.brand_search_query_metrics TO anon;
GRANT SELECT ON sqp.brand_search_query_metrics TO service_role;

-- Add comment
COMMENT ON MATERIALIZED VIEW sqp.brand_search_query_metrics IS 'Aggregated search query performance metrics by brand, with automatic brand matching based on product titles';
