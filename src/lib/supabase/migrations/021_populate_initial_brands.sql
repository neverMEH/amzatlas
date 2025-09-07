-- Migration: Populate Initial Brands and Mappings
-- Description: Initial population of brands and product types from existing data

-- First, ensure we have an 'Unknown' brand for unmapped products
INSERT INTO sqp.brands (brand_name, normalized_name, display_name, is_active)
VALUES ('Unknown', 'unknown', 'Unknown Brand', true)
ON CONFLICT (brand_name) DO NOTHING;

-- Step 1: Extract and insert unique brands from existing ASIN data
-- This will only process ASINs that have product titles
INSERT INTO sqp.brands (brand_name, normalized_name, display_name)
SELECT DISTINCT ON (normalized_name)
  extracted_brand as brand_name,
  sqp.normalize_brand_name(extracted_brand) as normalized_name,
  extracted_brand as display_name
FROM (
  SELECT DISTINCT 
    sqp.extract_brand_from_title(product_title) as extracted_brand
  FROM sqp.asin_performance_data
  WHERE product_title IS NOT NULL
    AND product_title != ''
) extracted
WHERE extracted_brand != 'Unknown'
  AND extracted_brand IS NOT NULL
ON CONFLICT (brand_name) DO NOTHING;

-- Log the number of brands created
DO $$
DECLARE
  brand_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO brand_count FROM sqp.brands WHERE brand_name != 'Unknown';
  RAISE NOTICE 'Created % unique brands from product titles', brand_count;
END $$;

-- Step 2: Map ASINs to brands based on product titles
INSERT INTO sqp.asin_brand_mapping (asin, brand_id, product_title, extraction_method, confidence_score)
SELECT 
  apd.asin,
  COALESCE(
    b.id,
    (SELECT id FROM sqp.brands WHERE brand_name = 'Unknown' LIMIT 1)
  ) as brand_id,
  apd.product_title,
  'automatic' as extraction_method,
  CASE 
    WHEN b.id IS NOT NULL AND sqp.extract_brand_from_title(apd.product_title) != 'Unknown' THEN 0.75
    ELSE 0.0
  END as confidence_score
FROM sqp.asin_performance_data apd
LEFT JOIN sqp.brands b ON b.brand_name = sqp.extract_brand_from_title(apd.product_title)
WHERE apd.product_title IS NOT NULL
ON CONFLICT (asin) DO NOTHING;

-- Step 3: Handle ASINs without product titles
-- Map them to 'Unknown' brand with zero confidence
INSERT INTO sqp.asin_brand_mapping (asin, brand_id, product_title, extraction_method, confidence_score, verified)
SELECT 
  apd.asin,
  (SELECT id FROM sqp.brands WHERE brand_name = 'Unknown' LIMIT 1),
  COALESCE(apd.product_title, 'No title available'),
  'automatic',
  0.0,
  false
FROM sqp.asin_performance_data apd
WHERE NOT EXISTS (
  SELECT 1 FROM sqp.asin_brand_mapping abm WHERE abm.asin = apd.asin
)
ON CONFLICT (asin) DO NOTHING;

-- Step 4: Populate product type mappings
INSERT INTO sqp.product_type_mapping (asin, product_type, extraction_method, confidence_score)
SELECT 
  apd.asin,
  sqp.extract_product_type(apd.product_title),
  'automatic',
  CASE 
    WHEN sqp.extract_product_type(apd.product_title) != 'Other' THEN 0.75
    ELSE 0.5
  END
FROM sqp.asin_performance_data apd
WHERE apd.product_title IS NOT NULL
ON CONFLICT (asin) DO NOTHING;

-- Log the mapping results
DO $$
DECLARE
  total_asins INTEGER;
  mapped_asins INTEGER;
  unknown_asins INTEGER;
  product_types INTEGER;
BEGIN
  SELECT COUNT(DISTINCT asin) INTO total_asins FROM sqp.asin_performance_data;
  SELECT COUNT(*) INTO mapped_asins FROM sqp.asin_brand_mapping WHERE confidence_score > 0;
  SELECT COUNT(*) INTO unknown_asins FROM sqp.asin_brand_mapping WHERE confidence_score = 0;
  SELECT COUNT(DISTINCT product_type) INTO product_types FROM sqp.product_type_mapping;
  
  RAISE NOTICE 'Brand mapping complete:';
  RAISE NOTICE '  Total ASINs: %', total_asins;
  RAISE NOTICE '  ASINs mapped to brands: %', mapped_asins;
  RAISE NOTICE '  ASINs with unknown brand: %', unknown_asins;
  RAISE NOTICE '  Unique product types identified: %', product_types;
END $$;

-- Create some common brand groupings for better organization
-- This is optional but helps with brand hierarchy
DO $$
BEGIN
  -- Example: Group variations of common brands
  -- Amazon brands
  UPDATE sqp.brands 
  SET parent_brand_id = (SELECT id FROM sqp.brands WHERE brand_name = 'Amazon' LIMIT 1)
  WHERE normalized_name IN ('amazon basics', 'amazonbasics', 'amazon essentials')
    AND brand_name != 'Amazon';
  
  -- Apple brands
  UPDATE sqp.brands 
  SET parent_brand_id = (SELECT id FROM sqp.brands WHERE brand_name = 'Apple' LIMIT 1)
  WHERE normalized_name IN ('apple inc', 'apple computer')
    AND brand_name != 'Apple';
  
  -- Samsung brands
  UPDATE sqp.brands 
  SET parent_brand_id = (SELECT id FROM sqp.brands WHERE brand_name = 'Samsung' LIMIT 1)
  WHERE normalized_name IN ('samsung electronics', 'samsung galaxy')
    AND brand_name != 'Samsung';
END $$;

-- Create indexes on function results (moved from migration 019)
CREATE INDEX IF NOT EXISTS idx_asin_performance_data_brand 
ON sqp.asin_performance_data ((sqp.extract_brand_from_title(product_title)))
WHERE product_title IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_asin_performance_data_product_type 
ON sqp.asin_performance_data ((sqp.extract_product_type(product_title)))
WHERE product_title IS NOT NULL;

-- Analyze tables for query optimization
ANALYZE sqp.brands;
ANALYZE sqp.asin_brand_mapping;
ANALYZE sqp.product_type_mapping;