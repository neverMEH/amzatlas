-- Migration: Create Weekly Update Functions
-- Description: Creates orchestration functions for weekly data updates after BigQuery sync

-- Main orchestration function that runs after BigQuery sync
CREATE OR REPLACE FUNCTION sqp.weekly_data_update()
RETURNS void AS $$
DECLARE
  start_time TIMESTAMP;
  end_time TIMESTAMP;
  new_asins_count INTEGER;
  updated_brands_count INTEGER;
  error_message TEXT;
BEGIN
  start_time := NOW();
  
  -- Log start of update process
  INSERT INTO sqp.data_quality_checks (
    check_type,
    check_name,
    status,
    details,
    created_at
  ) VALUES (
    'brand_update',
    'weekly_data_update_start',
    'in_progress',
    jsonb_build_object('start_time', start_time),
    NOW()
  );
  
  BEGIN
    -- Step 1: Update brand mappings for new ASINs
    PERFORM sqp.update_brand_mappings();
    
    -- Step 2: Update product titles if they've changed
    UPDATE sqp.asin_brand_mapping abm
    SET 
      product_title = apd.product_title,
      updated_at = NOW()
    FROM sqp.asin_performance_data apd
    WHERE abm.asin = apd.asin
      AND abm.product_title IS DISTINCT FROM apd.product_title
      AND apd.product_title IS NOT NULL;
    
    -- Step 3: Re-extract brands for ASINs with updated titles
    WITH updated_titles AS (
      SELECT 
        abm.asin,
        sqp.extract_brand_from_title(apd.product_title) as new_brand_name
      FROM sqp.asin_brand_mapping abm
      JOIN sqp.asin_performance_data apd ON abm.asin = apd.asin
      WHERE abm.updated_at >= NOW() - INTERVAL '5 minutes'
        AND abm.extraction_method = 'automatic'
        AND NOT abm.verified
    )
    UPDATE sqp.asin_brand_mapping abm
    SET 
      brand_id = b.id,
      confidence_score = CASE 
        WHEN b.brand_name != 'Unknown' THEN 0.75 
        ELSE 0.0 
      END,
      updated_at = NOW()
    FROM updated_titles ut
    LEFT JOIN sqp.brands b ON b.brand_name = ut.new_brand_name
    WHERE abm.asin = ut.asin
      AND abm.brand_id IS DISTINCT FROM b.id;
    
    -- Step 4: Create any new brands discovered
    INSERT INTO sqp.brands (brand_name, normalized_name, display_name)
    SELECT DISTINCT
      sqp.extract_brand_from_title(apd.product_title),
      sqp.normalize_brand_name(sqp.extract_brand_from_title(apd.product_title)),
      sqp.extract_brand_from_title(apd.product_title)
    FROM sqp.asin_performance_data apd
    LEFT JOIN sqp.brands b ON b.brand_name = sqp.extract_brand_from_title(apd.product_title)
    WHERE apd.product_title IS NOT NULL
      AND sqp.extract_brand_from_title(apd.product_title) != 'Unknown'
      AND b.id IS NULL
    ON CONFLICT (brand_name) DO NOTHING;
    
    -- Step 5: Update statistics
    SELECT COUNT(DISTINCT asin) INTO new_asins_count
    FROM sqp.asin_brand_mapping
    WHERE created_at >= start_time;
    
    SELECT COUNT(*) INTO updated_brands_count
    FROM sqp.brands
    WHERE created_at >= start_time;
    
    end_time := NOW();
    
    -- Log successful completion
    INSERT INTO sqp.data_quality_checks (
      check_type,
      check_name,
      status,
      details,
      created_at
    ) VALUES (
      'brand_update',
      'weekly_data_update_complete',
      'passed',
      jsonb_build_object(
        'start_time', start_time,
        'end_time', end_time,
        'duration_seconds', EXTRACT(EPOCH FROM (end_time - start_time)),
        'new_asins_mapped', new_asins_count,
        'new_brands_created', updated_brands_count
      ),
      NOW()
    );
    
    RAISE NOTICE 'Weekly data update completed successfully. New ASINs: %, New Brands: %', 
      new_asins_count, updated_brands_count;
    
  EXCEPTION
    WHEN OTHERS THEN
      error_message := SQLERRM;
      
      -- Log error
      INSERT INTO sqp.data_quality_checks (
        check_type,
        check_name,
        status,
        details,
        created_at
      ) VALUES (
        'brand_update',
        'weekly_data_update_error',
        'failed',
        jsonb_build_object(
          'error', error_message,
          'start_time', start_time
        ),
        NOW()
      );
      
      RAISE EXCEPTION 'Weekly data update failed: %', error_message;
  END;
END;
$$ LANGUAGE plpgsql;

-- Function to validate brand mappings
CREATE OR REPLACE FUNCTION sqp.validate_brand_mappings()
RETURNS TABLE(
  check_name TEXT,
  check_status TEXT,
  details JSONB
) AS $$
BEGIN
  -- Check for ASINs without brand mappings
  RETURN QUERY
  SELECT 
    'asins_without_brands'::TEXT,
    CASE 
      WHEN COUNT(*) = 0 THEN 'passed'
      ELSE 'warning'
    END::TEXT,
    jsonb_build_object(
      'count', COUNT(*),
      'asins', ARRAY_AGG(asin)
    )
  FROM (
    SELECT apd.asin
    FROM sqp.asin_performance_data apd
    LEFT JOIN sqp.asin_brand_mapping abm ON apd.asin = abm.asin
    WHERE abm.asin IS NULL
    LIMIT 100
  ) unmapped;
  
  -- Check for low confidence mappings
  RETURN QUERY
  SELECT 
    'low_confidence_mappings'::TEXT,
    'info'::TEXT,
    jsonb_build_object(
      'count', COUNT(*),
      'average_confidence', ROUND(AVG(confidence_score)::numeric, 2)
    )
  FROM sqp.asin_brand_mapping
  WHERE confidence_score < 0.5
    AND extraction_method = 'automatic';
  
  -- Check for brands without any ASINs
  RETURN QUERY
  SELECT 
    'brands_without_asins'::TEXT,
    CASE 
      WHEN COUNT(*) = 0 THEN 'passed'
      ELSE 'warning'
    END::TEXT,
    jsonb_build_object(
      'count', COUNT(*),
      'brands', ARRAY_AGG(brand_name)
    )
  FROM (
    SELECT b.brand_name
    FROM sqp.brands b
    LEFT JOIN sqp.asin_brand_mapping abm ON b.id = abm.brand_id
    WHERE abm.asin IS NULL
      AND b.brand_name != 'Unknown'
    LIMIT 50
  ) empty_brands;
  
  -- Check for duplicate normalized names
  RETURN QUERY
  SELECT 
    'duplicate_normalized_brands'::TEXT,
    CASE 
      WHEN COUNT(*) = 0 THEN 'passed'
      ELSE 'error'
    END::TEXT,
    jsonb_build_object(
      'count', COUNT(*),
      'normalized_names', ARRAY_AGG(DISTINCT normalized_name)
    )
  FROM (
    SELECT normalized_name
    FROM sqp.brands
    GROUP BY normalized_name
    HAVING COUNT(*) > 1
  ) duplicates;
END;
$$ LANGUAGE plpgsql;

-- Function to merge duplicate brands
CREATE OR REPLACE FUNCTION sqp.merge_brands(
  p_source_brand_id UUID,
  p_target_brand_id UUID
)
RETURNS void AS $$
DECLARE
  source_brand_name TEXT;
  target_brand_name TEXT;
  affected_asins INTEGER;
BEGIN
  -- Validate inputs
  IF p_source_brand_id = p_target_brand_id THEN
    RAISE EXCEPTION 'Source and target brand IDs cannot be the same';
  END IF;
  
  -- Get brand names for logging
  SELECT brand_name INTO source_brand_name FROM sqp.brands WHERE id = p_source_brand_id;
  SELECT brand_name INTO target_brand_name FROM sqp.brands WHERE id = p_target_brand_id;
  
  IF source_brand_name IS NULL OR target_brand_name IS NULL THEN
    RAISE EXCEPTION 'Invalid brand ID provided';
  END IF;
  
  -- Update all ASIN mappings
  UPDATE sqp.asin_brand_mapping
  SET 
    brand_id = p_target_brand_id,
    updated_at = NOW()
  WHERE brand_id = p_source_brand_id;
  
  GET DIAGNOSTICS affected_asins = ROW_COUNT;
  
  -- Update parent brand references
  UPDATE sqp.brands
  SET parent_brand_id = p_target_brand_id
  WHERE parent_brand_id = p_source_brand_id;
  
  -- Delete the source brand
  DELETE FROM sqp.brands WHERE id = p_source_brand_id;
  
  -- Log the merge
  INSERT INTO sqp.data_quality_checks (
    check_type,
    check_name,
    status,
    details,
    created_at
  ) VALUES (
    'brand_merge',
    'merge_brands',
    'completed',
    jsonb_build_object(
      'source_brand', source_brand_name,
      'target_brand', target_brand_name,
      'affected_asins', affected_asins
    ),
    NOW()
  );
  
  RAISE NOTICE 'Merged brand % into %, affecting % ASINs', 
    source_brand_name, target_brand_name, affected_asins;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh brand statistics
CREATE OR REPLACE FUNCTION sqp.refresh_brand_statistics()
RETURNS void AS $$
BEGIN
  -- Create temporary table with brand statistics
  CREATE TEMP TABLE temp_brand_stats AS
  SELECT 
    b.id as brand_id,
    COUNT(DISTINCT abm.asin) as asin_count,
    COUNT(DISTINCT sp.search_query) as unique_queries,
    SUM(sp.impressions_sum) as total_impressions,
    SUM(sp.clicks_sum) as total_clicks,
    SUM(sp.cart_adds_sum) as total_cart_adds,
    SUM(sp.purchases_sum) as total_purchases,
    AVG(sp.clicks_sum::FLOAT / NULLIF(sp.impressions_sum, 0)) as avg_ctr,
    AVG(sp.purchases_sum::FLOAT / NULLIF(sp.clicks_sum, 0)) as avg_cvr,
    MAX(sp.end_date) as last_data_date
  FROM sqp.brands b
  JOIN sqp.asin_brand_mapping abm ON b.id = abm.brand_id
  LEFT JOIN sqp.search_query_performance sp ON abm.asin = sp.asin
  GROUP BY b.id;
  
  -- Update brands table with statistics (if column exists)
  -- This is optional - only if you add stats columns to brands table
  
  -- Log statistics summary
  INSERT INTO sqp.data_quality_checks (
    check_type,
    check_name,
    status,
    details,
    created_at
  ) VALUES (
    'brand_stats',
    'refresh_brand_statistics',
    'completed',
    (
      SELECT jsonb_build_object(
        'total_brands', COUNT(*),
        'brands_with_data', COUNT(*) FILTER (WHERE asin_count > 0),
        'total_asins', SUM(asin_count),
        'avg_asins_per_brand', ROUND(AVG(asin_count), 2)
      )
      FROM temp_brand_stats
    ),
    NOW()
  );
  
  DROP TABLE temp_brand_stats;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON FUNCTION sqp.weekly_data_update IS 'Main orchestration function that runs after BigQuery sync to update brand mappings';
COMMENT ON FUNCTION sqp.validate_brand_mappings IS 'Validates brand mapping data quality and returns check results';
COMMENT ON FUNCTION sqp.merge_brands IS 'Merges duplicate brands by reassigning all ASINs to target brand';
COMMENT ON FUNCTION sqp.refresh_brand_statistics IS 'Calculates and logs brand performance statistics';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION sqp.weekly_data_update TO service_role;
GRANT EXECUTE ON FUNCTION sqp.validate_brand_mappings TO service_role;
GRANT EXECUTE ON FUNCTION sqp.merge_brands TO service_role;
GRANT EXECUTE ON FUNCTION sqp.refresh_brand_statistics TO service_role;