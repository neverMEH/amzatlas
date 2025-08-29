-- Migration: Create Rolling Average Views and Functions
-- Description: Implements 6-week rolling averages for keyword trend analysis

-- Create function to calculate rolling window metrics
CREATE OR REPLACE FUNCTION sqp.calculate_rolling_metrics(
  p_window_size INTEGER DEFAULT 6
)
RETURNS TABLE (
  o_asin VARCHAR(20),
  o_brand_id UUID,
  o_search_query TEXT,
  o_week_start DATE,
  o_impressions BIGINT,
  o_clicks BIGINT,
  o_cart_adds BIGINT,
  o_purchases BIGINT,
  o_ctr FLOAT,
  o_cart_add_rate FLOAT,
  o_cvr FLOAT,
  o_rolling_avg_impressions FLOAT,
  o_rolling_avg_clicks FLOAT,
  o_rolling_avg_purchases FLOAT,
  o_rolling_avg_ctr FLOAT,
  o_rolling_avg_cvr FLOAT,
  o_impressions_trend FLOAT,
  o_clicks_trend FLOAT,
  o_purchases_trend FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH weekly_data AS (
    SELECT 
      sp.asin,
      abm.brand_id,
      sp.search_query,
      DATE_TRUNC('week', sp.start_date)::DATE as week_start,
      SUM(sp.impressions_sum) as impressions,
      SUM(sp.clicks_sum) as clicks,
      SUM(sp.cart_adds_sum) as cart_adds,
      SUM(sp.purchases_sum) as purchases,
      CASE WHEN SUM(sp.impressions_sum) > 0 
        THEN SUM(sp.clicks_sum)::FLOAT / SUM(sp.impressions_sum) 
        ELSE NULL END as ctr,
      CASE WHEN SUM(sp.clicks_sum) > 0 
        THEN SUM(sp.cart_adds_sum)::FLOAT / SUM(sp.clicks_sum) 
        ELSE NULL END as cart_add_rate,
      CASE WHEN SUM(sp.clicks_sum) > 0 
        THEN SUM(sp.purchases_sum)::FLOAT / SUM(sp.clicks_sum) 
        ELSE NULL END as cvr
    FROM sqp.search_query_performance sp
    JOIN sqp.asin_brand_mapping abm ON sp.asin = abm.asin
    GROUP BY sp.asin, abm.brand_id, sp.search_query, DATE_TRUNC('week', sp.start_date)
  ),
  rolling_calcs AS (
    SELECT 
      wd.*,
      -- Rolling averages
      AVG(wd.impressions) OVER w as rolling_avg_impressions,
      AVG(wd.clicks) OVER w as rolling_avg_clicks,
      AVG(wd.purchases) OVER w as rolling_avg_purchases,
      AVG(wd.ctr) OVER w as rolling_avg_ctr,
      AVG(wd.cvr) OVER w as rolling_avg_cvr,
      
      -- Trend calculations (slope of linear regression over window)
      REGR_SLOPE(wd.impressions, EXTRACT(EPOCH FROM wd.week_start)::FLOAT) OVER w as impressions_trend,
      REGR_SLOPE(wd.clicks, EXTRACT(EPOCH FROM wd.week_start)::FLOAT) OVER w as clicks_trend,
      REGR_SLOPE(wd.purchases, EXTRACT(EPOCH FROM wd.week_start)::FLOAT) OVER w as purchases_trend
    FROM weekly_data wd
    WINDOW w AS (
      PARTITION BY wd.asin, wd.search_query 
      ORDER BY wd.week_start 
      ROWS BETWEEN (p_window_size - 1) PRECEDING AND CURRENT ROW
    )
  )
  SELECT 
    rc.asin::VARCHAR(20) as o_asin,
    rc.brand_id as o_brand_id,
    rc.search_query as o_search_query,
    rc.week_start as o_week_start,
    rc.impressions::BIGINT as o_impressions,
    rc.clicks::BIGINT as o_clicks,
    rc.cart_adds::BIGINT as o_cart_adds,
    rc.purchases::BIGINT as o_purchases,
    rc.ctr::FLOAT as o_ctr,
    rc.cart_add_rate::FLOAT as o_cart_add_rate,
    rc.cvr::FLOAT as o_cvr,
    rc.rolling_avg_impressions::FLOAT as o_rolling_avg_impressions,
    rc.rolling_avg_clicks::FLOAT as o_rolling_avg_clicks,
    rc.rolling_avg_purchases::FLOAT as o_rolling_avg_purchases,
    rc.rolling_avg_ctr::FLOAT as o_rolling_avg_ctr,
    rc.rolling_avg_cvr::FLOAT as o_rolling_avg_cvr,
    rc.impressions_trend::FLOAT as o_impressions_trend,
    rc.clicks_trend::FLOAT as o_clicks_trend,
    rc.purchases_trend::FLOAT as o_purchases_trend
  FROM rolling_calcs rc;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create materialized view for 6-week rolling averages
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.keyword_rolling_averages AS
SELECT 
  o_asin as asin,
  o_brand_id as brand_id,
  o_search_query as search_query,
  o_week_start as week_start,
  o_impressions as impressions,
  o_clicks as clicks,
  o_cart_adds as cart_adds,
  o_purchases as purchases,
  o_ctr as ctr,
  o_cart_add_rate as cart_add_rate,
  o_cvr as cvr,
  o_rolling_avg_impressions as rolling_avg_impressions,
  o_rolling_avg_clicks as rolling_avg_clicks,
  o_rolling_avg_purchases as rolling_avg_purchases,
  o_rolling_avg_ctr as rolling_avg_ctr,
  o_rolling_avg_cvr as rolling_avg_cvr,
  o_impressions_trend as impressions_trend,
  o_clicks_trend as clicks_trend,
  o_purchases_trend as purchases_trend
FROM sqp.calculate_rolling_metrics(6);

CREATE INDEX idx_keyword_rolling_avg_asin_query 
ON sqp.keyword_rolling_averages (asin, search_query, week_start DESC);

CREATE INDEX idx_keyword_rolling_avg_brand 
ON sqp.keyword_rolling_averages (brand_id, week_start DESC);

CREATE INDEX idx_keyword_rolling_avg_query 
ON sqp.keyword_rolling_averages (search_query, week_start DESC);

-- Create view for keyword trend analysis
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.keyword_trend_analysis AS
WITH recent_trends AS (
  SELECT 
    kra.*,
    -- Calculate standard deviation for anomaly detection
    STDDEV(impressions) OVER w as impressions_stddev,
    STDDEV(clicks) OVER w as clicks_stddev,
    STDDEV(purchases) OVER w as purchases_stddev,
    
    -- Calculate Z-scores
    CASE 
      WHEN STDDEV(impressions) OVER w > 0 
      THEN (impressions - rolling_avg_impressions) / STDDEV(impressions) OVER w
      ELSE 0 
    END as impressions_zscore,
    
    CASE 
      WHEN STDDEV(clicks) OVER w > 0 
      THEN (clicks - rolling_avg_clicks) / STDDEV(clicks) OVER w
      ELSE 0 
    END as clicks_zscore,
    
    CASE 
      WHEN STDDEV(purchases) OVER w > 0 
      THEN (purchases - rolling_avg_purchases) / STDDEV(purchases) OVER w
      ELSE 0 
    END as purchases_zscore,
    
    -- Trend strength (R-squared of linear regression)
    CASE 
      WHEN COUNT(*) OVER w >= 3 
      THEN POWER(CORR(impressions, EXTRACT(EPOCH FROM week_start)::FLOAT) OVER w, 2)
      ELSE NULL 
    END as impressions_trend_strength,
    
    -- Volatility measure
    CASE 
      WHEN rolling_avg_impressions > 0 
      THEN STDDEV(impressions) OVER w / rolling_avg_impressions
      ELSE NULL 
    END as impressions_volatility
    
  FROM sqp.keyword_rolling_averages kra
  WINDOW w AS (
    PARTITION BY asin, search_query 
    ORDER BY week_start 
    ROWS BETWEEN 5 PRECEDING AND CURRENT ROW
  )
),
trend_classification AS (
  SELECT 
    rt.*,
    -- Classify trends
    CASE 
      WHEN impressions_trend > 0 AND impressions_trend_strength > 0.7 THEN 'strong_growth'
      WHEN impressions_trend > 0 AND impressions_trend_strength > 0.3 THEN 'moderate_growth'
      WHEN impressions_trend < 0 AND impressions_trend_strength > 0.7 THEN 'strong_decline'
      WHEN impressions_trend < 0 AND impressions_trend_strength > 0.3 THEN 'moderate_decline'
      WHEN impressions_volatility > 0.5 THEN 'volatile'
      ELSE 'stable'
    END as trend_classification,
    
    -- Anomaly detection
    CASE 
      WHEN ABS(impressions_zscore) > 3 THEN 'extreme_anomaly'
      WHEN ABS(impressions_zscore) > 2 THEN 'moderate_anomaly'
      WHEN ABS(impressions_zscore) > 1.5 THEN 'mild_anomaly'
      ELSE 'normal'
    END as anomaly_status,
    
    -- Performance relative to average
    CASE 
      WHEN rolling_avg_impressions > 0 
      THEN ((impressions - rolling_avg_impressions) / rolling_avg_impressions) * 100
      ELSE NULL 
    END as impressions_vs_avg_pct,
    
    CASE 
      WHEN rolling_avg_cvr > 0 
      THEN ((cvr - rolling_avg_cvr) / rolling_avg_cvr) * 100
      ELSE NULL 
    END as cvr_vs_avg_pct
    
  FROM recent_trends rt
)
SELECT 
  tc.*,
  -- Add brand information
  b.brand_name,
  b.display_name as brand_display_name
FROM trend_classification tc
JOIN sqp.brands b ON tc.brand_id = b.id;

CREATE INDEX idx_keyword_trend_analysis_asin_query 
ON sqp.keyword_trend_analysis (asin, search_query, week_start DESC);

CREATE INDEX idx_keyword_trend_analysis_brand 
ON sqp.keyword_trend_analysis (brand_id, week_start DESC);

CREATE INDEX idx_keyword_trend_analysis_classification 
ON sqp.keyword_trend_analysis (trend_classification, week_start DESC);

CREATE INDEX idx_keyword_trend_analysis_anomaly 
ON sqp.keyword_trend_analysis (anomaly_status) 
WHERE anomaly_status != 'normal';

-- Create summary view for top trending keywords
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.top_trending_keywords AS
WITH latest_week AS (
  SELECT MAX(week_start) as max_week FROM sqp.keyword_trend_analysis
),
recent_keywords AS (
  SELECT 
    kta.*,
    ROW_NUMBER() OVER (
      PARTITION BY brand_id, trend_classification 
      ORDER BY 
        CASE 
          WHEN trend_classification IN ('strong_growth', 'moderate_growth') 
          THEN impressions_trend 
          ELSE -impressions_trend 
        END DESC,
        impressions DESC
    ) as rank_in_category
  FROM sqp.keyword_trend_analysis kta
  CROSS JOIN latest_week lw
  WHERE kta.week_start >= lw.max_week - INTERVAL '4 weeks'
    AND kta.impressions > 100  -- Minimum threshold
),
query_metrics AS (
  SELECT 
    search_query,
    SUM(impressions) as total_query_impressions,
    COUNT(DISTINCT asin) as query_asin_count
  FROM recent_keywords
  GROUP BY search_query
)
SELECT 
  rk.*,
  qm.total_query_impressions,
  qm.query_asin_count
FROM recent_keywords rk
LEFT JOIN query_metrics qm ON rk.search_query = qm.search_query
WHERE rk.rank_in_category <= 20;  -- Top 20 per category per brand

CREATE INDEX idx_top_trending_keywords_brand 
ON sqp.top_trending_keywords (brand_id, trend_classification);

-- Grant permissions
GRANT SELECT ON sqp.keyword_rolling_averages TO authenticated;
GRANT SELECT ON sqp.keyword_trend_analysis TO authenticated;
GRANT SELECT ON sqp.top_trending_keywords TO authenticated;
GRANT EXECUTE ON FUNCTION sqp.calculate_rolling_metrics TO authenticated;

-- Add comments
COMMENT ON FUNCTION sqp.calculate_rolling_metrics IS 'Calculates rolling window metrics for keyword performance';
COMMENT ON MATERIALIZED VIEW sqp.keyword_rolling_averages IS '6-week rolling averages for keyword performance metrics';
COMMENT ON MATERIALIZED VIEW sqp.keyword_trend_analysis IS 'Comprehensive keyword trend analysis with anomaly detection';
COMMENT ON MATERIALIZED VIEW sqp.top_trending_keywords IS 'Top trending keywords by brand and trend classification';