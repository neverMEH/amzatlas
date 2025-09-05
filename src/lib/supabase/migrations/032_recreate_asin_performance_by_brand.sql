-- Migration: Recreate asin_performance_by_brand view
-- This should be run AFTER migration 031 which fixes the ASIN column length

-- This view aggregates ASIN performance metrics by brand
-- It uses pattern matching to associate ASINs with brands based on product titles

CREATE OR REPLACE VIEW public.asin_performance_by_brand AS
WITH asin_brand_mapping AS (
  -- Map ASINs to brands using the brand matching RPC function
  SELECT DISTINCT
    apd.asin,
    apd.product_title,
    b.id as brand_id,
    b.brand_name
  FROM sqp.asin_performance_data apd
  CROSS JOIN LATERAL (
    SELECT * FROM sqp.match_brand_for_asin(apd.asin)
  ) b
  WHERE b.id IS NOT NULL
),
performance_aggregates AS (
  -- Aggregate performance metrics by ASIN
  SELECT 
    apd.asin,
    MAX(apd.product_title) as product_title,
    SUM(sqp.asin_impression_count) as total_impressions,
    SUM(sqp.asin_click_count) as total_clicks,
    SUM(sqp.asin_cart_add_count) as total_cart_adds,
    SUM(sqp.asin_purchase_count) as total_purchases,
    AVG(sqp.asin_impression_share) as avg_impression_share,
    AVG(sqp.asin_click_share) as avg_click_share,
    AVG(sqp.asin_cart_add_share) as avg_cart_add_share,
    AVG(sqp.asin_purchase_share) as avg_purchase_share
  FROM sqp.asin_performance_data apd
  LEFT JOIN sqp.search_query_performance sqp 
    ON apd.id = sqp.asin_performance_id
  GROUP BY apd.asin
)
SELECT 
  abm.brand_id,
  abm.brand_name,
  pa.asin,
  pa.product_title,
  COALESCE(pa.total_impressions, 0) as impressions,
  COALESCE(pa.total_clicks, 0) as clicks,
  COALESCE(pa.total_cart_adds, 0) as cart_adds,
  COALESCE(pa.total_purchases, 0) as purchases,
  -- Calculate click-through rate
  CASE 
    WHEN pa.total_impressions > 0 
    THEN ROUND((pa.total_clicks::NUMERIC / pa.total_impressions) * 100, 1)
    ELSE 0 
  END as click_through_rate,
  -- Calculate conversion rate
  CASE 
    WHEN pa.total_clicks > 0 
    THEN ROUND((pa.total_purchases::NUMERIC / pa.total_clicks) * 100, 1)
    ELSE 0 
  END as conversion_rate,
  -- Share metrics
  ROUND(COALESCE(pa.avg_impression_share, 0)::NUMERIC, 5) as impression_share,
  ROUND(COALESCE(pa.avg_click_share, 0)::NUMERIC, 5) as ctr_share,
  ROUND(COALESCE(pa.avg_purchase_share, 0)::NUMERIC, 5) as cvr_share,
  ROUND(COALESCE(pa.avg_cart_add_share, 0)::NUMERIC, 5) as cart_add_share,
  ROUND(COALESCE(pa.avg_purchase_share, 0)::NUMERIC, 5) as purchase_share
FROM asin_brand_mapping abm
JOIN performance_aggregates pa ON abm.asin = pa.asin
ORDER BY abm.brand_name, pa.total_impressions DESC;

-- Grant permissions
GRANT SELECT ON public.asin_performance_by_brand TO authenticated;
GRANT SELECT ON public.asin_performance_by_brand TO anon;
GRANT SELECT ON public.asin_performance_by_brand TO service_role;

-- Add comment
COMMENT ON VIEW public.asin_performance_by_brand IS 'Aggregates ASIN performance metrics grouped by brand, using automatic brand matching based on product titles';