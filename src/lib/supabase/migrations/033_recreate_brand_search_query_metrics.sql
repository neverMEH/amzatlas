-- Migration: Recreate brand_search_query_metrics materialized view
-- This should be run AFTER migration 031 which fixes the ASIN column length

-- This materialized view aggregates search query performance metrics by brand
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.brand_search_query_metrics AS
WITH brand_mapping AS (
  -- Map ASINs to brands using the match_brand_for_asin function
  SELECT DISTINCT
    apd.asin,
    apd.product_title,
    b.id as brand_id,
    b.brand_name,
    b.normalized_name as brand_normalized_name
  FROM sqp.asin_performance_data apd
  CROSS JOIN LATERAL (
    SELECT * FROM sqp.match_brand_for_asin(apd.asin)
  ) b
  WHERE b.id IS NOT NULL
),
query_metrics AS (
  -- Aggregate metrics by brand and search query
  SELECT 
    bm.brand_id,
    bm.brand_name,
    sqp.search_query,
    COUNT(DISTINCT apd.asin) as asin_count,
    SUM(sqp.asin_impression_count) as total_impressions,
    SUM(sqp.asin_click_count) as total_clicks,
    SUM(sqp.asin_cart_add_count) as total_cart_adds,
    SUM(sqp.asin_purchase_count) as total_purchases,
    AVG(sqp.search_query_score) as avg_query_score,
    AVG(sqp.search_query_volume) as avg_query_volume,
    AVG(sqp.asin_impression_share) as avg_impression_share,
    AVG(sqp.asin_click_share) as avg_click_share,
    AVG(sqp.asin_cart_add_share) as avg_cart_add_share,
    AVG(sqp.asin_purchase_share) as avg_purchase_share,
    MIN(apd.start_date) as earliest_date,
    MAX(apd.end_date) as latest_date
  FROM sqp.asin_performance_data apd
  JOIN brand_mapping bm ON apd.asin = bm.asin
  LEFT JOIN sqp.search_query_performance sqp 
    ON apd.id = sqp.asin_performance_id
  WHERE sqp.search_query IS NOT NULL
  GROUP BY bm.brand_id, bm.brand_name, sqp.search_query
)
SELECT 
  brand_id,
  brand_name,
  search_query,
  asin_count,
  total_impressions,
  total_clicks,
  total_cart_adds,
  total_purchases,
  -- Calculate click-through rate
  CASE 
    WHEN total_impressions > 0 
    THEN ROUND((total_clicks::NUMERIC / total_impressions) * 100, 2)
    ELSE 0 
  END as click_through_rate,
  -- Calculate conversion rate
  CASE 
    WHEN total_clicks > 0 
    THEN ROUND((total_purchases::NUMERIC / total_clicks) * 100, 2)
    ELSE 0 
  END as conversion_rate,
  -- Calculate cart-to-purchase rate
  CASE 
    WHEN total_cart_adds > 0 
    THEN ROUND((total_purchases::NUMERIC / total_cart_adds) * 100, 2)
    ELSE 0 
  END as cart_to_purchase_rate,
  avg_query_score,
  avg_query_volume,
  avg_impression_share,
  avg_click_share,
  avg_cart_add_share,
  avg_purchase_share,
  earliest_date,
  latest_date
FROM query_metrics
WHERE total_impressions > 0
ORDER BY brand_name, total_impressions DESC;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bsqm_brand_id ON sqp.brand_search_query_metrics(brand_id);
CREATE INDEX IF NOT EXISTS idx_bsqm_brand_name ON sqp.brand_search_query_metrics(brand_name);
CREATE INDEX IF NOT EXISTS idx_bsqm_search_query ON sqp.brand_search_query_metrics(search_query);
CREATE INDEX IF NOT EXISTS idx_bsqm_impressions ON sqp.brand_search_query_metrics(total_impressions DESC);

-- Grant permissions
GRANT SELECT ON sqp.brand_search_query_metrics TO authenticated;
GRANT SELECT ON sqp.brand_search_query_metrics TO anon;
GRANT SELECT ON sqp.brand_search_query_metrics TO service_role;

-- Add comment
COMMENT ON MATERIALIZED VIEW sqp.brand_search_query_metrics IS 'Aggregated search query performance metrics by brand, with automatic brand matching based on product titles';