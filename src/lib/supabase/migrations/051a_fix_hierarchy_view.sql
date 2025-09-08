-- Migration: 051a_fix_hierarchy_view.sql
-- Description: Recreate brand_hierarchy_view after fixing brand_performance_summary
-- Date: 2025-09-08
-- Author: Claude

-- Drop and recreate the brand_hierarchy_view
DROP MATERIALIZED VIEW IF EXISTS public.brand_hierarchy_view CASCADE;

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
GRANT SELECT ON public.brand_hierarchy_view TO authenticated;

-- Update the refresh function to handle dependencies correctly
CREATE OR REPLACE FUNCTION public.refresh_brand_materialized_views()
RETURNS void AS $$
BEGIN
  -- Refresh in dependency order
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.brand_performance_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.brand_hierarchy_view;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.brand_extraction_analytics;
  
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
       (SELECT COUNT(*) FROM public.brand_hierarchy_view)),
      ('brand_extraction_analytics', NOW(), NOW(), 'success',
       (SELECT COUNT(*) FROM public.brand_extraction_analytics));
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.refresh_brand_materialized_views TO authenticated;