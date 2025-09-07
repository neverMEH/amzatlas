-- Migration: Add Post-Sync Brand Extraction Trigger
-- Description: Automatically run brand extraction after data sync

-- Create a trigger function that runs after ASIN performance data is inserted or updated
CREATE OR REPLACE FUNCTION sqp.trigger_brand_extraction_after_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if product_title was actually changed
  IF (TG_OP = 'INSERT' AND NEW.product_title IS NOT NULL) OR 
     (TG_OP = 'UPDATE' AND NEW.product_title IS DISTINCT FROM OLD.product_title) THEN
    
    -- Extract brand from the product title
    DECLARE
      v_brand_name TEXT;
      v_brand_id UUID;
    BEGIN
      -- Extract brand name using the existing function
      v_brand_name := sqp.extract_brand_from_title(NEW.product_title);
      
      -- Get or create brand
      IF v_brand_name != 'Unknown' THEN
        v_brand_id := sqp.get_or_create_brand(
          v_brand_name,
          sqp.normalize_brand_name(v_brand_name),
          v_brand_name
        );
        
        -- Create or update ASIN-brand mapping
        INSERT INTO sqp.asin_brand_mapping (
          asin, 
          brand_id, 
          product_title, 
          extraction_method, 
          confidence_score
        )
        VALUES (
          NEW.asin,
          v_brand_id,
          NEW.product_title,
          'automatic',
          0.75
        )
        ON CONFLICT (asin) DO UPDATE
        SET 
          brand_id = EXCLUDED.brand_id,
          product_title = EXCLUDED.product_title,
          confidence_score = EXCLUDED.confidence_score,
          updated_at = NOW()
        WHERE 
          -- Only update if the new brand is different or confidence is higher
          asin_brand_mapping.brand_id != EXCLUDED.brand_id OR
          asin_brand_mapping.confidence_score < EXCLUDED.confidence_score;
        
        -- Also update product type mapping
        INSERT INTO sqp.product_type_mapping (
          asin,
          product_type,
          extraction_method,
          confidence_score
        )
        VALUES (
          NEW.asin,
          sqp.extract_product_type(NEW.product_title),
          'automatic',
          0.75
        )
        ON CONFLICT (asin) DO UPDATE
        SET 
          product_type = EXCLUDED.product_type,
          confidence_score = EXCLUDED.confidence_score,
          updated_at = NOW()
        WHERE 
          -- Only update if confidence is higher
          product_type_mapping.confidence_score < EXCLUDED.confidence_score;
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on asin_performance_data table
DROP TRIGGER IF EXISTS auto_extract_brand_on_sync ON sqp.asin_performance_data;
CREATE TRIGGER auto_extract_brand_on_sync
  AFTER INSERT OR UPDATE OF product_title ON sqp.asin_performance_data
  FOR EACH ROW
  EXECUTE FUNCTION sqp.trigger_brand_extraction_after_sync();

-- Create a function to run brand extraction for all existing ASINs with product titles
CREATE OR REPLACE FUNCTION sqp.run_brand_extraction_for_existing_asins()
RETURNS void AS $$
DECLARE
  v_processed INTEGER := 0;
  v_skipped INTEGER := 0;
BEGIN
  -- Process ASINs that have product titles but no brand mapping
  FOR v_processed IN
    SELECT COUNT(*)
    FROM sqp.asin_performance_data apd
    LEFT JOIN sqp.asin_brand_mapping abm ON apd.asin = abm.asin
    WHERE apd.product_title IS NOT NULL
      AND abm.asin IS NULL
  LOOP
    -- The trigger will handle the brand extraction
    UPDATE sqp.asin_performance_data
    SET updated_at = NOW()
    WHERE asin IN (
      SELECT apd.asin
      FROM sqp.asin_performance_data apd
      LEFT JOIN sqp.asin_brand_mapping abm ON apd.asin = abm.asin
      WHERE apd.product_title IS NOT NULL
        AND abm.asin IS NULL
    );
  END LOOP;
  
  RAISE NOTICE 'Brand extraction completed. Processed: %, Already mapped: %', 
    v_processed, 
    (SELECT COUNT(DISTINCT asin) FROM sqp.asin_brand_mapping);
END;
$$ LANGUAGE plpgsql;

-- Add index to speed up brand lookups
CREATE INDEX IF NOT EXISTS idx_asin_brand_mapping_confidence 
ON sqp.asin_brand_mapping(confidence_score DESC);

-- Add comments
COMMENT ON FUNCTION sqp.trigger_brand_extraction_after_sync IS 
'Automatically extracts brand and product type when product_title is inserted or updated';

COMMENT ON FUNCTION sqp.run_brand_extraction_for_existing_asins IS 
'One-time function to extract brands for all existing ASINs with product titles';