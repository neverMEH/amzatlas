-- Migration: 050_create_brand_database_functions.sql
-- Description: Create PostgreSQL functions for brand operations
-- Date: 2025-09-08
-- Author: Claude

-- Function to extract brand from product title using extraction rules
CREATE OR REPLACE FUNCTION public.extract_brand_from_title(
  p_product_title TEXT,
  p_asin VARCHAR(20) DEFAULT NULL
)
RETURNS TABLE (
  brand_id UUID,
  brand_name VARCHAR(255),
  confidence NUMERIC(3,2),
  extraction_rule_id UUID,
  extraction_method VARCHAR(50)
) AS $$
DECLARE
  v_normalized_title TEXT;
BEGIN
  -- Normalize the title for better matching
  v_normalized_title := LOWER(TRIM(p_product_title));
  
  -- Try to match using extraction rules
  RETURN QUERY
  WITH rule_matches AS (
    SELECT DISTINCT ON (b.id)
      b.id as brand_id,
      b.brand_name,
      CASE 
        WHEN er.rule_type = 'exact' AND v_normalized_title = LOWER(er.pattern) THEN 1.00
        WHEN er.rule_type = 'contains' AND v_normalized_title LIKE '%' || LOWER(er.pattern) || '%' THEN 0.90
        WHEN er.rule_type = 'prefix' AND v_normalized_title LIKE LOWER(er.pattern) || '%' THEN 0.85
        WHEN er.rule_type = 'suffix' AND v_normalized_title LIKE '%' || LOWER(er.pattern) THEN 0.85
        WHEN er.rule_type = 'regex' AND v_normalized_title ~ er.pattern THEN er.confidence_threshold
        ELSE 0
      END AS match_confidence,
      er.id as rule_id,
      er.rule_type as method,
      er.priority
    FROM public.brand_extraction_rules er
    JOIN public.brands b ON er.brand_id = b.id
    WHERE er.is_active = true 
      AND b.is_active = true
      AND (
        (er.rule_type = 'exact' AND (
          (er.is_case_sensitive AND p_product_title = er.pattern) OR
          (NOT er.is_case_sensitive AND v_normalized_title = LOWER(er.pattern))
        )) OR
        (er.rule_type = 'contains' AND (
          (er.is_case_sensitive AND p_product_title LIKE '%' || er.pattern || '%') OR
          (NOT er.is_case_sensitive AND v_normalized_title LIKE '%' || LOWER(er.pattern) || '%')
        )) OR
        (er.rule_type = 'prefix' AND (
          (er.is_case_sensitive AND p_product_title LIKE er.pattern || '%') OR
          (NOT er.is_case_sensitive AND v_normalized_title LIKE LOWER(er.pattern) || '%')
        )) OR
        (er.rule_type = 'suffix' AND (
          (er.is_case_sensitive AND p_product_title LIKE '%' || er.pattern) OR
          (NOT er.is_case_sensitive AND v_normalized_title LIKE '%' || LOWER(er.pattern))
        )) OR
        (er.rule_type = 'regex' AND (
          (er.is_case_sensitive AND p_product_title ~ er.pattern) OR
          (NOT er.is_case_sensitive AND v_normalized_title ~* er.pattern)
        ))
      )
    ORDER BY b.id, er.priority DESC, match_confidence DESC
  )
  SELECT 
    rm.brand_id,
    rm.brand_name,
    rm.match_confidence as confidence,
    rm.rule_id as extraction_rule_id,
    rm.method as extraction_method
  FROM rule_matches rm
  WHERE rm.match_confidence > 0
  ORDER BY rm.match_confidence DESC, rm.priority DESC
  LIMIT 1;
  
  -- If no match found and ASIN provided, check existing mapping
  IF NOT FOUND AND p_asin IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      b.id as brand_id,
      b.brand_name,
      0.50::NUMERIC(3,2) as confidence,
      NULL::UUID as extraction_rule_id,
      'existing_mapping'::VARCHAR(50) as extraction_method
    FROM public.asin_brand_mapping abm
    JOIN public.brands b ON abm.brand_id = b.id
    WHERE abm.asin = p_asin
      AND b.is_active = true
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update brand ASIN counts
CREATE OR REPLACE FUNCTION public.update_brand_asin_counts()
RETURNS void AS $$
BEGIN
  -- Update metadata with current ASIN count for each brand
  UPDATE public.brands b
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{asin_count}',
    to_jsonb((
      SELECT COUNT(*)
      FROM public.asin_brand_mapping abm
      WHERE abm.brand_id = b.id
    ))
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get brand hierarchy tree
CREATE OR REPLACE FUNCTION public.get_brand_hierarchy(
  p_brand_id UUID DEFAULT NULL,
  p_max_depth INTEGER DEFAULT 10
)
RETURNS TABLE (
  brand_id UUID,
  brand_name VARCHAR(255),
  parent_brand_id UUID,
  level INTEGER,
  path UUID[]
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE brand_tree AS (
    -- Base case: top-level brands or specific brand
    SELECT 
      b.id as brand_id,
      b.brand_name,
      b.parent_brand_id,
      0 as level,
      ARRAY[b.id] as path
    FROM public.brands b
    WHERE b.is_active = true
      AND (
        (p_brand_id IS NULL AND b.parent_brand_id IS NULL) OR
        (p_brand_id IS NOT NULL AND b.id = p_brand_id)
      )
    
    UNION ALL
    
    -- Recursive case: get children
    SELECT 
      b.id as brand_id,
      b.brand_name,
      b.parent_brand_id,
      bt.level + 1 as level,
      bt.path || b.id as path
    FROM public.brands b
    JOIN brand_tree bt ON b.parent_brand_id = bt.brand_id
    WHERE b.is_active = true
      AND bt.level < p_max_depth
      AND NOT (b.id = ANY(bt.path)) -- Prevent cycles
  )
  SELECT * FROM brand_tree
  ORDER BY path;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate brand performance metrics
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
    SUM(sqp.query_impressions)::BIGINT as total_impressions,
    SUM(sqp.query_clicks)::BIGINT as total_clicks,
    SUM(sqp.query_cart_adds)::BIGINT as total_cart_adds,
    SUM(sqp.query_purchases)::BIGINT as total_purchases,
    COUNT(DISTINCT apd.asin)::INTEGER as unique_asins,
    COUNT(DISTINCT sqp.search_query)::INTEGER as unique_queries,
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
    END as avg_purchase_rate,
    SUM(sqp.query_purchases * sqp.purchase_median_price)::NUMERIC as total_revenue
  FROM public.asin_brand_mapping abm
  JOIN sqp.asin_performance_data apd ON abm.asin = apd.asin
  JOIN sqp.search_query_performance sqp ON apd.id = sqp.asin_performance_id
  WHERE abm.brand_id = p_brand_id
    AND apd.start_date >= p_start_date
    AND apd.end_date <= p_end_date;
END;
$$ LANGUAGE plpgsql;

-- Function to bulk extract brands for unmapped ASINs
CREATE OR REPLACE FUNCTION public.bulk_extract_brands_for_asins(
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  asin VARCHAR(20),
  product_title TEXT,
  extracted_brand_id UUID,
  extracted_brand_name VARCHAR(255),
  confidence NUMERIC(3,2),
  extraction_method VARCHAR(50)
) AS $$
BEGIN
  RETURN QUERY
  WITH unmapped_asins AS (
    SELECT DISTINCT 
      apd.asin,
      apd.product_title
    FROM sqp.asin_performance_data apd
    LEFT JOIN public.asin_brand_mapping abm ON apd.asin = abm.asin
    WHERE abm.asin IS NULL
      AND apd.product_title IS NOT NULL
      AND apd.product_title != ''
    ORDER BY apd.asin
    LIMIT p_limit
  )
  SELECT 
    ua.asin,
    ua.product_title,
    eb.brand_id as extracted_brand_id,
    eb.brand_name as extracted_brand_name,
    eb.confidence,
    eb.extraction_method
  FROM unmapped_asins ua
  CROSS JOIN LATERAL extract_brand_from_title(ua.product_title, ua.asin) eb;
END;
$$ LANGUAGE plpgsql;

-- Function to apply extracted brands to mappings
CREATE OR REPLACE FUNCTION public.apply_brand_extractions(
  p_confidence_threshold NUMERIC DEFAULT 0.80
)
RETURNS TABLE (
  asins_mapped INTEGER,
  brands_affected INTEGER
) AS $$
DECLARE
  v_mapped_count INTEGER := 0;
  v_brands_count INTEGER := 0;
BEGIN
  -- Create temporary table for extractions
  CREATE TEMP TABLE temp_extractions AS
  SELECT * FROM public.bulk_extract_brands_for_asins(1000);
  
  -- Insert new mappings
  INSERT INTO public.asin_brand_mapping (
    asin,
    brand_id,
    extraction_rule_id,
    extraction_confidence,
    extraction_method,
    created_at,
    updated_at
  )
  SELECT 
    te.asin,
    te.extracted_brand_id,
    ter.id,
    te.confidence,
    te.extraction_method,
    NOW(),
    NOW()
  FROM temp_extractions te
  LEFT JOIN public.brand_extraction_rules ter 
    ON te.extraction_method IN ('exact', 'contains', 'prefix', 'suffix', 'regex')
    AND ter.brand_id = te.extracted_brand_id
  WHERE te.confidence >= p_confidence_threshold
  ON CONFLICT (asin) DO NOTHING;
  
  GET DIAGNOSTICS v_mapped_count = ROW_COUNT;
  
  -- Count affected brands
  SELECT COUNT(DISTINCT extracted_brand_id)
  INTO v_brands_count
  FROM temp_extractions
  WHERE confidence >= p_confidence_threshold;
  
  -- Drop temporary table
  DROP TABLE temp_extractions;
  
  -- Update brand ASIN counts
  PERFORM public.update_brand_asin_counts();
  
  RETURN QUERY SELECT v_mapped_count as asins_mapped, v_brands_count as brands_affected;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.extract_brand_from_title TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_brand_asin_counts TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_brand_hierarchy TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_brand_performance TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_extract_brands_for_asins TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_brand_extractions TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION public.extract_brand_from_title IS 'Extract brand from product title using configured extraction rules';
COMMENT ON FUNCTION public.update_brand_asin_counts IS 'Update ASIN count metadata for all brands';
COMMENT ON FUNCTION public.get_brand_hierarchy IS 'Get hierarchical tree structure for brands';
COMMENT ON FUNCTION public.calculate_brand_performance IS 'Calculate performance metrics for a brand within date range';
COMMENT ON FUNCTION public.bulk_extract_brands_for_asins IS 'Bulk extract brands for unmapped ASINs';
COMMENT ON FUNCTION public.apply_brand_extractions IS 'Apply extracted brand mappings above confidence threshold';