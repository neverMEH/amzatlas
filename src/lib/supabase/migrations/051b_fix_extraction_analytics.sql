-- Migration: 051b_fix_extraction_analytics.sql
-- Description: Fix nested aggregate error in brand_extraction_analytics
-- Date: 2025-09-08
-- Author: Claude

-- Drop the problematic view
DROP MATERIALIZED VIEW IF EXISTS public.brand_extraction_analytics CASCADE;

-- Recreate brand_extraction_analytics without nested aggregates
CREATE MATERIALIZED VIEW IF NOT EXISTS public.brand_extraction_analytics AS
WITH rule_counts AS (
  -- First, get counts by rule type for each brand
  SELECT 
    b.id as brand_id,
    b.brand_name,
    b.display_name,
    COALESCE(ber.rule_type, 'manual') as rule_type,
    COUNT(DISTINCT abm.asin) as asin_count
  FROM public.brands b
  LEFT JOIN public.brand_extraction_rules ber ON b.id = ber.brand_id
  LEFT JOIN public.asin_brand_mapping abm ON b.id = abm.brand_id 
    AND (
      (ber.id IS NOT NULL AND abm.extraction_rule_id = ber.id) OR
      (ber.id IS NULL AND abm.extraction_method = 'manual')
    )
  WHERE b.is_active = true
  GROUP BY b.id, b.brand_name, b.display_name, COALESCE(ber.rule_type, 'manual')
),
aggregated_rules AS (
  -- Aggregate the rule counts into JSON
  SELECT 
    brand_id,
    brand_name,
    display_name,
    jsonb_object_agg(rule_type, asin_count) as mapping_by_method
  FROM rule_counts
  GROUP BY brand_id, brand_name, display_name
)
SELECT 
  b.id as brand_id,
  b.brand_name,
  b.display_name,
  COUNT(DISTINCT ber.id) as total_rules,
  COUNT(DISTINCT CASE WHEN ber.is_active THEN ber.id END) as active_rules,
  COUNT(DISTINCT abm.asin) FILTER (WHERE abm.extraction_method IS NOT NULL) as extracted_asins,
  COUNT(DISTINCT abm.asin) FILTER (WHERE abm.verified = true) as verified_asins,
  AVG(abm.confidence_score) FILTER (WHERE abm.confidence_score IS NOT NULL) as avg_confidence,
  MIN(abm.confidence_score) FILTER (WHERE abm.confidence_score IS NOT NULL) as min_confidence,
  MAX(abm.confidence_score) FILTER (WHERE abm.confidence_score IS NOT NULL) as max_confidence,
  -- Use pre-aggregated rule type breakdown
  COALESCE(ar.mapping_by_method, '{}'::jsonb) as mapping_by_method,
  -- Recent extraction activity
  COUNT(DISTINCT abm.asin) FILTER (WHERE abm.created_at >= NOW() - INTERVAL '7 days') as new_mappings_7d,
  COUNT(DISTINCT abm.asin) FILTER (WHERE abm.created_at >= NOW() - INTERVAL '30 days') as new_mappings_30d,
  NOW() as last_updated
FROM public.brands b
LEFT JOIN public.brand_extraction_rules ber ON b.id = ber.brand_id
LEFT JOIN public.asin_brand_mapping abm ON b.id = abm.brand_id
LEFT JOIN aggregated_rules ar ON b.id = ar.brand_id
WHERE b.is_active = true
GROUP BY b.id, b.brand_name, b.display_name, ar.mapping_by_method;

-- Create indexes on extraction analytics
CREATE INDEX idx_extraction_analytics_brand ON public.brand_extraction_analytics(brand_id);
CREATE INDEX idx_extraction_analytics_confidence ON public.brand_extraction_analytics(avg_confidence DESC);
CREATE INDEX idx_extraction_analytics_extracted ON public.brand_extraction_analytics(extracted_asins DESC);

-- Grant permissions
GRANT SELECT ON public.brand_extraction_analytics TO authenticated;

-- Update comments
COMMENT ON MATERIALIZED VIEW public.brand_extraction_analytics IS 
'Analytics on brand extraction rules and their effectiveness';

-- Update the refresh function to include brand_extraction_analytics
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