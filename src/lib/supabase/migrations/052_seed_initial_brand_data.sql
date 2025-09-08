-- Migration: 052_seed_initial_brand_data.sql
-- Description: Seed initial brand extraction rules and test data
-- Date: 2025-09-08
-- Author: Claude

-- Insert extraction rules for Work Sharp brand
INSERT INTO public.brand_extraction_rules (
  brand_id,
  rule_type,
  pattern,
  priority,
  is_case_sensitive,
  confidence_threshold,
  metadata
)
SELECT 
  b.id,
  rule.rule_type,
  rule.pattern,
  rule.priority,
  rule.is_case_sensitive,
  rule.confidence_threshold,
  rule.metadata
FROM public.brands b
CROSS JOIN (
  VALUES
    -- Exact match rules (highest priority)
    ('exact'::VARCHAR, 'Work Sharp', 100, false, 1.00::NUMERIC, '{"description": "Exact brand name match"}'::JSONB),
    ('exact'::VARCHAR, 'WORK SHARP', 99, true, 1.00::NUMERIC, '{"description": "Exact uppercase match"}'::JSONB),
    
    -- Prefix rules
    ('prefix'::VARCHAR, 'Work Sharp ', 90, false, 0.95::NUMERIC, '{"description": "Brand name at start of title"}'::JSONB),
    ('prefix'::VARCHAR, 'WORK SHARP ', 89, true, 0.95::NUMERIC, '{"description": "Uppercase brand at start"}'::JSONB),
    
    -- Contains rules (lower priority)
    ('contains'::VARCHAR, 'Work Sharp', 80, false, 0.90::NUMERIC, '{"description": "Brand name anywhere in title"}'::JSONB),
    ('contains'::VARCHAR, 'WorkSharp', 75, false, 0.85::NUMERIC, '{"description": "Brand name without space"}'::JSONB),
    
    -- Regex patterns for variations
    ('regex'::VARCHAR, '\\bwork\\s*sharp\\b', 70, false, 0.85::NUMERIC, '{"description": "Word boundary with optional space"}'::JSONB),
    ('regex'::VARCHAR, 'work[-\\s]*sharp', 65, false, 0.80::NUMERIC, '{"description": "With dash or space"}'::JSONB)
) AS rule(rule_type, pattern, priority, is_case_sensitive, confidence_threshold, metadata)
WHERE b.brand_name = 'Work Sharp'
  AND b.is_active = true
ON CONFLICT (brand_id, rule_type, pattern) DO NOTHING;

-- Add common brand patterns for future use
-- This creates a template for other brands that might be added
INSERT INTO public.brand_extraction_rules (
  brand_id,
  rule_type,
  pattern,
  priority,
  is_case_sensitive,
  confidence_threshold,
  metadata
)
SELECT 
  b.id,
  'contains'::VARCHAR,
  b.brand_name,
  50,
  false,
  0.80::NUMERIC,
  '{"description": "Default contains rule for brand name", "auto_generated": true}'::JSONB
FROM public.brands b
WHERE b.is_active = true
  AND NOT EXISTS (
    SELECT 1 
    FROM public.brand_extraction_rules ber 
    WHERE ber.brand_id = b.id 
      AND ber.rule_type = 'contains' 
      AND ber.pattern = b.brand_name
  );

-- Create sample brand hierarchy (if other brands exist)
-- This is a placeholder - will only insert if multiple brands exist
INSERT INTO public.brand_hierarchy (
  parent_brand_id,
  child_brand_id,
  relationship_type
)
SELECT 
  p.id as parent_brand_id,
  c.id as child_brand_id,
  'subsidiary' as relationship_type
FROM public.brands p
CROSS JOIN public.brands c
WHERE p.brand_name = 'Work Sharp'
  AND c.brand_name LIKE 'Work Sharp %'
  AND p.id != c.id
  AND p.is_active = true
  AND c.is_active = true
ON CONFLICT (parent_brand_id, child_brand_id) DO NOTHING;

-- Update Work Sharp brand with additional metadata
UPDATE public.brands
SET 
  logo_url = '/brands/work-sharp-logo.png',
  brand_color = '#FF6B00',
  description = 'Premium sharpening tools and knife care products',
  website_url = 'https://worksharptools.com',
  metadata = jsonb_build_object(
    'founded_year', 2007,
    'headquarters', 'Ashland, Oregon',
    'product_categories', ARRAY['Sharpeners', 'Knife Care', 'Tool Maintenance'],
    'market_segments', ARRAY['Professional', 'Consumer', 'Industrial']
  )
WHERE brand_name = 'Work Sharp'
  AND is_active = true;

-- Apply brand extractions for existing unmapped ASINs
-- This will use the extraction rules we just created
DO $$
DECLARE
  v_result RECORD;
BEGIN
  -- First, let's see how many unmapped ASINs we have
  RAISE NOTICE 'Starting brand extraction for unmapped ASINs...';
  
  -- Apply extractions with 80% confidence threshold
  SELECT * INTO v_result 
  FROM public.apply_brand_extractions(0.80);
  
  RAISE NOTICE 'Brand extraction complete: % ASINs mapped to % brands', 
    v_result.asins_mapped, v_result.brands_affected;
    
  -- Update brand ASIN counts
  PERFORM public.update_brand_asin_counts();
  
  -- Refresh materialized views if they exist
  IF EXISTS (
    SELECT 1 FROM pg_matviews 
    WHERE schemaname = 'public' 
    AND matviewname = 'brand_performance_summary'
  ) THEN
    PERFORM public.refresh_brand_materialized_views();
    RAISE NOTICE 'Materialized views refreshed';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error during brand extraction: %', SQLERRM;
END $$;

-- Log the seeding completion
INSERT INTO public.migration_log (
  migration_name,
  execution_time,
  status,
  metadata
)
VALUES (
  '052_seed_initial_brand_data',
  NOW(),
  'completed',
  jsonb_build_object(
    'extraction_rules_created', (
      SELECT COUNT(*) 
      FROM public.brand_extraction_rules 
      WHERE created_at >= NOW() - INTERVAL '1 minute'
    ),
    'brands_updated', (
      SELECT COUNT(*) 
      FROM public.brands 
      WHERE updated_at >= NOW() - INTERVAL '1 minute'
    )
  )
);

-- Add helpful comments
COMMENT ON COLUMN public.brand_extraction_rules.priority IS 
'Higher priority rules are evaluated first. Range: 0-100. Exact matches should have highest priority.';
COMMENT ON COLUMN public.brand_extraction_rules.confidence_threshold IS 
'Minimum confidence required for automatic mapping. 1.0 = 100% confidence. Default: 0.80';

-- Create a view to help monitor extraction effectiveness
CREATE OR REPLACE VIEW public.brand_extraction_monitoring AS
SELECT 
  ber.id as rule_id,
  b.brand_name,
  ber.rule_type,
  ber.pattern,
  ber.priority,
  ber.confidence_threshold,
  COUNT(DISTINCT abm.asin) as asins_matched,
  AVG(abm.extraction_confidence) as avg_match_confidence,
  ber.is_active,
  ber.created_at,
  ber.updated_at
FROM public.brand_extraction_rules ber
JOIN public.brands b ON ber.brand_id = b.id
LEFT JOIN public.asin_brand_mapping abm 
  ON abm.extraction_rule_id = ber.id
GROUP BY 
  ber.id, b.brand_name, ber.rule_type, ber.pattern, 
  ber.priority, ber.confidence_threshold, ber.is_active,
  ber.created_at, ber.updated_at
ORDER BY b.brand_name, ber.priority DESC;

GRANT SELECT ON public.brand_extraction_monitoring TO authenticated;

COMMENT ON VIEW public.brand_extraction_monitoring IS 
'Monitor effectiveness of brand extraction rules by showing match counts and confidence scores';