-- Migration: 049a_fix_brand_schema_references.sql
-- Description: Fix schema references - move brand tables from sqp to public schema
-- Date: 2025-09-08
-- Author: Claude

-- First, let's check if brands exists in sqp schema and move it to public
DO $$
BEGIN
  -- Check if sqp.brands exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'sqp' AND table_name = 'brands'
  ) THEN
    -- Create public schema version of brands if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'brands'
    ) THEN
      -- Create the table in public schema
      CREATE TABLE public.brands (LIKE sqp.brands INCLUDING ALL);
      
      -- Copy data from sqp to public
      INSERT INTO public.brands SELECT * FROM sqp.brands;
      
      -- Create foreign key reference for parent_brand_id
      ALTER TABLE public.brands 
        ADD CONSTRAINT brands_parent_brand_id_fkey 
        FOREIGN KEY (parent_brand_id) 
        REFERENCES public.brands(id);
    END IF;
  END IF;

  -- Check if sqp.asin_brand_mapping exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'sqp' AND table_name = 'asin_brand_mapping'
  ) THEN
    -- Create public schema version if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'asin_brand_mapping'
    ) THEN
      -- Create the table structure
      CREATE TABLE public.asin_brand_mapping (
        asin VARCHAR(20) PRIMARY KEY,
        brand_id UUID NOT NULL,
        product_title TEXT NOT NULL,
        extraction_method VARCHAR(50) NOT NULL CHECK (extraction_method IN ('automatic', 'manual', 'override')),
        confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
        verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Copy data from sqp to public
      INSERT INTO public.asin_brand_mapping 
      SELECT * FROM sqp.asin_brand_mapping;
      
      -- Add foreign key after data is copied
      ALTER TABLE public.asin_brand_mapping
        ADD CONSTRAINT asin_brand_mapping_brand_id_fkey 
        FOREIGN KEY (brand_id) 
        REFERENCES public.brands(id);
      
      -- Recreate indexes
      CREATE INDEX idx_asin_brand_mapping_brand ON public.asin_brand_mapping(brand_id);
      CREATE INDEX idx_asin_brand_mapping_confidence ON public.asin_brand_mapping(confidence_score) 
        WHERE extraction_method = 'automatic';
      CREATE INDEX idx_asin_brand_mapping_verified ON public.asin_brand_mapping(verified) 
        WHERE verified = true;
    END IF;
  END IF;
END $$;

-- If neither schema has the tables, create them in public
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_name VARCHAR(255) NOT NULL UNIQUE,
  normalized_name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  parent_brand_id UUID REFERENCES public.brands(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for brands table
CREATE INDEX IF NOT EXISTS idx_brands_normalized ON public.brands(normalized_name);
CREATE INDEX IF NOT EXISTS idx_brands_parent ON public.brands(parent_brand_id) WHERE parent_brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brands_active ON public.brands(is_active) WHERE is_active = true;

-- Create asin_brand_mapping table
CREATE TABLE IF NOT EXISTS public.asin_brand_mapping (
  asin VARCHAR(20) PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brands(id),
  product_title TEXT NOT NULL,
  extraction_method VARCHAR(50) NOT NULL CHECK (extraction_method IN ('automatic', 'manual', 'override')),
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for asin_brand_mapping table
CREATE INDEX IF NOT EXISTS idx_asin_brand_mapping_brand ON public.asin_brand_mapping(brand_id);
CREATE INDEX IF NOT EXISTS idx_asin_brand_mapping_confidence ON public.asin_brand_mapping(confidence_score) 
  WHERE extraction_method = 'automatic';
CREATE INDEX IF NOT EXISTS idx_asin_brand_mapping_verified ON public.asin_brand_mapping(verified) 
  WHERE verified = true;

-- Grant permissions
GRANT ALL ON public.brands TO authenticated;
GRANT ALL ON public.asin_brand_mapping TO authenticated;

-- Enable RLS
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asin_brand_mapping ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow read access to brands" ON public.brands
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to asin mappings" ON public.asin_brand_mapping
  FOR SELECT USING (true);

-- Insert default brand if none exist
INSERT INTO public.brands (
  brand_name,
  normalized_name,  
  display_name,
  is_active
)
SELECT 
  'Work Sharp',
  'work_sharp',
  'Work Sharp',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.brands WHERE brand_name = 'Work Sharp'
);

-- Create views to maintain compatibility with sqp schema references
CREATE OR REPLACE VIEW sqp.brands_view AS SELECT * FROM public.brands;
CREATE OR REPLACE VIEW sqp.asin_brand_mapping_view AS SELECT * FROM public.asin_brand_mapping;

-- Grant permissions on views
GRANT SELECT ON sqp.brands_view TO authenticated;
GRANT SELECT ON sqp.asin_brand_mapping_view TO authenticated;