-- Migration: Create Brand Optimization Indexes
-- Description: Creates indexes and optimizations for efficient brand-based filtering

-- Note: Core indexes will be created after missing columns are added in migration 023a

-- Composite indexes for brand + date range queries
CREATE INDEX IF NOT EXISTS idx_asin_brand_mapping_composite 
ON sqp.asin_brand_mapping (brand_id, asin) 
INCLUDE (confidence_score, verified);

CREATE INDEX IF NOT EXISTS idx_brands_hierarchy 
ON sqp.brands (parent_brand_id, id) 
WHERE parent_brand_id IS NULL;

-- Indexes for product type filtering
CREATE INDEX IF NOT EXISTS idx_product_type_mapping_composite 
ON sqp.product_type_mapping (product_type, asin);

CREATE INDEX IF NOT EXISTS idx_product_type_category 
ON sqp.product_type_mapping (product_category, product_type) 
WHERE product_category IS NOT NULL;

-- Text search indexes for brand and product names
CREATE INDEX IF NOT EXISTS idx_brands_search 
ON sqp.brands USING gin(to_tsvector('english', brand_name || ' ' || display_name));

CREATE INDEX IF NOT EXISTS idx_product_title_search 
ON sqp.asin_brand_mapping USING gin(to_tsvector('english', product_title));

-- Note: Materialized views will be created in migration 023c after all columns exist

-- Create basic brand hierarchy view (without performance metrics for now)
CREATE OR REPLACE VIEW sqp.brand_hierarchy AS
WITH RECURSIVE brand_tree AS (
  -- Base case: top-level brands
  SELECT 
    id,
    brand_name,
    display_name,
    parent_brand_id,
    0 as level,
    ARRAY[id] as path,
    id as root_brand_id
  FROM sqp.brands
  WHERE parent_brand_id IS NULL
  
  UNION ALL
  
  -- Recursive case: child brands
  SELECT 
    b.id,
    b.brand_name,
    b.display_name,
    b.parent_brand_id,
    bt.level + 1,
    bt.path || b.id,
    bt.root_brand_id
  FROM sqp.brands b
  JOIN brand_tree bt ON b.parent_brand_id = bt.id
)
SELECT * FROM brand_tree;

-- Create function for efficient brand filtering
CREATE OR REPLACE FUNCTION sqp.get_brand_asins(
  p_brand_id UUID,
  p_include_sub_brands BOOLEAN DEFAULT TRUE
)
RETURNS TABLE(asin VARCHAR(20)) AS $$
BEGIN
  IF p_include_sub_brands THEN
    -- Include ASINs from brand and all sub-brands
    RETURN QUERY
    WITH RECURSIVE brand_tree AS (
      SELECT id FROM sqp.brands WHERE id = p_brand_id
      UNION ALL
      SELECT b.id 
      FROM sqp.brands b
      JOIN brand_tree bt ON b.parent_brand_id = bt.id
    )
    SELECT DISTINCT abm.asin
    FROM brand_tree bt
    JOIN sqp.asin_brand_mapping abm ON bt.id = abm.brand_id;
  ELSE
    -- Only ASINs directly mapped to the brand
    RETURN QUERY
    SELECT abm.asin
    FROM sqp.asin_brand_mapping abm
    WHERE abm.brand_id = p_brand_id;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create function for brand search
CREATE OR REPLACE FUNCTION sqp.search_brands(
  p_search_term TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  brand_name VARCHAR(255),
  display_name VARCHAR(255),
  relevance_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.brand_name,
    b.display_name,
    ts_rank(to_tsvector('english', b.brand_name || ' ' || b.display_name), 
            plainto_tsquery('english', p_search_term)) as relevance_score
  FROM sqp.brands b
  WHERE to_tsvector('english', b.brand_name || ' ' || b.display_name) @@ 
        plainto_tsquery('english', p_search_term)
    OR b.normalized_name ILIKE '%' || LOWER(p_search_term) || '%'
  ORDER BY relevance_score DESC, b.brand_name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Optimize existing tables with partial indexes
CREATE INDEX IF NOT EXISTS idx_asin_brand_mapping_unverified 
ON sqp.asin_brand_mapping (confidence_score, brand_id) 
WHERE verified = false AND extraction_method = 'automatic';

CREATE INDEX IF NOT EXISTS idx_brands_active 
ON sqp.brands (brand_name, id) 
WHERE is_active = true;

-- Create statistics tracking table for optimization
CREATE TABLE IF NOT EXISTS sqp.brand_query_stats (
  id BIGSERIAL PRIMARY KEY,
  brand_id UUID REFERENCES sqp.brands(id),
  query_date DATE NOT NULL DEFAULT CURRENT_DATE,
  query_count INTEGER DEFAULT 0,
  avg_response_time_ms FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(brand_id, query_date)
);

CREATE INDEX idx_brand_query_stats_date ON sqp.brand_query_stats (query_date DESC);
CREATE INDEX idx_brand_query_stats_brand ON sqp.brand_query_stats (brand_id, query_date DESC);

-- Function to track brand query usage (optional)
CREATE OR REPLACE FUNCTION sqp.track_brand_query(p_brand_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO sqp.brand_query_stats (brand_id, query_date, query_count)
  VALUES (p_brand_id, CURRENT_DATE, 1)
  ON CONFLICT (brand_id, query_date) 
  DO UPDATE SET query_count = brand_query_stats.query_count + 1;
END;
$$ LANGUAGE plpgsql;

-- Analyze tables to update statistics
ANALYZE sqp.brands;
ANALYZE sqp.asin_brand_mapping;
ANALYZE sqp.product_type_mapping;
ANALYZE sqp.search_query_performance;
ANALYZE sqp.asin_performance_data;

-- Add comments
COMMENT ON VIEW sqp.brand_hierarchy IS 'Hierarchical view of brands';
COMMENT ON FUNCTION sqp.get_brand_asins IS 'Get all ASINs for a brand, optionally including sub-brands';
COMMENT ON FUNCTION sqp.search_brands IS 'Full-text search for brands by name';
COMMENT ON TABLE sqp.brand_query_stats IS 'Tracks brand query usage for optimization';