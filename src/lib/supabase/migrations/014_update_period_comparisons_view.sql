-- Migration to update the period_comparisons view to include cart add metrics

-- Drop the existing views (both in sqp and public schemas)
DROP VIEW IF EXISTS public.sqp_period_comparisons CASCADE;
DROP VIEW IF EXISTS sqp.period_comparisons CASCADE;

-- Recreate the period_comparisons view with cart add columns
CREATE OR REPLACE VIEW sqp.period_comparisons AS
WITH current_period AS (
  SELECT 
    period_start,
    period_end,
    query,
    asin,
    SUM(total_impressions) as impressions,
    SUM(total_clicks) as clicks,
    SUM(total_purchases) as purchases,
    SUM(COALESCE(cart_adds, 0)) as cart_adds,  -- New cart adds column
    AVG(avg_ctr) as ctr,
    AVG(avg_cvr) as cvr,
    AVG(COALESCE(cart_add_rate, 0)) as cart_add_rate  -- New cart add rate
  FROM sqp.weekly_summary
  GROUP BY period_start, period_end, query, asin
),
previous_period AS (
  SELECT 
    period_start,
    period_end,
    query,
    asin,
    SUM(total_impressions) as impressions,
    SUM(total_clicks) as clicks,
    SUM(total_purchases) as purchases,
    SUM(COALESCE(cart_adds, 0)) as cart_adds,  -- New cart adds column
    AVG(avg_ctr) as ctr,
    AVG(avg_cvr) as cvr,
    AVG(COALESCE(cart_add_rate, 0)) as cart_add_rate  -- New cart add rate
  FROM sqp.weekly_summary
  GROUP BY period_start, period_end, query, asin
)
SELECT 
  ROW_NUMBER() OVER (ORDER BY cp.period_start DESC, cp.query, cp.asin) as id,
  'weekly' as period_type,
  cp.period_start as current_period_start,
  cp.period_end as current_period_end,
  pp.period_start as previous_period_start,
  pp.period_end as previous_period_end,
  cp.query,
  cp.asin,
  
  -- Current period metrics
  cp.impressions as current_impressions,
  cp.clicks as current_clicks,
  cp.purchases as current_purchases,
  cp.cart_adds as current_cart_adds,  -- New
  cp.ctr as current_ctr,
  cp.cvr as current_cvr,
  
  -- Previous period metrics
  COALESCE(pp.impressions, 0) as previous_impressions,
  COALESCE(pp.clicks, 0) as previous_clicks,
  COALESCE(pp.purchases, 0) as previous_purchases,
  COALESCE(pp.cart_adds, 0) as previous_cart_adds,  -- New
  COALESCE(pp.ctr, 0) as previous_ctr,
  COALESCE(pp.cvr, 0) as previous_cvr,
  
  -- Changes (absolute)
  cp.impressions - COALESCE(pp.impressions, 0) as impressions_change,
  cp.clicks - COALESCE(pp.clicks, 0) as clicks_change,
  cp.purchases - COALESCE(pp.purchases, 0) as purchases_change,
  cp.cart_adds - COALESCE(pp.cart_adds, 0) as cart_adds_change,  -- New
  cp.ctr - COALESCE(pp.ctr, 0) as ctr_change,
  cp.cvr - COALESCE(pp.cvr, 0) as cvr_change,
  
  -- Changes (percentage)
  CASE 
    WHEN COALESCE(pp.impressions, 0) = 0 THEN NULL
    ELSE ((cp.impressions - pp.impressions)::DECIMAL / pp.impressions * 100)
  END as impressions_change_pct,
  CASE 
    WHEN COALESCE(pp.clicks, 0) = 0 THEN NULL
    ELSE ((cp.clicks - pp.clicks)::DECIMAL / pp.clicks * 100)
  END as clicks_change_pct,
  CASE 
    WHEN COALESCE(pp.purchases, 0) = 0 THEN NULL
    ELSE ((cp.purchases - pp.purchases)::DECIMAL / pp.purchases * 100)
  END as purchases_change_pct,
  CASE 
    WHEN COALESCE(pp.cart_adds, 0) = 0 THEN NULL
    ELSE ((cp.cart_adds - pp.cart_adds)::DECIMAL / pp.cart_adds * 100)
  END as cart_adds_change_pct,  -- New
  
  CURRENT_TIMESTAMP as created_at
FROM current_period cp
LEFT JOIN previous_period pp 
  ON cp.query = pp.query 
  AND cp.asin = pp.asin 
  AND pp.period_start = cp.period_start - INTERVAL '7 days';

-- Recreate the public view
CREATE OR REPLACE VIEW public.sqp_period_comparisons AS 
SELECT * FROM sqp.period_comparisons;

-- Grant permissions
GRANT SELECT ON sqp.period_comparisons TO authenticated, service_role;
GRANT SELECT ON public.sqp_period_comparisons TO authenticated, service_role;

-- Add comments
COMMENT ON VIEW sqp.period_comparisons IS 'Period-over-period comparison view with cart add metrics';
COMMENT ON VIEW public.sqp_period_comparisons IS 'Public access to period comparisons view';