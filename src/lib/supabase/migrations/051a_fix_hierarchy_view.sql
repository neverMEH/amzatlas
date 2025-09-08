-- Migration: 051a_fix_all_brand_materialized_views.sql
-- Description: Recreate all brand materialized views with correct column names
-- This replaces migration 051 which had incorrect column names:
--   - query_impressions -> total_query_impression_count
--   - query_clicks -> asin_click_count
--   - query_cart_adds -> asin_cart_add_count
--   - query_purchases -> asin_purchase_count
-- Date: 2025-09-08
-- Author: Claude

-- First drop all dependent views
DROP MATERIALIZED VIEW IF EXISTS public.brand_extraction_analytics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.brand_hierarchy_view CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.brand_performance_summary CASCADE;

-- Create brand_performance_summary with correct column names
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
    SUM(sqp.total_query_impression_count) as total_impressions,
    SUM(sqp.asin_click_count) as total_clicks,
    SUM(sqp.asin_cart_add_count) as total_cart_adds,
    SUM(sqp.asin_purchase_count) as total_purchases,
    -- Calculate rates
    CASE 
      WHEN SUM(sqp.total_query_impression_count) > 0 
      THEN (SUM(sqp.asin_click_count)::NUMERIC / SUM(sqp.total_query_impression_count)::NUMERIC * 100)
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

-- Create indexes on brand_performance_summary
CREATE INDEX idx_brand_perf_summary_brand_id ON public.brand_performance_summary(brand_id);
CREATE INDEX idx_brand_perf_summary_parent ON public.brand_performance_summary(parent_brand_id);
CREATE INDEX idx_brand_perf_summary_impressions ON public.brand_performance_summary(total_impressions DESC);
CREATE INDEX idx_brand_perf_summary_revenue ON public.brand_performance_summary(estimated_revenue DESC);

-- Recreate materialized view for brand hierarchy with aggregated metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS public.brand_hierarchy_view AS
WITH RECURSIVE brand_tree AS (
  -- Base case: root brands
  SELECT 
    b.id,
    b.brand_name,
    b.display_name,
    b.parent_brand_id,
    b.logo_url,
    b.brand_color,
    0 as level,
    ARRAY[b.id] as path,
    b.id as root_brand_id
  FROM public.brands b
  WHERE b.parent_brand_id IS NULL
    AND b.is_active = true
  
  UNION ALL
  
  -- Recursive case: child brands
  SELECT 
    b.id,
    b.brand_name,
    b.display_name,
    b.parent_brand_id,
    b.logo_url,
    b.brand_color,
    bt.level + 1,
    bt.path || b.id,
    bt.root_brand_id
  FROM public.brands b
  JOIN brand_tree bt ON b.parent_brand_id = bt.id
  WHERE b.is_active = true
    AND bt.level < 10 -- Prevent infinite recursion
),
brand_with_children AS (
  SELECT 
    bt.*,
    -- Count direct children
    (
      SELECT COUNT(*)
      FROM public.brands b2
      WHERE b2.parent_brand_id = bt.id
        AND b2.is_active = true
    ) as direct_children_count,
    -- Get all descendant IDs
    (
      SELECT ARRAY_AGG(DISTINCT bt2.id)
      FROM brand_tree bt2
      WHERE bt.id = ANY(bt2.path)
        AND bt2.id != bt.id
    ) as descendant_ids
  FROM brand_tree bt
)
SELECT 
  bwc.*,
  -- Aggregate metrics including descendants
  COALESCE(bps.asin_count, 0) + COALESCE((
    SELECT SUM(bps2.asin_count)
    FROM public.brand_performance_summary bps2
    WHERE bps2.brand_id = ANY(bwc.descendant_ids)
  ), 0) as total_asin_count,
  COALESCE(bps.total_impressions, 0) + COALESCE((
    SELECT SUM(bps2.total_impressions)
    FROM public.brand_performance_summary bps2
    WHERE bps2.brand_id = ANY(bwc.descendant_ids)
  ), 0) as total_impressions,
  COALESCE(bps.total_purchases, 0) + COALESCE((
    SELECT SUM(bps2.total_purchases)
    FROM public.brand_performance_summary bps2
    WHERE bps2.brand_id = ANY(bwc.descendant_ids)
  ), 0) as total_purchases,
  COALESCE(bps.estimated_revenue, 0) + COALESCE((
    SELECT SUM(bps2.estimated_revenue)
    FROM public.brand_performance_summary bps2
    WHERE bps2.brand_id = ANY(bwc.descendant_ids)
  ), 0) as total_revenue,
  NOW() as last_updated
FROM brand_with_children bwc
LEFT JOIN public.brand_performance_summary bps ON bwc.id = bps.brand_id;

-- Recreate indexes on hierarchy view
CREATE INDEX idx_brand_hierarchy_view_id ON public.brand_hierarchy_view(id);
CREATE INDEX idx_brand_hierarchy_view_parent ON public.brand_hierarchy_view(parent_brand_id);
CREATE INDEX idx_brand_hierarchy_view_root ON public.brand_hierarchy_view(root_brand_id);
CREATE INDEX idx_brand_hierarchy_view_level ON public.brand_hierarchy_view(level);
CREATE INDEX idx_brand_hierarchy_view_path_gin ON public.brand_hierarchy_view USING gin(path);

-- Grant permissions
GRANT SELECT ON public.brand_performance_summary TO authenticated;
GRANT SELECT ON public.brand_hierarchy_view TO authenticated;

-- Note: brand_extraction_analytics is created in migration 051b due to nested aggregate issue

-- Update the refresh function to handle dependencies correctly
CREATE OR REPLACE FUNCTION public.refresh_brand_materialized_views()
RETURNS void AS $$
BEGIN
  -- Refresh in dependency order
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.brand_performance_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.brand_hierarchy_view;
  -- brand_extraction_analytics will be added in migration 051b
  
  -- Log refresh (only if table exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'materialized_view_refresh_log'
  ) THEN
    INSERT INTO public.materialized_view_refresh_log (
      view_name,
      refresh_start,
      refresh_end,
      status,
      row_count
    )
    VALUES
      ('brand_performance_summary', NOW(), NOW(), 'success', 
       (SELECT COUNT(*) FROM public.brand_performance_summary)),
      ('brand_hierarchy_view', NOW(), NOW(), 'success',
       (SELECT COUNT(*) FROM public.brand_hierarchy_view));
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.refresh_brand_materialized_views TO authenticated;