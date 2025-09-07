-- Create materialized views for better query performance

-- Weekly trends view with week-over-week calculations
CREATE MATERIALIZED VIEW sqp.weekly_trends AS
WITH weekly_data AS (
  SELECT 
    w1.*,
    LAG(w1.total_impressions) OVER (PARTITION BY w1.query, w1.asin ORDER BY w1.period_start) as prev_impressions,
    LAG(w1.total_clicks) OVER (PARTITION BY w1.query, w1.asin ORDER BY w1.period_start) as prev_clicks,
    LAG(w1.total_purchases) OVER (PARTITION BY w1.query, w1.asin ORDER BY w1.period_start) as prev_purchases,
    LAG(w1.avg_ctr) OVER (PARTITION BY w1.query, w1.asin ORDER BY w1.period_start) as prev_ctr,
    LAG(w1.avg_cvr) OVER (PARTITION BY w1.query, w1.asin ORDER BY w1.period_start) as prev_cvr
  FROM sqp.weekly_summary w1
)
SELECT 
  period_start,
  period_end,
  query,
  asin,
  total_impressions,
  total_clicks,
  total_purchases,
  avg_ctr,
  avg_cvr,
  
  -- Week-over-week changes
  total_impressions - COALESCE(prev_impressions, 0) as impressions_wow,
  CASE 
    WHEN prev_impressions > 0 THEN ((total_impressions - prev_impressions)::DECIMAL / prev_impressions * 100)
    ELSE NULL 
  END as impressions_wow_pct,
  
  total_clicks - COALESCE(prev_clicks, 0) as clicks_wow,
  CASE 
    WHEN prev_clicks > 0 THEN ((total_clicks - prev_clicks)::DECIMAL / prev_clicks * 100)
    ELSE NULL 
  END as clicks_wow_pct,
  
  total_purchases - COALESCE(prev_purchases, 0) as purchases_wow,
  CASE 
    WHEN prev_purchases > 0 THEN ((total_purchases - prev_purchases)::DECIMAL / prev_purchases * 100)
    ELSE NULL 
  END as purchases_wow_pct,
  
  avg_ctr - COALESCE(prev_ctr, 0) as ctr_wow,
  avg_cvr - COALESCE(prev_cvr, 0) as cvr_wow,
  
  -- Trend classification
  CASE
    WHEN prev_purchases IS NULL THEN 'new'
    WHEN total_purchases > prev_purchases * 1.1 THEN 'growing'
    WHEN total_purchases < prev_purchases * 0.9 THEN 'declining'
    ELSE 'stable'
  END as trend
FROM weekly_data;

-- Monthly trends view
CREATE MATERIALIZED VIEW sqp.monthly_trends AS
WITH monthly_data AS (
  SELECT 
    m1.*,
    LAG(m1.total_impressions) OVER (PARTITION BY m1.query, m1.asin ORDER BY m1.year, m1.month) as prev_impressions,
    LAG(m1.total_clicks) OVER (PARTITION BY m1.query, m1.asin ORDER BY m1.year, m1.month) as prev_clicks,
    LAG(m1.total_purchases) OVER (PARTITION BY m1.query, m1.asin ORDER BY m1.year, m1.month) as prev_purchases,
    LAG(m1.avg_ctr) OVER (PARTITION BY m1.query, m1.asin ORDER BY m1.year, m1.month) as prev_ctr,
    LAG(m1.avg_cvr) OVER (PARTITION BY m1.query, m1.asin ORDER BY m1.year, m1.month) as prev_cvr
  FROM sqp.monthly_summary m1
)
SELECT 
  year,
  month,
  period_start,
  period_end,
  query,
  asin,
  total_impressions,
  total_clicks,
  total_purchases,
  avg_ctr,
  avg_cvr,
  
  -- Month-over-month changes
  total_impressions - COALESCE(prev_impressions, 0) as impressions_mom,
  CASE 
    WHEN prev_impressions > 0 THEN ((total_impressions - prev_impressions)::DECIMAL / prev_impressions * 100)
    ELSE NULL 
  END as impressions_mom_pct,
  
  total_clicks - COALESCE(prev_clicks, 0) as clicks_mom,
  CASE 
    WHEN prev_clicks > 0 THEN ((total_clicks - prev_clicks)::DECIMAL / prev_clicks * 100)
    ELSE NULL 
  END as clicks_mom_pct,
  
  total_purchases - COALESCE(prev_purchases, 0) as purchases_mom,
  CASE 
    WHEN prev_purchases > 0 THEN ((total_purchases - prev_purchases)::DECIMAL / prev_purchases * 100)
    ELSE NULL 
  END as purchases_mom_pct,
  
  avg_ctr - COALESCE(prev_ctr, 0) as ctr_mom,
  avg_cvr - COALESCE(prev_cvr, 0) as cvr_mom
FROM monthly_data;

-- Top performing keywords view (by purchase volume)
CREATE MATERIALIZED VIEW sqp.top_keywords_by_period AS
SELECT 
  'weekly' as period_type,
  period_start,
  period_end,
  query,
  SUM(total_purchases) as total_purchases,
  SUM(total_clicks) as total_clicks,
  SUM(total_impressions) as total_impressions,
  AVG(avg_ctr) as avg_ctr,
  AVG(avg_cvr) as avg_cvr,
  COUNT(DISTINCT asin) as unique_asins,
  RANK() OVER (PARTITION BY period_start ORDER BY SUM(total_purchases) DESC) as purchase_rank
FROM sqp.weekly_summary
GROUP BY period_start, period_end, query

UNION ALL

SELECT 
  'monthly' as period_type,
  period_start,
  period_end,
  query,
  SUM(total_purchases) as total_purchases,
  SUM(total_clicks) as total_clicks,
  SUM(total_impressions) as total_impressions,
  AVG(avg_ctr) as avg_ctr,
  AVG(avg_cvr) as avg_cvr,
  COUNT(DISTINCT asin) as unique_asins,
  RANK() OVER (PARTITION BY period_start ORDER BY SUM(total_purchases) DESC) as purchase_rank
FROM sqp.monthly_summary
GROUP BY period_start, period_end, query;

-- Market share view
CREATE MATERIALIZED VIEW sqp.market_share AS
WITH period_totals AS (
  SELECT 
    period_start,
    period_end,
    query,
    SUM(total_impressions) as market_impressions,
    SUM(total_clicks) as market_clicks,
    SUM(total_purchases) as market_purchases
  FROM sqp.weekly_summary
  GROUP BY period_start, period_end, query
)
SELECT 
  w.period_start,
  w.period_end,
  w.query,
  w.asin,
  w.total_impressions,
  w.total_clicks,
  w.total_purchases,
  
  -- Market share calculations
  CASE 
    WHEN pt.market_impressions > 0 THEN (w.total_impressions::DECIMAL / pt.market_impressions * 100)
    ELSE 0 
  END as impression_market_share,
  
  CASE 
    WHEN pt.market_clicks > 0 THEN (w.total_clicks::DECIMAL / pt.market_clicks * 100)
    ELSE 0 
  END as click_market_share,
  
  CASE 
    WHEN pt.market_purchases > 0 THEN (w.total_purchases::DECIMAL / pt.market_purchases * 100)
    ELSE 0 
  END as purchase_market_share,
  
  -- Rankings within market
  RANK() OVER (PARTITION BY w.period_start, w.query ORDER BY w.total_purchases DESC) as purchase_rank,
  RANK() OVER (PARTITION BY w.period_start, w.query ORDER BY w.total_clicks DESC) as click_rank,
  RANK() OVER (PARTITION BY w.period_start, w.query ORDER BY w.total_impressions DESC) as impression_rank
FROM sqp.weekly_summary w
JOIN period_totals pt ON w.period_start = pt.period_start 
  AND w.period_end = pt.period_end 
  AND w.query = pt.query;

-- Year-over-year comparison view
CREATE MATERIALIZED VIEW sqp.year_over_year AS
WITH current_year AS (
  SELECT 
    y.*,
    EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER as current_year_num
  FROM sqp.yearly_summary y
  WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)
),
previous_year AS (
  SELECT *
  FROM sqp.yearly_summary
  WHERE year = EXTRACT(YEAR FROM CURRENT_DATE) - 1
)
SELECT 
  c.query,
  c.asin,
  c.year as current_year,
  p.year as previous_year,
  
  -- Current year metrics
  c.total_impressions as cy_impressions,
  c.total_clicks as cy_clicks,
  c.total_purchases as cy_purchases,
  c.avg_ctr as cy_ctr,
  c.avg_cvr as cy_cvr,
  
  -- Previous year metrics  
  COALESCE(p.total_impressions, 0) as py_impressions,
  COALESCE(p.total_clicks, 0) as py_clicks,
  COALESCE(p.total_purchases, 0) as py_purchases,
  COALESCE(p.avg_ctr, 0) as py_ctr,
  COALESCE(p.avg_cvr, 0) as py_cvr,
  
  -- Year-over-year changes
  c.total_impressions - COALESCE(p.total_impressions, 0) as impressions_yoy,
  CASE 
    WHEN p.total_impressions > 0 THEN ((c.total_impressions - p.total_impressions)::DECIMAL / p.total_impressions * 100)
    ELSE NULL 
  END as impressions_yoy_pct,
  
  c.total_purchases - COALESCE(p.total_purchases, 0) as purchases_yoy,
  CASE 
    WHEN p.total_purchases > 0 THEN ((c.total_purchases - p.total_purchases)::DECIMAL / p.total_purchases * 100)
    ELSE NULL 
  END as purchases_yoy_pct
FROM current_year c
LEFT JOIN previous_year p ON c.query = p.query AND c.asin = p.asin;

-- Performance scoring view
CREATE MATERIALIZED VIEW sqp.performance_scores AS
WITH metrics_stats AS (
  SELECT 
    period_start,
    period_end,
    AVG(avg_ctr) as avg_market_ctr,
    AVG(avg_cvr) as avg_market_cvr,
    AVG(purchases_per_impression) as avg_market_ppi,
    STDDEV(avg_ctr) as stddev_ctr,
    STDDEV(avg_cvr) as stddev_cvr,
    STDDEV(purchases_per_impression) as stddev_ppi
  FROM sqp.weekly_summary
  GROUP BY period_start, period_end
)
SELECT 
  w.period_start,
  w.period_end,
  w.query,
  w.asin,
  
  -- Raw metrics
  w.total_impressions,
  w.total_clicks,
  w.total_purchases,
  w.avg_ctr,
  w.avg_cvr,
  
  -- Z-scores (standardized performance)
  CASE 
    WHEN ms.stddev_ctr > 0 THEN ((w.avg_ctr - ms.avg_market_ctr) / ms.stddev_ctr)
    ELSE 0 
  END as ctr_zscore,
  
  CASE 
    WHEN ms.stddev_cvr > 0 THEN ((w.avg_cvr - ms.avg_market_cvr) / ms.stddev_cvr)
    ELSE 0 
  END as cvr_zscore,
  
  CASE 
    WHEN ms.stddev_ppi > 0 THEN ((w.purchases_per_impression - ms.avg_market_ppi) / ms.stddev_ppi)
    ELSE 0 
  END as ppi_zscore,
  
  -- Performance score (composite)
  (
    CASE WHEN ms.stddev_ctr > 0 THEN ((w.avg_ctr - ms.avg_market_ctr) / ms.stddev_ctr) ELSE 0 END +
    CASE WHEN ms.stddev_cvr > 0 THEN ((w.avg_cvr - ms.avg_market_cvr) / ms.stddev_cvr) ELSE 0 END +
    CASE WHEN ms.stddev_ppi > 0 THEN ((w.purchases_per_impression - ms.avg_market_ppi) / ms.stddev_ppi) ELSE 0 END
  ) / 3 as composite_score,
  
  -- Performance tier
  CASE 
    WHEN ((CASE WHEN ms.stddev_ctr > 0 THEN ((w.avg_ctr - ms.avg_market_ctr) / ms.stddev_ctr) ELSE 0 END +
           CASE WHEN ms.stddev_cvr > 0 THEN ((w.avg_cvr - ms.avg_market_cvr) / ms.stddev_cvr) ELSE 0 END +
           CASE WHEN ms.stddev_ppi > 0 THEN ((w.purchases_per_impression - ms.avg_market_ppi) / ms.stddev_ppi) ELSE 0 END) / 3) > 1 THEN 'A'
    WHEN ((CASE WHEN ms.stddev_ctr > 0 THEN ((w.avg_ctr - ms.avg_market_ctr) / ms.stddev_ctr) ELSE 0 END +
           CASE WHEN ms.stddev_cvr > 0 THEN ((w.avg_cvr - ms.avg_market_cvr) / ms.stddev_cvr) ELSE 0 END +
           CASE WHEN ms.stddev_ppi > 0 THEN ((w.purchases_per_impression - ms.avg_market_ppi) / ms.stddev_ppi) ELSE 0 END) / 3) > 0 THEN 'B'
    WHEN ((CASE WHEN ms.stddev_ctr > 0 THEN ((w.avg_ctr - ms.avg_market_ctr) / ms.stddev_ctr) ELSE 0 END +
           CASE WHEN ms.stddev_cvr > 0 THEN ((w.avg_cvr - ms.avg_market_cvr) / ms.stddev_cvr) ELSE 0 END +
           CASE WHEN ms.stddev_ppi > 0 THEN ((w.purchases_per_impression - ms.avg_market_ppi) / ms.stddev_ppi) ELSE 0 END) / 3) > -1 THEN 'C'
    ELSE 'D'
  END as performance_tier
FROM sqp.weekly_summary w
JOIN metrics_stats ms ON w.period_start = ms.period_start AND w.period_end = ms.period_end;

-- Create indexes on materialized views
CREATE INDEX idx_weekly_trends_query_asin ON sqp.weekly_trends(query, asin);
CREATE INDEX idx_weekly_trends_period ON sqp.weekly_trends(period_start);

CREATE INDEX idx_monthly_trends_query_asin ON sqp.monthly_trends(query, asin);
CREATE INDEX idx_monthly_trends_year_month ON sqp.monthly_trends(year, month);

CREATE INDEX idx_top_keywords_period ON sqp.top_keywords_by_period(period_start);
CREATE INDEX idx_top_keywords_query ON sqp.top_keywords_by_period(query);

CREATE INDEX idx_market_share_period ON sqp.market_share(period_start);
CREATE INDEX idx_market_share_query_asin ON sqp.market_share(query, asin);

CREATE INDEX idx_performance_scores_period ON sqp.performance_scores(period_start);
CREATE INDEX idx_performance_scores_query_asin ON sqp.performance_scores(query, asin);

-- Create refresh function for materialized views
CREATE OR REPLACE FUNCTION sqp.refresh_all_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY sqp.weekly_trends;
  REFRESH MATERIALIZED VIEW CONCURRENTLY sqp.monthly_trends;
  REFRESH MATERIALIZED VIEW CONCURRENTLY sqp.top_keywords_by_period;
  REFRESH MATERIALIZED VIEW CONCURRENTLY sqp.market_share;
  REFRESH MATERIALIZED VIEW CONCURRENTLY sqp.year_over_year;
  REFRESH MATERIALIZED VIEW CONCURRENTLY sqp.performance_scores;
END;
$$ LANGUAGE plpgsql;