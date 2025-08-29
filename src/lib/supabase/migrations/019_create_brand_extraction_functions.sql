-- Migration: Create Brand Extraction Functions
-- Description: Creates PostgreSQL functions for extracting brands and product types from titles

-- Function to extract brand from product title
CREATE OR REPLACE FUNCTION sqp.extract_brand_from_title(product_title TEXT)
RETURNS TEXT AS $$
DECLARE
  brand_name TEXT;
  common_patterns TEXT[] := ARRAY[
    '^([A-Z][A-Za-z0-9\-&\s]+)\s+(?:by|from|Brand:|®|™)',  -- "Brand by", "Brand from", etc.
    '^([A-Z][A-Za-z0-9\-&]+)\s+[A-Z]',                     -- Brand followed by product name
    '^([A-Z][A-Za-z0-9\-&]+)\s*[-–—]',                     -- Brand followed by dash
    '^([A-Z][A-Za-z0-9\-&]+)\s*\|',                        -- Brand followed by pipe
    '^([A-Z][A-Za-z0-9\-&]+)\s*:',                         -- Brand followed by colon
    '^\[([A-Z][A-Za-z0-9\-&\s]+)\]'                        -- Brand in brackets
  ];
  pattern TEXT;
BEGIN
  -- Handle null or empty input
  IF product_title IS NULL OR TRIM(product_title) = '' THEN
    RETURN 'Unknown';
  END IF;
  
  -- Clean the title
  product_title := TRIM(product_title);
  
  -- Try each pattern
  FOREACH pattern IN ARRAY common_patterns LOOP
    brand_name := (regexp_match(product_title, pattern))[1];
    IF brand_name IS NOT NULL THEN
      RETURN TRIM(brand_name);
    END IF;
  END LOOP;
  
  -- Fallback: First word if it starts with capital letter
  brand_name := (regexp_match(product_title, '^([A-Z][A-Za-z0-9\-&]+)'))[1];
  RETURN COALESCE(TRIM(brand_name), 'Unknown');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to normalize brand name
CREATE OR REPLACE FUNCTION sqp.normalize_brand_name(brand_name TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Handle null input
  IF brand_name IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Remove special characters, convert to lowercase, trim spaces
  RETURN LOWER(TRIM(regexp_replace(brand_name, '[^A-Za-z0-9\s]', '', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to extract product type from product title
CREATE OR REPLACE FUNCTION sqp.extract_product_type(product_title TEXT)
RETURNS TEXT AS $$
DECLARE
  title_lower TEXT;
  product_type TEXT;
BEGIN
  -- Handle null input
  IF product_title IS NULL THEN
    RETURN 'Other';
  END IF;
  
  title_lower := LOWER(product_title);
  
  -- Define product type mappings based on keywords
  -- Customize this based on your actual product catalog
  IF title_lower ~ '(headphone|earphone|earbud|airpod)' THEN
    product_type := 'Audio';
  ELSIF title_lower ~ '(laptop|notebook|computer|desktop|chromebook|macbook)' THEN
    product_type := 'Computers';
  ELSIF title_lower ~ '(phone|mobile|smartphone|iphone|android|galaxy)' THEN
    product_type := 'Mobile Devices';
  ELSIF title_lower ~ '(tablet|ipad|kindle|fire hd|galaxy tab)' THEN
    product_type := 'Tablets';
  ELSIF title_lower ~ '(camera|webcam|gopro|dslr|mirrorless)' THEN
    product_type := 'Cameras';
  ELSIF title_lower ~ '(speaker|soundbar|echo|alexa|homepod|sonos)' THEN
    product_type := 'Speakers';
  ELSIF title_lower ~ '(watch|smartwatch|fitness tracker|fitbit|garmin)' THEN
    product_type := 'Wearables';
  ELSIF title_lower ~ '(tv|television|monitor|display|screen)' THEN
    product_type := 'Displays';
  ELSIF title_lower ~ '(router|modem|network|wifi|mesh|ethernet)' THEN
    product_type := 'Networking';
  ELSIF title_lower ~ '(keyboard|mouse|controller|gamepad|joystick)' THEN
    product_type := 'Accessories';
  ELSIF title_lower ~ '(battery|charger|power bank|adapter|cable)' THEN
    product_type := 'Power & Cables';
  ELSIF title_lower ~ '(case|cover|protector|sleeve|bag)' THEN
    product_type := 'Cases & Protection';
  ELSIF title_lower ~ '(memory|ram|ssd|hard drive|storage|usb drive)' THEN
    product_type := 'Storage';
  ELSIF title_lower ~ '(printer|scanner|ink|toner)' THEN
    product_type := 'Printers & Scanners';
  ELSIF title_lower ~ '(gaming|playstation|xbox|nintendo|console)' THEN
    product_type := 'Gaming';
  ELSE
    product_type := 'Other';
  END IF;
  
  RETURN product_type;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get or create brand
CREATE OR REPLACE FUNCTION sqp.get_or_create_brand(
  p_brand_name TEXT,
  p_normalized_name TEXT DEFAULT NULL,
  p_display_name TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_brand_id UUID;
  v_normalized_name TEXT;
  v_display_name TEXT;
BEGIN
  -- Prepare normalized name
  v_normalized_name := COALESCE(p_normalized_name, sqp.normalize_brand_name(p_brand_name));
  v_display_name := COALESCE(p_display_name, p_brand_name);
  
  -- Try to find existing brand
  SELECT id INTO v_brand_id
  FROM sqp.brands
  WHERE brand_name = p_brand_name
  LIMIT 1;
  
  -- If not found, create new brand
  IF v_brand_id IS NULL THEN
    INSERT INTO sqp.brands (brand_name, normalized_name, display_name)
    VALUES (p_brand_name, v_normalized_name, v_display_name)
    ON CONFLICT (brand_name) DO UPDATE
      SET updated_at = NOW()
    RETURNING id INTO v_brand_id;
  END IF;
  
  RETURN v_brand_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update brand mappings for new ASINs
CREATE OR REPLACE FUNCTION sqp.update_brand_mappings()
RETURNS void AS $$
DECLARE
  new_asins_count INTEGER;
  v_brand_name TEXT;
  v_brand_id UUID;
BEGIN
  -- Count new ASINs that need brand mapping
  SELECT COUNT(DISTINCT apd.asin) INTO new_asins_count
  FROM sqp.asin_performance_data apd
  LEFT JOIN sqp.asin_brand_mapping abm ON apd.asin = abm.asin
  WHERE abm.asin IS NULL;
  
  IF new_asins_count > 0 THEN
    RAISE NOTICE 'Found % new ASINs to map to brands', new_asins_count;
    
    -- Process each new ASIN
    FOR v_brand_name IN
      SELECT DISTINCT sqp.extract_brand_from_title(apd.product_title)
      FROM sqp.asin_performance_data apd
      LEFT JOIN sqp.asin_brand_mapping abm ON apd.asin = abm.asin
      WHERE abm.asin IS NULL
        AND apd.product_title IS NOT NULL
        AND sqp.extract_brand_from_title(apd.product_title) != 'Unknown'
    LOOP
      -- Get or create brand
      v_brand_id := sqp.get_or_create_brand(
        v_brand_name,
        sqp.normalize_brand_name(v_brand_name),
        v_brand_name
      );
    END LOOP;
    
    -- Map new ASINs to brands
    INSERT INTO sqp.asin_brand_mapping (asin, brand_id, product_title, extraction_method, confidence_score)
    SELECT 
      apd.asin,
      COALESCE(
        b.id,
        (SELECT id FROM sqp.brands WHERE brand_name = 'Unknown' LIMIT 1)
      ),
      apd.product_title,
      'automatic',
      CASE 
        WHEN b.id IS NOT NULL THEN 0.75 
        ELSE 0.0 
      END
    FROM sqp.asin_performance_data apd
    LEFT JOIN sqp.asin_brand_mapping abm ON apd.asin = abm.asin
    LEFT JOIN sqp.brands b ON b.brand_name = sqp.extract_brand_from_title(apd.product_title)
    WHERE abm.asin IS NULL
    ON CONFLICT (asin) DO NOTHING;
    
    -- Update product type mappings for new ASINs
    INSERT INTO sqp.product_type_mapping (asin, product_type, extraction_method, confidence_score)
    SELECT 
      apd.asin,
      sqp.extract_product_type(apd.product_title),
      'automatic',
      0.75
    FROM sqp.asin_performance_data apd
    LEFT JOIN sqp.product_type_mapping ptm ON apd.asin = ptm.asin
    WHERE ptm.asin IS NULL
      AND apd.product_title IS NOT NULL
    ON CONFLICT (asin) DO NOTHING;
  END IF;
  
  RAISE NOTICE 'Brand mappings updated successfully';
END;
$$ LANGUAGE plpgsql;

-- Note: Indexes on function results will be created in migration 021 after product_title column exists

-- Add comments for documentation
COMMENT ON FUNCTION sqp.extract_brand_from_title IS 'Extracts brand name from product title using regex patterns';
COMMENT ON FUNCTION sqp.normalize_brand_name IS 'Normalizes brand name for consistent matching';
COMMENT ON FUNCTION sqp.extract_product_type IS 'Categorizes products based on title keywords';
COMMENT ON FUNCTION sqp.get_or_create_brand IS 'Gets existing brand or creates new one if not found';
COMMENT ON FUNCTION sqp.update_brand_mappings IS 'Updates brand mappings for any new ASINs after sync';