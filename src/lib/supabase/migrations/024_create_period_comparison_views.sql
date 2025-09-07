-- Migration: Create Period Comparison Views
-- Description: Creates materialized views for week-over-week, month-over-month, quarter-over-quarter, and year-over-year comparisons

-- Week-over-Week comparison view with brand support
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.week_over_week_comparison AS
WITH weekly_metrics AS (
  SELECT 
    sp.asin,
    abm.brand_id,
    b.brand_name,
    b.display_name as brand_display_name,
    DATE_TRUNC('week', sp.start_date)::DATE as week_start,
    SUM(sp.impressions_sum) as impressions,
    SUM(sp.clicks_sum) as clicks,
    SUM(sp.cart_adds_sum) as cart_adds,
    SUM(sp.purchases_sum) as purchases,
    SUM(sp.purchases_sum * COALESCE(sp.median_price_purchase, 0)) as revenue,
    AVG(CASE WHEN sp.impressions_sum > 0 
        THEN sp.clicks_sum::FLOAT / sp.impressions_sum ELSE NULL END) as ctr,
    AVG(CASE WHEN sp.clicks_sum > 0 
        THEN sp.cart_adds_sum::FLOAT / sp.clicks_sum ELSE NULL END) as cart_add_rate,
    AVG(CASE WHEN sp.clicks_sum > 0 
        THEN sp.purchases_sum::FLOAT / sp.clicks_sum ELSE NULL END) as cvr,
    COUNT(DISTINCT sp.search_query) as unique_queries
  FROM sqp.search_query_performance sp
  JOIN sqp.asin_brand_mapping abm ON sp.asin = abm.asin
  JOIN sqp.brands b ON abm.brand_id = b.id
  GROUP BY sp.asin, abm.brand_id, b.brand_name, b.display_name, DATE_TRUNC('week', sp.start_date)
),
week_comparisons AS (
  SELECT 
    curr.*,
    prev.impressions as prev_week_impressions,
    prev.clicks as prev_week_clicks,
    prev.cart_adds as prev_week_cart_adds,
    prev.purchases as prev_week_purchases,
    prev.revenue as prev_week_revenue,
    prev.ctr as prev_week_ctr,
    prev.cart_add_rate as prev_week_cart_add_rate,
    prev.cvr as prev_week_cvr,
    prev.unique_queries as prev_week_unique_queries,
    
    -- Calculate percentage changes
    CASE WHEN prev.impressions > 0 
      THEN ((curr.impressions - prev.impressions)::FLOAT / prev.impressions) * 100 
      ELSE NULL END as impressions_wow_change,
    CASE WHEN prev.clicks > 0 
      THEN ((curr.clicks - prev.clicks)::FLOAT / prev.clicks) * 100 
      ELSE NULL END as clicks_wow_change,
    CASE WHEN prev.cart_adds > 0 
      THEN ((curr.cart_adds - prev.cart_adds)::FLOAT / prev.cart_adds) * 100 
      ELSE NULL END as cart_adds_wow_change,
    CASE WHEN prev.purchases > 0 
      THEN ((curr.purchases - prev.purchases)::FLOAT / prev.purchases) * 100 
      ELSE NULL END as purchases_wow_change,
    CASE WHEN prev.revenue > 0 
      THEN ((curr.revenue - prev.revenue)::FLOAT / prev.revenue) * 100 
      ELSE NULL END as revenue_wow_change,
    
    -- CTR/CVR point changes (not percentage)
    (curr.ctr - COALESCE(prev.ctr, 0)) * 100 as ctr_wow_change_pts,
    (curr.cart_add_rate - COALESCE(prev.cart_add_rate, 0)) * 100 as cart_add_rate_wow_change_pts,
    (curr.cvr - COALESCE(prev.cvr, 0)) * 100 as cvr_wow_change_pts
  
  FROM weekly_metrics curr
  LEFT JOIN weekly_metrics prev 
    ON curr.asin = prev.asin 
    AND curr.week_start = prev.week_start + INTERVAL '1 week'
)
SELECT * FROM week_comparisons;

CREATE UNIQUE INDEX idx_wow_comparison_pk 
ON sqp.week_over_week_comparison (asin, week_start);

CREATE INDEX idx_wow_comparison_brand 
ON sqp.week_over_week_comparison (brand_id, week_start DESC);

CREATE INDEX idx_wow_comparison_date 
ON sqp.week_over_week_comparison (week_start DESC);

-- Month-over-Month comparison view
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.month_over_month_comparison AS
WITH monthly_metrics AS (
  SELECT 
    sp.asin,
    abm.brand_id,
    b.brand_name,
    b.display_name as brand_display_name,
    DATE_TRUNC('month', sp.start_date)::DATE as month_start,
    TO_CHAR(DATE_TRUNC('month', sp.start_date), 'YYYY-MM') as month_label,
    SUM(sp.impressions_sum) as impressions,
    SUM(sp.clicks_sum) as clicks,
    SUM(sp.cart_adds_sum) as cart_adds,
    SUM(sp.purchases_sum) as purchases,
    SUM(sp.purchases_sum * COALESCE(sp.median_price_purchase, 0)) as revenue,
    AVG(CASE WHEN sp.impressions_sum > 0 
        THEN sp.clicks_sum::FLOAT / sp.impressions_sum ELSE NULL END) as ctr,
    AVG(CASE WHEN sp.clicks_sum > 0 
        THEN sp.cart_adds_sum::FLOAT / sp.clicks_sum ELSE NULL END) as cart_add_rate,
    AVG(CASE WHEN sp.clicks_sum > 0 
        THEN sp.purchases_sum::FLOAT / sp.clicks_sum ELSE NULL END) as cvr,
    COUNT(DISTINCT sp.search_query) as unique_queries,
    COUNT(DISTINCT sp.end_date) as data_days
  FROM sqp.search_query_performance sp
  JOIN sqp.asin_brand_mapping abm ON sp.asin = abm.asin
  JOIN sqp.brands b ON abm.brand_id = b.id
  GROUP BY sp.asin, abm.brand_id, b.brand_name, b.display_name, DATE_TRUNC('month', sp.start_date)
),
month_comparisons AS (
  SELECT 
    curr.*,
    prev.impressions as prev_month_impressions,
    prev.clicks as prev_month_clicks,
    prev.cart_adds as prev_month_cart_adds,
    prev.purchases as prev_month_purchases,
    prev.revenue as prev_month_revenue,
    prev.ctr as prev_month_ctr,
    prev.cart_add_rate as prev_month_cart_add_rate,
    prev.cvr as prev_month_cvr,
    
    -- Calculate percentage changes
    CASE WHEN prev.impressions > 0 
      THEN ((curr.impressions - prev.impressions)::FLOAT / prev.impressions) * 100 
      ELSE NULL END as impressions_mom_change,
    CASE WHEN prev.clicks > 0 
      THEN ((curr.clicks - prev.clicks)::FLOAT / prev.clicks) * 100 
      ELSE NULL END as clicks_mom_change,
    CASE WHEN prev.cart_adds > 0 
      THEN ((curr.cart_adds - prev.cart_adds)::FLOAT / prev.cart_adds) * 100 
      ELSE NULL END as cart_adds_mom_change,
    CASE WHEN prev.purchases > 0 
      THEN ((curr.purchases - prev.purchases)::FLOAT / prev.purchases) * 100 
      ELSE NULL END as purchases_mom_change,
    CASE WHEN prev.revenue > 0 
      THEN ((curr.revenue - prev.revenue)::FLOAT / prev.revenue) * 100 
      ELSE NULL END as revenue_mom_change,
    
    -- Year-over-year comparison
    yoy.impressions as yoy_impressions,
    yoy.purchases as yoy_purchases,
    yoy.revenue as yoy_revenue,
    CASE WHEN yoy.impressions > 0 
      THEN ((curr.impressions - yoy.impressions)::FLOAT / yoy.impressions) * 100 
      ELSE NULL END as impressions_yoy_change,
    CASE WHEN yoy.purchases > 0 
      THEN ((curr.purchases - yoy.purchases)::FLOAT / yoy.purchases) * 100 
      ELSE NULL END as purchases_yoy_change
    
  FROM monthly_metrics curr
  LEFT JOIN monthly_metrics prev 
    ON curr.asin = prev.asin 
    AND curr.month_start = prev.month_start + INTERVAL '1 month'
  LEFT JOIN monthly_metrics yoy 
    ON curr.asin = yoy.asin 
    AND curr.month_start = yoy.month_start + INTERVAL '1 year'
)
SELECT * FROM month_comparisons;

CREATE UNIQUE INDEX idx_mom_comparison_pk 
ON sqp.month_over_month_comparison (asin, month_start);

CREATE INDEX idx_mom_comparison_brand 
ON sqp.month_over_month_comparison (brand_id, month_start DESC);

-- Quarter-over-Quarter comparison view
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.quarter_over_quarter_comparison AS
WITH quarterly_metrics AS (
  SELECT 
    sp.asin,
    abm.brand_id,
    b.brand_name,
    b.display_name as brand_display_name,
    DATE_TRUNC('quarter', sp.start_date)::DATE as quarter_start,
    TO_CHAR(DATE_TRUNC('quarter', sp.start_date), '"Q"Q YYYY') as quarter_label,
    EXTRACT(QUARTER FROM sp.start_date) as quarter_num,
    EXTRACT(YEAR FROM sp.start_date) as year,
    SUM(sp.impressions_sum) as impressions,
    SUM(sp.clicks_sum) as clicks,
    SUM(sp.cart_adds_sum) as cart_adds,
    SUM(sp.purchases_sum) as purchases,
    SUM(sp.purchases_sum * COALESCE(sp.median_price_purchase, 0)) as revenue,
    AVG(CASE WHEN sp.impressions_sum > 0 
        THEN sp.clicks_sum::FLOAT / sp.impressions_sum ELSE NULL END) as ctr,
    AVG(CASE WHEN sp.clicks_sum > 0 
        THEN sp.cart_adds_sum::FLOAT / sp.clicks_sum ELSE NULL END) as cart_add_rate,
    AVG(CASE WHEN sp.clicks_sum > 0 
        THEN sp.purchases_sum::FLOAT / sp.clicks_sum ELSE NULL END) as cvr,
    COUNT(DISTINCT sp.search_query) as unique_queries,
    COUNT(DISTINCT DATE_TRUNC('week', sp.start_date)) as active_weeks
  FROM sqp.search_query_performance sp
  JOIN sqp.asin_brand_mapping abm ON sp.asin = abm.asin
  JOIN sqp.brands b ON abm.brand_id = b.id
  GROUP BY 
    sp.asin, abm.brand_id, b.brand_name, b.display_name, 
    DATE_TRUNC('quarter', sp.start_date),
    EXTRACT(QUARTER FROM sp.start_date),
    EXTRACT(YEAR FROM sp.start_date)
),
quarter_comparisons AS (
  SELECT 
    curr.*,
    prev.impressions as prev_quarter_impressions,
    prev.clicks as prev_quarter_clicks,
    prev.cart_adds as prev_quarter_cart_adds,
    prev.purchases as prev_quarter_purchases,
    prev.revenue as prev_quarter_revenue,
    prev.ctr as prev_quarter_ctr,
    prev.cvr as prev_quarter_cvr,
    
    -- Calculate percentage changes
    CASE WHEN prev.impressions > 0 
      THEN ((curr.impressions - prev.impressions)::FLOAT / prev.impressions) * 100 
      ELSE NULL END as impressions_qoq_change,
    CASE WHEN prev.purchases > 0 
      THEN ((curr.purchases - prev.purchases)::FLOAT / prev.purchases) * 100 
      ELSE NULL END as purchases_qoq_change,
    CASE WHEN prev.revenue > 0 
      THEN ((curr.revenue - prev.revenue)::FLOAT / prev.revenue) * 100 
      ELSE NULL END as revenue_qoq_change,
    
    -- Year-over-year quarterly comparison
    yoy.impressions as yoy_quarter_impressions,
    yoy.purchases as yoy_quarter_purchases,
    CASE WHEN yoy.impressions > 0 
      THEN ((curr.impressions - yoy.impressions)::FLOAT / yoy.impressions) * 100 
      ELSE NULL END as impressions_yoy_change,
    CASE WHEN yoy.purchases > 0 
      THEN ((curr.purchases - yoy.purchases)::FLOAT / yoy.purchases) * 100 
      ELSE NULL END as purchases_yoy_change
    
  FROM quarterly_metrics curr
  LEFT JOIN quarterly_metrics prev 
    ON curr.asin = prev.asin 
    AND curr.quarter_start = prev.quarter_start + INTERVAL '3 months'
  LEFT JOIN quarterly_metrics yoy 
    ON curr.asin = yoy.asin 
    AND curr.quarter_num = yoy.quarter_num 
    AND curr.year = yoy.year + 1
)
SELECT * FROM quarter_comparisons;

CREATE UNIQUE INDEX idx_qoq_comparison_pk 
ON sqp.quarter_over_quarter_comparison (asin, quarter_start);

CREATE INDEX idx_qoq_comparison_brand 
ON sqp.quarter_over_quarter_comparison (brand_id, quarter_start DESC);

-- Year-over-Year comparison view
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.year_over_year_comparison AS
WITH yearly_metrics AS (
  SELECT 
    sp.asin,
    abm.brand_id,
    b.brand_name,
    b.display_name as brand_display_name,
    EXTRACT(YEAR FROM sp.start_date) as year,
    MIN(sp.start_date) as year_start_date,
    MAX(sp.end_date) as year_end_date,
    SUM(sp.impressions_sum) as impressions,
    SUM(sp.clicks_sum) as clicks,
    SUM(sp.cart_adds_sum) as cart_adds,
    SUM(sp.purchases_sum) as purchases,
    SUM(sp.purchases_sum * COALESCE(sp.median_price_purchase, 0)) as revenue,
    AVG(CASE WHEN sp.impressions_sum > 0 
        THEN sp.clicks_sum::FLOAT / sp.impressions_sum ELSE NULL END) as ctr,
    AVG(CASE WHEN sp.clicks_sum > 0 
        THEN sp.cart_adds_sum::FLOAT / sp.clicks_sum ELSE NULL END) as cart_add_rate,
    AVG(CASE WHEN sp.clicks_sum > 0 
        THEN sp.purchases_sum::FLOAT / sp.clicks_sum ELSE NULL END) as cvr,
    COUNT(DISTINCT sp.search_query) as unique_queries,
    COUNT(DISTINCT DATE_TRUNC('month', sp.start_date)) as active_months
  FROM sqp.search_query_performance sp
  JOIN sqp.asin_brand_mapping abm ON sp.asin = abm.asin
  JOIN sqp.brands b ON abm.brand_id = b.id
  GROUP BY sp.asin, abm.brand_id, b.brand_name, b.display_name, EXTRACT(YEAR FROM sp.start_date)
),
year_comparisons AS (
  SELECT 
    curr.*,
    prev.impressions as prev_year_impressions,
    prev.clicks as prev_year_clicks,
    prev.cart_adds as prev_year_cart_adds,
    prev.purchases as prev_year_purchases,
    prev.revenue as prev_year_revenue,
    prev.ctr as prev_year_ctr,
    prev.cvr as prev_year_cvr,
    
    -- Calculate percentage changes
    CASE WHEN prev.impressions > 0 
      THEN ((curr.impressions - prev.impressions)::FLOAT / prev.impressions) * 100 
      ELSE NULL END as impressions_yoy_change,
    CASE WHEN prev.clicks > 0 
      THEN ((curr.clicks - prev.clicks)::FLOAT / prev.clicks) * 100 
      ELSE NULL END as clicks_yoy_change,
    CASE WHEN prev.purchases > 0 
      THEN ((curr.purchases - prev.purchases)::FLOAT / prev.purchases) * 100 
      ELSE NULL END as purchases_yoy_change,
    CASE WHEN prev.revenue > 0 
      THEN ((curr.revenue - prev.revenue)::FLOAT / prev.revenue) * 100 
      ELSE NULL END as revenue_yoy_change,
    
    -- Growth metrics
    CASE 
      WHEN prev.revenue > 0 AND curr.revenue > 0 
      THEN POWER((curr.revenue / prev.revenue), 1.0) - 1
      ELSE NULL 
    END as revenue_growth_rate
    
  FROM yearly_metrics curr
  LEFT JOIN yearly_metrics prev 
    ON curr.asin = prev.asin 
    AND curr.year = prev.year + 1
)
SELECT * FROM year_comparisons;

CREATE UNIQUE INDEX idx_yoy_comparison_pk 
ON sqp.year_over_year_comparison (asin, year);

CREATE INDEX idx_yoy_comparison_brand 
ON sqp.year_over_year_comparison (brand_id, year DESC);

-- Grant permissions
GRANT SELECT ON sqp.week_over_week_comparison TO authenticated;
GRANT SELECT ON sqp.month_over_month_comparison TO authenticated;
GRANT SELECT ON sqp.quarter_over_quarter_comparison TO authenticated;
GRANT SELECT ON sqp.year_over_year_comparison TO authenticated;

-- Add comments
COMMENT ON MATERIALIZED VIEW sqp.week_over_week_comparison IS 'Week-over-week performance metrics with brand support';
COMMENT ON MATERIALIZED VIEW sqp.month_over_month_comparison IS 'Month-over-month performance metrics with YoY comparison';
COMMENT ON MATERIALIZED VIEW sqp.quarter_over_quarter_comparison IS 'Quarter-over-quarter performance metrics';
COMMENT ON MATERIALIZED VIEW sqp.year_over_year_comparison IS 'Year-over-year performance metrics with growth rates';