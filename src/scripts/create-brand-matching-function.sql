-- Function to automatically match ASINs to brands based on product titles
CREATE OR REPLACE FUNCTION public.match_asins_to_brand(
  p_brand_name TEXT,
  p_match_patterns TEXT[] DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_brand_id UUID;
  v_matched_count INTEGER := 0;
  v_patterns TEXT[];
  v_pattern TEXT;
  v_asin_record RECORD;
BEGIN
  -- Get the brand ID
  SELECT id INTO v_brand_id
  FROM brands
  WHERE brand_name = p_brand_name
  LIMIT 1;
  
  IF v_brand_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Brand not found',
      'matched_count', 0
    );
  END IF;
  
  -- If no patterns provided, use the brand name itself
  IF p_match_patterns IS NULL OR array_length(p_match_patterns, 1) IS NULL THEN
    v_patterns := ARRAY[p_brand_name];
  ELSE
    v_patterns := p_match_patterns;
  END IF;
  
  -- For each pattern, find and map matching ASINs
  FOREACH v_pattern IN ARRAY v_patterns
  LOOP
    FOR v_asin_record IN 
      SELECT DISTINCT asin, product_title
      FROM asin_performance_data
      WHERE product_title ILIKE '%' || v_pattern || '%'
        AND product_title IS NOT NULL
        AND asin NOT IN (
          SELECT asin 
          FROM asin_brand_mapping 
          WHERE brand_id = v_brand_id
        )
    LOOP
      -- Insert the mapping
      INSERT INTO asin_brand_mapping (
        asin,
        brand_id,
        product_title,
        extraction_method,
        confidence_score,
        verified
      ) VALUES (
        v_asin_record.asin,
        v_brand_id,
        v_asin_record.product_title,
        'pattern_match',
        CASE 
          WHEN v_asin_record.product_title ILIKE p_brand_name || '%' THEN 0.9
          WHEN v_asin_record.product_title ILIKE '%' || p_brand_name || '%' THEN 0.7
          ELSE 0.5
        END,
        false
      )
      ON CONFLICT (asin) DO UPDATE
        SET brand_id = EXCLUDED.brand_id,
            product_title = EXCLUDED.product_title,
            extraction_method = EXCLUDED.extraction_method,
            confidence_score = EXCLUDED.confidence_score,
            updated_at = CURRENT_TIMESTAMP;
      
      v_matched_count := v_matched_count + 1;
    END LOOP;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'brand_id', v_brand_id,
    'brand_name', p_brand_name,
    'matched_count', v_matched_count,
    'patterns_used', v_patterns
  );
END;
$$ LANGUAGE plpgsql;

-- Function to create a new brand and automatically match ASINs
CREATE OR REPLACE FUNCTION public.create_brand_and_match(
  p_brand_name TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_match_patterns TEXT[] DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_brand_id UUID;
  v_normalized_name TEXT;
  v_match_result JSON;
BEGIN
  -- Normalize the brand name
  v_normalized_name := lower(regexp_replace(p_brand_name, '\s+', '-', 'g'));
  
  -- Create the brand
  INSERT INTO brands (
    brand_name,
    normalized_name,
    display_name,
    is_active
  ) VALUES (
    p_brand_name,
    v_normalized_name,
    COALESCE(p_display_name, p_brand_name),
    true
  )
  ON CONFLICT (brand_name) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        updated_at = CURRENT_TIMESTAMP
  RETURNING id INTO v_brand_id;
  
  -- Match ASINs to the brand
  v_match_result := match_asins_to_brand(p_brand_name, p_match_patterns);
  
  RETURN json_build_object(
    'success', true,
    'brand_id', v_brand_id,
    'brand_name', p_brand_name,
    'match_result', v_match_result
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger function to automatically match ASINs when product titles are updated
CREATE OR REPLACE FUNCTION public.auto_match_brand_on_title_update()
RETURNS TRIGGER AS $$
DECLARE
  v_brand RECORD;
BEGIN
  -- Only process if product_title changed and is not null
  IF NEW.product_title IS NOT NULL AND 
     (OLD.product_title IS NULL OR OLD.product_title != NEW.product_title) THEN
    
    -- Check each active brand for matches
    FOR v_brand IN 
      SELECT id, brand_name 
      FROM brands 
      WHERE is_active = true
    LOOP
      -- If the product title contains the brand name
      IF NEW.product_title ILIKE '%' || v_brand.brand_name || '%' THEN
        -- Create or update the mapping
        INSERT INTO asin_brand_mapping (
          asin,
          brand_id,
          product_title,
          extraction_method,
          confidence_score,
          verified
        ) VALUES (
          NEW.asin,
          v_brand.id,
          NEW.product_title,
          'auto_trigger',
          CASE 
            WHEN NEW.product_title ILIKE v_brand.brand_name || '%' THEN 0.9
            ELSE 0.7
          END,
          false
        )
        ON CONFLICT (asin) DO UPDATE
          SET brand_id = EXCLUDED.brand_id,
              product_title = EXCLUDED.product_title,
              confidence_score = EXCLUDED.confidence_score,
              updated_at = CURRENT_TIMESTAMP
          WHERE asin_brand_mapping.confidence_score < EXCLUDED.confidence_score;
        
        -- Exit after first match (highest priority brand wins)
        EXIT;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS auto_match_brand_trigger ON asin_performance_data;
CREATE TRIGGER auto_match_brand_trigger
AFTER INSERT OR UPDATE ON asin_performance_data
FOR EACH ROW
EXECUTE FUNCTION auto_match_brand_on_title_update();

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_asin_performance_product_title 
ON asin_performance_data(product_title);

CREATE INDEX IF NOT EXISTS idx_brands_brand_name 
ON brands(brand_name);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.match_asins_to_brand TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_brand_and_match TO authenticated;

-- Example usage comments
COMMENT ON FUNCTION public.match_asins_to_brand IS 
'Match ASINs to an existing brand based on product title patterns. 
Example: SELECT match_asins_to_brand(''Work Sharp'', ARRAY[''Work Sharp'', ''WorkSharp'']);';

COMMENT ON FUNCTION public.create_brand_and_match IS 
'Create a new brand and automatically match ASINs based on patterns. 
Example: SELECT create_brand_and_match(''Spyderco'', ''Spyderco Knives'', ARRAY[''Spyderco'']);';