-- Migration: 049_create_brand_hierarchy_tables.sql
-- Description: Create tables for brand hierarchy and extraction rules
-- Date: 2025-09-08
-- Author: Claude

-- Create brand_hierarchy table for parent/child relationships
CREATE TABLE IF NOT EXISTS public.brand_hierarchy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  child_brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) DEFAULT 'subsidiary',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  -- Ensure no duplicate relationships
  UNIQUE(parent_brand_id, child_brand_id),
  -- Prevent self-referential relationships
  CHECK (parent_brand_id != child_brand_id)
);

-- Create indexes for performance
CREATE INDEX idx_brand_hierarchy_parent ON public.brand_hierarchy(parent_brand_id);
CREATE INDEX idx_brand_hierarchy_child ON public.brand_hierarchy(child_brand_id);
CREATE INDEX idx_brand_hierarchy_active ON public.brand_hierarchy(is_active) WHERE is_active = true;

-- Create brand_extraction_rules table for pattern matching
CREATE TABLE IF NOT EXISTS public.brand_extraction_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('exact', 'contains', 'regex', 'prefix', 'suffix')),
  pattern VARCHAR(500) NOT NULL,
  priority INTEGER DEFAULT 0,
  is_case_sensitive BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  confidence_threshold NUMERIC(3,2) DEFAULT 0.80 CHECK (confidence_threshold >= 0 AND confidence_threshold <= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  created_by UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Ensure unique patterns per brand for same rule type
  UNIQUE(brand_id, rule_type, pattern)
);

-- Create indexes for extraction rules
CREATE INDEX idx_extraction_rules_brand ON public.brand_extraction_rules(brand_id);
CREATE INDEX idx_extraction_rules_active ON public.brand_extraction_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_extraction_rules_priority ON public.brand_extraction_rules(priority DESC);

-- Create trigram index only if pg_trgm extension exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE INDEX IF NOT EXISTS idx_extraction_rules_pattern_gin 
      ON public.brand_extraction_rules USING gin(pattern gin_trgm_ops);
  ELSE
    -- Fallback to regular btree index if trigram not available
    CREATE INDEX IF NOT EXISTS idx_extraction_rules_pattern 
      ON public.brand_extraction_rules(pattern);
  END IF;
END $$;

-- Update brands table with new columns
ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS brand_color VARCHAR(7),
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS website_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS extraction_confidence NUMERIC(3,2);

-- Update asin_brand_mapping with extraction metadata
ALTER TABLE public.asin_brand_mapping
ADD COLUMN IF NOT EXISTS extraction_rule_id UUID REFERENCES public.brand_extraction_rules(id),
ADD COLUMN IF NOT EXISTS extraction_confidence NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS extraction_method VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS verified_by UUID,
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- Create a history table for brand mapping changes
CREATE TABLE IF NOT EXISTS public.asin_brand_mapping_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asin VARCHAR(20) NOT NULL,
  old_brand_id UUID REFERENCES public.brands(id),
  new_brand_id UUID REFERENCES public.brands(id),
  change_reason VARCHAR(200),
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for history lookups
CREATE INDEX idx_brand_mapping_history_asin ON public.asin_brand_mapping_history(asin);
CREATE INDEX idx_brand_mapping_history_date ON public.asin_brand_mapping_history(changed_at);

-- Create update trigger for brands table
CREATE OR REPLACE FUNCTION update_brands_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_brands_timestamp
BEFORE UPDATE ON public.brands
FOR EACH ROW
EXECUTE FUNCTION update_brands_updated_at();

-- Create update trigger for brand_hierarchy
CREATE TRIGGER update_brand_hierarchy_timestamp
BEFORE UPDATE ON public.brand_hierarchy
FOR EACH ROW
EXECUTE FUNCTION update_brands_updated_at();

-- Create update trigger for brand_extraction_rules
CREATE TRIGGER update_extraction_rules_timestamp
BEFORE UPDATE ON public.brand_extraction_rules
FOR EACH ROW
EXECUTE FUNCTION update_brands_updated_at();

-- Grant necessary permissions
GRANT ALL ON public.brand_hierarchy TO authenticated;
GRANT ALL ON public.brand_extraction_rules TO authenticated;
GRANT ALL ON public.asin_brand_mapping_history TO authenticated;

-- Enable RLS
ALTER TABLE public.brand_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_extraction_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asin_brand_mapping_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for read access
CREATE POLICY "Allow read access to brand_hierarchy" ON public.brand_hierarchy
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to extraction_rules" ON public.brand_extraction_rules
  FOR SELECT USING (true);

CREATE POLICY "Allow read access to mapping_history" ON public.asin_brand_mapping_history
  FOR SELECT USING (true);

-- Add comments for documentation
COMMENT ON TABLE public.brand_hierarchy IS 'Stores parent-child relationships between brands';
COMMENT ON TABLE public.brand_extraction_rules IS 'Pattern matching rules for automatic brand extraction from product titles';
COMMENT ON TABLE public.asin_brand_mapping_history IS 'Audit trail for ASIN to brand mapping changes';
COMMENT ON COLUMN public.brand_extraction_rules.rule_type IS 'Type of pattern matching: exact, contains, regex, prefix, suffix';
COMMENT ON COLUMN public.brand_extraction_rules.confidence_threshold IS 'Minimum confidence score required for automatic mapping';
COMMENT ON COLUMN public.brands.extraction_confidence IS 'Average confidence score from all extraction rules';