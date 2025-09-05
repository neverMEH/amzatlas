-- Create a view that generates daily metrics from weekly data for brand sparklines
-- This view interpolates daily values from weekly totals for smooth sparkline visualization

CREATE OR REPLACE VIEW public.brand_daily_metrics AS
WITH daily_series AS (
  -- Generate a series of dates covering our data range
  SELECT generate_series(
    (SELECT MIN(start_date) FROM public.search_performance_summary),
    (SELECT MAX(end_date) FROM public.search_performance_summary),
    '1 day'::interval
  )::date AS date
),
brand_weekly_metrics AS (
  -- Aggregate weekly metrics by brand
  SELECT 
    abm.brand_id,
    sps.start_date,
    sps.end_date,
    SUM(sps.impressions) AS weekly_impressions,
    SUM(sps.clicks) AS weekly_clicks,
    SUM(sps.cart_adds) AS weekly_cart_adds,
    SUM(sps.purchases) AS weekly_purchases
  FROM public.search_performance_summary sps
  JOIN sqp.asin_brand_mapping abm ON sps.asin = abm.asin
  GROUP BY abm.brand_id, sps.start_date, sps.end_date
),
daily_interpolated AS (
  -- Distribute weekly totals evenly across days
  SELECT 
    bwm.brand_id,
    ds.date,
    -- Divide weekly totals by 7 to get average daily values
    ROUND(bwm.weekly_impressions::numeric / 7) AS impressions,
    ROUND(bwm.weekly_clicks::numeric / 7) AS clicks,
    ROUND(bwm.weekly_cart_adds::numeric / 7) AS cart_adds,
    ROUND(bwm.weekly_purchases::numeric / 7) AS purchases
  FROM daily_series ds
  JOIN brand_weekly_metrics bwm 
    ON ds.date >= bwm.start_date 
    AND ds.date <= bwm.end_date
)
SELECT 
  brand_id,
  date,
  impressions::integer,
  clicks::integer,
  cart_adds::integer,
  purchases::integer
FROM daily_interpolated
ORDER BY brand_id, date;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_brand_daily_metrics_brand_date 
  ON public.search_performance_summary(asin, start_date, end_date);

-- Grant permissions
GRANT SELECT ON public.brand_daily_metrics TO authenticated;

-- Add comment
COMMENT ON VIEW public.brand_daily_metrics IS 
  'Daily brand metrics interpolated from weekly data for sparkline visualization';