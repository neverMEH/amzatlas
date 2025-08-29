-- Migration: Create Brand Management Tables
-- Description: Creates tables for brand extraction, mapping, and product type categorization

-- Create brands table
CREATE TABLE IF NOT EXISTS sqp.brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_name VARCHAR(255) NOT NULL UNIQUE,
  normalized_name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  parent_brand_id UUID REFERENCES sqp.brands(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for brands table
CREATE INDEX idx_brands_normalized ON sqp.brands(normalized_name);
CREATE INDEX idx_brands_parent ON sqp.brands(parent_brand_id) WHERE parent_brand_id IS NOT NULL;
CREATE INDEX idx_brands_active ON sqp.brands(is_active) WHERE is_active = true;

-- Create asin_brand_mapping table
CREATE TABLE IF NOT EXISTS sqp.asin_brand_mapping (
  asin VARCHAR(20) PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES sqp.brands(id),
  product_title TEXT NOT NULL,
  extraction_method VARCHAR(50) NOT NULL CHECK (extraction_method IN ('automatic', 'manual', 'override')),
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for asin_brand_mapping table
CREATE INDEX idx_asin_brand_mapping_brand ON sqp.asin_brand_mapping(brand_id);
CREATE INDEX idx_asin_brand_mapping_confidence ON sqp.asin_brand_mapping(confidence_score) WHERE extraction_method = 'automatic';
CREATE INDEX idx_asin_brand_mapping_verified ON sqp.asin_brand_mapping(verified) WHERE verified = true;

-- Create product_type_mapping table
CREATE TABLE IF NOT EXISTS sqp.product_type_mapping (
  asin VARCHAR(20) PRIMARY KEY,
  product_type VARCHAR(100) NOT NULL,
  product_category VARCHAR(100),
  extraction_method VARCHAR(50) NOT NULL CHECK (extraction_method IN ('automatic', 'manual')),
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for product_type_mapping table
CREATE INDEX idx_product_type_mapping_type ON sqp.product_type_mapping(product_type);
CREATE INDEX idx_product_type_mapping_category ON sqp.product_type_mapping(product_category) WHERE product_category IS NOT NULL;

-- Create update triggers for timestamp columns
CREATE OR REPLACE FUNCTION sqp.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to all brand management tables
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON sqp.brands
    FOR EACH ROW EXECUTE FUNCTION sqp.update_updated_at_column();

CREATE TRIGGER update_asin_brand_mapping_updated_at BEFORE UPDATE ON sqp.asin_brand_mapping
    FOR EACH ROW EXECUTE FUNCTION sqp.update_updated_at_column();

CREATE TRIGGER update_product_type_mapping_updated_at BEFORE UPDATE ON sqp.product_type_mapping
    FOR EACH ROW EXECUTE FUNCTION sqp.update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE sqp.brands IS 'Master table for all brands extracted from product titles';
COMMENT ON TABLE sqp.asin_brand_mapping IS 'Maps ASINs to their respective brands with confidence scores';
COMMENT ON TABLE sqp.product_type_mapping IS 'Maps ASINs to product types/categories';

COMMENT ON COLUMN sqp.brands.normalized_name IS 'Lowercase, cleaned version of brand name for matching';
COMMENT ON COLUMN sqp.brands.parent_brand_id IS 'Reference to parent brand for sub-brands';
COMMENT ON COLUMN sqp.asin_brand_mapping.extraction_method IS 'How the brand was identified: automatic (NLP), manual (user), or override';
COMMENT ON COLUMN sqp.asin_brand_mapping.confidence_score IS 'Confidence in the brand extraction (0-1)';
COMMENT ON COLUMN sqp.asin_brand_mapping.verified IS 'Whether the mapping has been manually verified';

-- Grant appropriate permissions
GRANT SELECT ON sqp.brands TO authenticated;
GRANT SELECT ON sqp.asin_brand_mapping TO authenticated;
GRANT SELECT ON sqp.product_type_mapping TO authenticated;

-- Allow service role to manage these tables
GRANT ALL ON sqp.brands TO service_role;
GRANT ALL ON sqp.asin_brand_mapping TO service_role;
GRANT ALL ON sqp.product_type_mapping TO service_role;