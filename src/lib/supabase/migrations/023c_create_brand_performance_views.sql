-- Migration: Create Brand Performance Views
-- Description: Creates materialized views after all necessary columns exist

-- Create materialized view for brand performance summary
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.brand_performance_summary AS
WITH brand_metrics AS (
  SELECT 
    b.id as brand_id,
    b.brand_name,
    b.display_name,
    b.parent_brand_id,
    COUNT(DISTINCT abm.asin) as asin_count,
    COUNT(DISTINCT sp.search_query) as unique_queries,
    SUM(sp.impressions_sum) as total_impressions,
    SUM(sp.clicks_sum) as total_clicks,
    SUM(sp.cart_adds_sum) as total_cart_adds,
    SUM(sp.purchases_sum) as total_purchases,
    SUM(sp.purchases_sum * sp.median_price_purchase) as total_revenue,
    AVG(CASE WHEN sp.impressions_sum > 0 
        THEN sp.clicks_sum::FLOAT / sp.impressions_sum 
        ELSE NULL END) as avg_ctr,
    AVG(CASE WHEN sp.clicks_sum > 0 
        THEN sp.cart_adds_sum::FLOAT / sp.clicks_sum 
        ELSE NULL END) as avg_cart_add_rate,
    AVG(CASE WHEN sp.cart_adds_sum > 0 
        THEN sp.purchases_sum::FLOAT / sp.cart_adds_sum 
        ELSE NULL END) as avg_cart_conversion_rate,
    AVG(CASE WHEN sp.clicks_sum > 0 
        THEN sp.purchases_sum::FLOAT / sp.clicks_sum 
        ELSE NULL END) as avg_cvr,
    MIN(sp.start_date) as earliest_data,
    MAX(sp.end_date) as latest_data
  FROM sqp.brands b
  JOIN sqp.asin_brand_mapping abm ON b.id = abm.brand_id
  LEFT JOIN sqp.search_query_performance sp ON abm.asin = sp.asin
  GROUP BY b.id, b.brand_name, b.display_name, b.parent_brand_id
),
brand_rankings AS (
  SELECT 
    bm.*,
    RANK() OVER (ORDER BY total_revenue DESC NULLS LAST) as revenue_rank,
    RANK() OVER (ORDER BY total_impressions DESC NULLS LAST) as impressions_rank,
    RANK() OVER (ORDER BY avg_cvr DESC NULLS LAST) as cvr_rank,
    RANK() OVER (ORDER BY asin_count DESC) as asin_count_rank
  FROM brand_metrics bm
)
SELECT * FROM brand_rankings;

-- Create indexes on the materialized view
CREATE UNIQUE INDEX idx_brand_performance_summary_pk 
ON sqp.brand_performance_summary (brand_id);

CREATE INDEX idx_brand_performance_summary_revenue 
ON sqp.brand_performance_summary (total_revenue DESC NULLS LAST);

CREATE INDEX idx_brand_performance_summary_parent 
ON sqp.brand_performance_summary (parent_brand_id) 
WHERE parent_brand_id IS NOT NULL;

-- Update brand hierarchy view to include performance metrics
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
SELECT 
  bt.*,
  bps.asin_count,
  bps.total_revenue,
  bps.avg_cvr
FROM brand_tree bt
LEFT JOIN sqp.brand_performance_summary bps ON bt.id = bps.brand_id;

-- Grant permissions
GRANT SELECT ON sqp.brand_performance_summary TO authenticated;

-- Add comment
COMMENT ON MATERIALIZED VIEW sqp.brand_performance_summary IS 'Pre-aggregated brand performance metrics for fast dashboard queries';
COMMENT ON VIEW sqp.brand_hierarchy IS 'Hierarchical view of brands with performance metrics';