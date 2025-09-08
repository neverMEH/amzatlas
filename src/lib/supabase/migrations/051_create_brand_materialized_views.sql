-- Migration: 051_create_brand_materialized_views.sql
-- Description: Create materialized views for optimized brand querying
-- Date: 2025-09-08
-- Author: Claude

-- Create materialized view for brand performance summary
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
    SUM(sqp.query_impressions) as total_impressions,
    SUM(sqp.query_clicks) as total_clicks,
    SUM(sqp.query_cart_adds) as total_cart_adds,
    SUM(sqp.query_purchases) as total_purchases,
    -- Calculate rates
    CASE 
      WHEN SUM(sqp.query_impressions) > 0 
      THEN (SUM(sqp.query_clicks)::NUMERIC / SUM(sqp.query_impressions)::NUMERIC * 100)
      ELSE 0
    END as avg_ctr,
    CASE 
      WHEN SUM(sqp.query_clicks) > 0 
      THEN (SUM(sqp.query_cart_adds)::NUMERIC / SUM(sqp.query_clicks)::NUMERIC * 100)
      ELSE 0
    END as avg_cart_add_rate,
    CASE 
      WHEN SUM(sqp.query_clicks) > 0 
      THEN (SUM(sqp.query_purchases)::NUMERIC / SUM(sqp.query_clicks)::NUMERIC * 100)
      ELSE 0
    END as avg_cvr,
    -- Revenue metrics
    SUM(sqp.query_purchases * sqp.purchase_median_price) as estimated_revenue,
    AVG(sqp.purchase_median_price) as avg_price,
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

-- Create indexes on materialized view
CREATE INDEX idx_brand_perf_summary_brand_id ON public.brand_performance_summary(brand_id);
CREATE INDEX idx_brand_perf_summary_parent ON public.brand_performance_summary(parent_brand_id);
CREATE INDEX idx_brand_perf_summary_impressions ON public.brand_performance_summary(total_impressions DESC);
CREATE INDEX idx_brand_perf_summary_revenue ON public.brand_performance_summary(estimated_revenue DESC);

-- Create materialized view for brand hierarchy with aggregated metrics
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

-- Create indexes on hierarchy view
CREATE INDEX idx_brand_hierarchy_view_id ON public.brand_hierarchy_view(id);
CREATE INDEX idx_brand_hierarchy_view_parent ON public.brand_hierarchy_view(parent_brand_id);
CREATE INDEX idx_brand_hierarchy_view_root ON public.brand_hierarchy_view(root_brand_id);
CREATE INDEX idx_brand_hierarchy_view_level ON public.brand_hierarchy_view(level);
CREATE INDEX idx_brand_hierarchy_view_path_gin ON public.brand_hierarchy_view USING gin(path);

-- Create materialized view for brand extraction analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS public.brand_extraction_analytics AS
SELECT 
  b.id as brand_id,
  b.brand_name,
  b.display_name,
  COUNT(DISTINCT ber.id) as total_rules,
  COUNT(DISTINCT CASE WHEN ber.is_active THEN ber.id END) as active_rules,
  COUNT(DISTINCT abm.asin) FILTER (WHERE abm.extraction_method IS NOT NULL) as extracted_asins,
  COUNT(DISTINCT abm.asin) FILTER (WHERE abm.is_verified = true) as verified_asins,
  AVG(abm.extraction_confidence) FILTER (WHERE abm.extraction_confidence IS NOT NULL) as avg_confidence,
  MIN(abm.extraction_confidence) FILTER (WHERE abm.extraction_confidence IS NOT NULL) as min_confidence,
  MAX(abm.extraction_confidence) FILTER (WHERE abm.extraction_confidence IS NOT NULL) as max_confidence,
  -- Rule type breakdown
  jsonb_object_agg(
    COALESCE(ber.rule_type, 'manual'), 
    COUNT(DISTINCT abm.asin)
  ) FILTER (WHERE ber.rule_type IS NOT NULL OR abm.extraction_method = 'manual') as mapping_by_method,
  -- Recent extraction activity
  COUNT(DISTINCT abm.asin) FILTER (WHERE abm.created_at >= NOW() - INTERVAL '7 days') as new_mappings_7d,
  COUNT(DISTINCT abm.asin) FILTER (WHERE abm.created_at >= NOW() - INTERVAL '30 days') as new_mappings_30d,
  NOW() as last_updated
FROM public.brands b
LEFT JOIN public.brand_extraction_rules ber ON b.id = ber.brand_id
LEFT JOIN public.asin_brand_mapping abm ON b.id = abm.brand_id
WHERE b.is_active = true
GROUP BY b.id, b.brand_name, b.display_name;

-- Create indexes on extraction analytics
CREATE INDEX idx_extraction_analytics_brand ON public.brand_extraction_analytics(brand_id);
CREATE INDEX idx_extraction_analytics_confidence ON public.brand_extraction_analytics(avg_confidence DESC);
CREATE INDEX idx_extraction_analytics_extracted ON public.brand_extraction_analytics(extracted_asins DESC);

-- Create function to refresh all brand materialized views
CREATE OR REPLACE FUNCTION public.refresh_brand_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.brand_performance_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.brand_hierarchy_view;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.brand_extraction_analytics;
  
  -- Log refresh
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
     (SELECT COUNT(*) FROM public.brand_hierarchy_view)),
    ('brand_extraction_analytics', NOW(), NOW(), 'success',
     (SELECT COUNT(*) FROM public.brand_extraction_analytics));
END;
$$ LANGUAGE plpgsql;

-- Create scheduled refresh (requires pg_cron extension or external scheduler)
-- This is a placeholder - actual scheduling depends on your setup
COMMENT ON FUNCTION public.refresh_brand_materialized_views IS 
'Refresh all brand-related materialized views. Schedule this to run hourly or daily.';

-- Grant permissions
GRANT SELECT ON public.brand_performance_summary TO authenticated;
GRANT SELECT ON public.brand_hierarchy_view TO authenticated;
GRANT SELECT ON public.brand_extraction_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_brand_materialized_views TO authenticated;

-- Add view documentation
COMMENT ON MATERIALIZED VIEW public.brand_performance_summary IS 
'Aggregated performance metrics for each brand including ASINs, queries, and revenue';
COMMENT ON MATERIALIZED VIEW public.brand_hierarchy_view IS 
'Hierarchical brand structure with aggregated metrics including child brands';
COMMENT ON MATERIALIZED VIEW public.brand_extraction_analytics IS 
'Analytics on brand extraction rules and their effectiveness';