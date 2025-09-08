-- Migration: 050a_fix_column_names.sql
-- Description: Fix column names in brand database functions
-- Date: 2025-09-08
-- Author: Claude

-- Drop and recreate the calculate_brand_performance function with correct column names
DROP FUNCTION IF EXISTS public.calculate_brand_performance(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION public.calculate_brand_performance(
  p_brand_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_impressions BIGINT,
  total_clicks BIGINT,
  total_cart_adds BIGINT,
  total_purchases BIGINT,
  unique_asins INTEGER,
  unique_queries INTEGER,
  avg_ctr NUMERIC,
  avg_cart_add_rate NUMERIC,
  avg_purchase_rate NUMERIC,
  total_revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    SUM(sqp.total_impression_count)::BIGINT as total_impressions,
    SUM(sqp.asin_click_count)::BIGINT as total_clicks,
    SUM(sqp.asin_cart_add_count)::BIGINT as total_cart_adds,
    SUM(sqp.asin_purchase_count)::BIGINT as total_purchases,
    COUNT(DISTINCT apd.asin)::INTEGER as unique_asins,
    COUNT(DISTINCT sqp.search_query)::INTEGER as unique_queries,
    CASE 
      WHEN SUM(sqp.total_impression_count) > 0 
      THEN (SUM(sqp.asin_click_count)::NUMERIC / SUM(sqp.total_impression_count)::NUMERIC * 100)
      ELSE 0
    END as avg_ctr,
    CASE 
      WHEN SUM(sqp.asin_click_count) > 0 
      THEN (SUM(sqp.asin_cart_add_count)::NUMERIC / SUM(sqp.asin_click_count)::NUMERIC * 100)
      ELSE 0
    END as avg_cart_add_rate,
    CASE 
      WHEN SUM(sqp.asin_click_count) > 0 
      THEN (SUM(sqp.asin_purchase_count)::NUMERIC / SUM(sqp.asin_click_count)::NUMERIC * 100)
      ELSE 0
    END as avg_purchase_rate,
    SUM(sqp.asin_purchase_count * sqp.asin_median_purchase_price)::NUMERIC as total_revenue
  FROM public.asin_brand_mapping abm
  JOIN sqp.asin_performance_data apd ON abm.asin = apd.asin
  JOIN sqp.search_query_performance sqp ON apd.id = sqp.asin_performance_id
  WHERE abm.brand_id = p_brand_id
    AND apd.start_date >= p_start_date
    AND apd.end_date <= p_end_date;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.calculate_brand_performance TO authenticated;

-- Also fix the materialized view in migration 051 by dropping and recreating it
DROP MATERIALIZED VIEW IF EXISTS public.brand_performance_summary CASCADE;

-- Recreate with correct column names
CREATE MATERIALIZED VIEW IF NOT EXISTS public.brand_performance_summary AS
WITH brand_metrics AS (
  SELECT 
    b.id as brand_id,
    b.brand_name,
    b.display_name,
    b.normalized_name,
    b.parent_brand_id,
    b.logo_url,
    b.brand_color,
    COUNT(DISTINCT abm.asin) as asin_count,
    COUNT(DISTINCT sqp.search_query) as query_count,
    SUM(sqp.total_impression_count) as total_impressions,
    SUM(sqp.asin_click_count) as total_clicks,
    SUM(sqp.asin_cart_add_count) as total_cart_adds,
    SUM(sqp.asin_purchase_count) as total_purchases,
    -- Calculate rates
    CASE 
      WHEN SUM(sqp.total_impression_count) > 0 
      THEN (SUM(sqp.asin_click_count)::NUMERIC / SUM(sqp.total_impression_count)::NUMERIC * 100)
      ELSE 0
    END as avg_ctr,
    CASE 
      WHEN SUM(sqp.asin_click_count) > 0 
      THEN (SUM(sqp.asin_cart_add_count)::NUMERIC / SUM(sqp.asin_click_count)::NUMERIC * 100)
      ELSE 0
    END as avg_cart_add_rate,
    CASE 
      WHEN SUM(sqp.asin_click_count) > 0 
      THEN (SUM(sqp.asin_purchase_count)::NUMERIC / SUM(sqp.asin_click_count)::NUMERIC * 100)
      ELSE 0
    END as avg_cvr,
    -- Revenue metrics
    SUM(sqp.asin_purchase_count * sqp.asin_median_purchase_price) as estimated_revenue,
    AVG(sqp.asin_median_purchase_price) as avg_price,
    -- Time range
    MIN(apd.start_date) as earliest_data,
    MAX(apd.end_date) as latest_data,
    NOW() as last_updated
  FROM public.brands b
  LEFT JOIN public.asin_brand_mapping abm ON b.id = abm.brand_id
  LEFT JOIN sqp.asin_performance_data apd ON abm.asin = apd.asin
  LEFT JOIN sqp.search_query_performance sqp ON apd.id = sqp.asin_performance_id
  WHERE b.is_active = true
  GROUP BY 
    b.id, 
    b.brand_name, 
    b.display_name, 
    b.normalized_name,
    b.parent_brand_id,
    b.logo_url,
    b.brand_color
)
SELECT * FROM brand_metrics;

-- Recreate indexes
CREATE INDEX idx_brand_perf_summary_brand_id ON public.brand_performance_summary(brand_id);
CREATE INDEX idx_brand_perf_summary_parent ON public.brand_performance_summary(parent_brand_id);
CREATE INDEX idx_brand_perf_summary_impressions ON public.brand_performance_summary(total_impressions DESC);
CREATE INDEX idx_brand_perf_summary_revenue ON public.brand_performance_summary(estimated_revenue DESC);

-- Grant permissions
GRANT SELECT ON public.brand_performance_summary TO authenticated;