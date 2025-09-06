-- Migration: Create Anomaly Detection Functions
-- Description: Implements Z-score based anomaly detection for keyword performance metrics

-- Function to calculate Z-scores for a given metric
CREATE OR REPLACE FUNCTION sqp.calculate_zscore(
  p_value NUMERIC,
  p_mean NUMERIC,
  p_stddev NUMERIC
)
RETURNS NUMERIC AS $$
BEGIN
  IF p_stddev IS NULL OR p_stddev = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN (p_value - p_mean) / p_stddev;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to classify anomaly severity
CREATE OR REPLACE FUNCTION sqp.classify_anomaly(
  p_zscore NUMERIC
)
RETURNS TEXT AS $$
BEGIN
  IF ABS(p_zscore) > 3 THEN
    RETURN 'extreme';
  ELSIF ABS(p_zscore) > 2 THEN
    RETURN 'moderate';
  ELSIF ABS(p_zscore) > 1.5 THEN
    RETURN 'mild';
  ELSE
    RETURN 'normal';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to detect anomalies in keyword performance
CREATE OR REPLACE FUNCTION sqp.detect_keyword_anomalies(
  p_brand_id UUID DEFAULT NULL,
  p_weeks_back INTEGER DEFAULT 12,
  p_min_impressions INTEGER DEFAULT 100
)
RETURNS TABLE (
  asin VARCHAR(20),
  brand_id UUID,
  brand_name VARCHAR(255),
  search_query TEXT,
  week_start DATE,
  metric_name TEXT,
  actual_value NUMERIC,
  expected_value NUMERIC,
  zscore NUMERIC,
  anomaly_type TEXT,
  anomaly_direction TEXT,
  confidence_level NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH historical_stats AS (
    SELECT 
      sp.asin,
      abm.brand_id,
      b.brand_name,
      sp.search_query,
      DATE_TRUNC('week', sp.start_date)::DATE as week_start,
      SUM(sp.impressions_sum) as impressions,
      SUM(sp.clicks_sum) as clicks,
      SUM(sp.purchases_sum) as purchases,
      AVG(CASE WHEN sp.impressions_sum > 0 
          THEN sp.clicks_sum::FLOAT / sp.impressions_sum ELSE NULL END) as ctr,
      AVG(CASE WHEN sp.clicks_sum > 0 
          THEN sp.purchases_sum::FLOAT / sp.clicks_sum ELSE NULL END) as cvr
    FROM sqp.search_query_performance sp
    JOIN sqp.asin_brand_mapping abm ON sp.asin = abm.asin
    JOIN sqp.brands b ON abm.brand_id = b.id
    WHERE (p_brand_id IS NULL OR abm.brand_id = p_brand_id)
      AND sp.start_date >= CURRENT_DATE - (p_weeks_back * INTERVAL '1 week')
    GROUP BY sp.asin, abm.brand_id, b.brand_name, sp.search_query, DATE_TRUNC('week', sp.start_date)
    HAVING SUM(sp.impressions_sum) >= p_min_impressions
  ),
  stats_with_history AS (
    SELECT 
      hs.*,
      -- Calculate rolling statistics for each metric
      AVG(impressions) OVER w as avg_impressions,
      STDDEV(impressions) OVER w as stddev_impressions,
      AVG(clicks) OVER w as avg_clicks,
      STDDEV(clicks) OVER w as stddev_clicks,
      AVG(purchases) OVER w as avg_purchases,
      STDDEV(purchases) OVER w as stddev_purchases,
      AVG(ctr) OVER w as avg_ctr,
      STDDEV(ctr) OVER w as stddev_ctr,
      AVG(cvr) OVER w as avg_cvr,
      STDDEV(cvr) OVER w as stddev_cvr,
      COUNT(*) OVER w as window_size
    FROM historical_stats hs
    WINDOW w AS (
      PARTITION BY asin, search_query 
      ORDER BY week_start 
      ROWS BETWEEN 5 PRECEDING AND 1 PRECEDING  -- Exclude current week from baseline
    )
  ),
  anomaly_calculations AS (
    SELECT 
      asin,
      brand_id,
      brand_name,
      search_query,
      week_start,
      -- Impressions anomalies
      'impressions' as metric_name,
      impressions as actual_value,
      avg_impressions as expected_value,
      sqp.calculate_zscore(impressions, avg_impressions, stddev_impressions) as zscore,
      window_size
    FROM stats_with_history
    WHERE window_size >= 3  -- Minimum history requirement
    
    UNION ALL
    
    SELECT 
      asin,
      brand_id,
      brand_name,
      search_query,
      week_start,
      'clicks' as metric_name,
      clicks as actual_value,
      avg_clicks as expected_value,
      sqp.calculate_zscore(clicks, avg_clicks, stddev_clicks) as zscore,
      window_size
    FROM stats_with_history
    WHERE window_size >= 3
    
    UNION ALL
    
    SELECT 
      asin,
      brand_id,
      brand_name,
      search_query,
      week_start,
      'purchases' as metric_name,
      purchases as actual_value,
      avg_purchases as expected_value,
      sqp.calculate_zscore(purchases, avg_purchases, stddev_purchases) as zscore,
      window_size
    FROM stats_with_history
    WHERE window_size >= 3
    
    UNION ALL
    
    SELECT 
      asin,
      brand_id,
      brand_name,
      search_query,
      week_start,
      'ctr' as metric_name,
      ctr * 100 as actual_value,  -- Convert to percentage
      avg_ctr * 100 as expected_value,
      sqp.calculate_zscore(ctr, avg_ctr, stddev_ctr) as zscore,
      window_size
    FROM stats_with_history
    WHERE window_size >= 3 AND ctr IS NOT NULL
    
    UNION ALL
    
    SELECT 
      asin,
      brand_id,
      brand_name,
      search_query,
      week_start,
      'cvr' as metric_name,
      cvr * 100 as actual_value,  -- Convert to percentage
      avg_cvr * 100 as expected_value,
      sqp.calculate_zscore(cvr, avg_cvr, stddev_cvr) as zscore,
      window_size
    FROM stats_with_history
    WHERE window_size >= 3 AND cvr IS NOT NULL
  )
  SELECT 
    ac.asin::VARCHAR(20),
    ac.brand_id,
    ac.brand_name,
    ac.search_query,
    ac.week_start,
    ac.metric_name,
    ROUND(ac.actual_value::NUMERIC, 2),
    ROUND(ac.expected_value::NUMERIC, 2),
    ROUND(ac.zscore::NUMERIC, 2),
    sqp.classify_anomaly(ac.zscore) as anomaly_type,
    CASE 
      WHEN ac.zscore > 0 THEN 'above_normal'
      WHEN ac.zscore < 0 THEN 'below_normal'
      ELSE 'normal'
    END as anomaly_direction,
    -- Confidence based on sample size
    LEAST(100, (ac.window_size::FLOAT / 6) * 100)::NUMERIC as confidence_level
  FROM anomaly_calculations ac
  WHERE ABS(ac.zscore) > 1.5  -- Only return anomalies
  ORDER BY ABS(ac.zscore) DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to detect market share anomalies
CREATE OR REPLACE FUNCTION sqp.detect_market_share_anomalies(
  p_brand_id UUID DEFAULT NULL,
  p_threshold NUMERIC DEFAULT 0.2  -- 20% change threshold
)
RETURNS TABLE (
  search_query TEXT,
  week_start DATE,
  brand_id UUID,
  brand_name VARCHAR(255),
  our_market_share NUMERIC,
  prev_week_market_share NUMERIC,
  market_share_change NUMERIC,
  total_market_impressions BIGINT,
  anomaly_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH market_share_data AS (
    SELECT 
      sp.search_query,
      DATE_TRUNC('week', sp.start_date)::DATE as week_start,
      abm.brand_id,
      b.brand_name,
      SUM(sp.impressions_sum) as brand_impressions,
      SUM(SUM(sp.impressions_sum)) OVER (PARTITION BY sp.search_query, DATE_TRUNC('week', sp.start_date)) as total_impressions
    FROM sqp.search_query_performance sp
    JOIN sqp.asin_brand_mapping abm ON sp.asin = abm.asin
    JOIN sqp.brands b ON abm.brand_id = b.id
    WHERE (p_brand_id IS NULL OR abm.brand_id = p_brand_id)
    GROUP BY sp.search_query, DATE_TRUNC('week', sp.start_date), abm.brand_id, b.brand_name
  ),
  market_share_calc AS (
    SELECT 
      msd.*,
      (brand_impressions::FLOAT / NULLIF(total_impressions, 0)) as market_share,
      LAG((brand_impressions::FLOAT / NULLIF(total_impressions, 0))) OVER (
        PARTITION BY search_query, brand_id 
        ORDER BY week_start
      ) as prev_week_market_share
    FROM market_share_data msd
  )
  SELECT 
    msc.search_query,
    msc.week_start,
    msc.brand_id,
    msc.brand_name,
    ROUND(msc.market_share * 100, 2) as our_market_share,
    ROUND(msc.prev_week_market_share * 100, 2) as prev_week_market_share,
    ROUND((msc.market_share - COALESCE(msc.prev_week_market_share, 0)) * 100, 2) as market_share_change,
    msc.total_impressions,
    CASE 
      WHEN ABS(msc.market_share - COALESCE(msc.prev_week_market_share, msc.market_share)) > p_threshold THEN
        CASE 
          WHEN msc.market_share > COALESCE(msc.prev_week_market_share, 0) THEN 'significant_gain'
          ELSE 'significant_loss'
        END
      WHEN ABS(msc.market_share - COALESCE(msc.prev_week_market_share, msc.market_share)) > p_threshold/2 THEN
        CASE 
          WHEN msc.market_share > COALESCE(msc.prev_week_market_share, 0) THEN 'moderate_gain'
          ELSE 'moderate_loss'
        END
      ELSE 'stable'
    END as anomaly_type
  FROM market_share_calc msc
  WHERE msc.prev_week_market_share IS NOT NULL
    AND msc.total_impressions > 1000  -- Minimum market size
    AND ABS(msc.market_share - msc.prev_week_market_share) > p_threshold/2
  ORDER BY ABS(msc.market_share - msc.prev_week_market_share) DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get anomaly summary for dashboard
CREATE OR REPLACE FUNCTION sqp.get_anomaly_summary(
  p_brand_id UUID DEFAULT NULL,
  p_days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
  anomaly_count INTEGER,
  extreme_count INTEGER,
  moderate_count INTEGER,
  mild_count INTEGER,
  top_positive_anomaly JSONB,
  top_negative_anomaly JSONB,
  affected_keywords INTEGER,
  affected_asins INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH recent_anomalies AS (
    SELECT * FROM sqp.detect_keyword_anomalies(
      p_brand_id, 
      CEIL(p_days_back::FLOAT / 7)::INTEGER,  -- Convert days to weeks
      100
    )
    WHERE week_start >= CURRENT_DATE - (p_days_back || ' days')::INTERVAL
  ),
  summary_stats AS (
    SELECT 
      COUNT(*)::INTEGER as anomaly_count,
      COUNT(*) FILTER (WHERE anomaly_type = 'extreme')::INTEGER as extreme_count,
      COUNT(*) FILTER (WHERE anomaly_type = 'moderate')::INTEGER as moderate_count,
      COUNT(*) FILTER (WHERE anomaly_type = 'mild')::INTEGER as mild_count,
      COUNT(DISTINCT search_query)::INTEGER as affected_keywords,
      COUNT(DISTINCT asin)::INTEGER as affected_asins
    FROM recent_anomalies
  ),
  top_anomalies AS (
    SELECT 
      (SELECT jsonb_build_object(
        'search_query', search_query,
        'asin', asin,
        'metric', metric_name,
        'zscore', zscore,
        'actual', actual_value,
        'expected', expected_value
      ) FROM recent_anomalies 
      WHERE anomaly_direction = 'above_normal' 
      ORDER BY zscore DESC LIMIT 1) as top_positive,
      
      (SELECT jsonb_build_object(
        'search_query', search_query,
        'asin', asin,
        'metric', metric_name,
        'zscore', zscore,
        'actual', actual_value,
        'expected', expected_value
      ) FROM recent_anomalies 
      WHERE anomaly_direction = 'below_normal' 
      ORDER BY zscore ASC LIMIT 1) as top_negative
  )
  SELECT 
    ss.anomaly_count,
    ss.extreme_count,
    ss.moderate_count,
    ss.mild_count,
    ta.top_positive,
    ta.top_negative,
    ss.affected_keywords,
    ss.affected_asins
  FROM summary_stats ss
  CROSS JOIN top_anomalies ta;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create indexes for anomaly detection
CREATE INDEX IF NOT EXISTS idx_search_query_performance_anomaly 
ON sqp.search_query_performance (start_date DESC, asin, search_query) 
WHERE impressions_sum > 100;

-- Grant permissions
GRANT EXECUTE ON FUNCTION sqp.calculate_zscore TO authenticated;
GRANT EXECUTE ON FUNCTION sqp.classify_anomaly TO authenticated;
GRANT EXECUTE ON FUNCTION sqp.detect_keyword_anomalies TO authenticated;
GRANT EXECUTE ON FUNCTION sqp.detect_market_share_anomalies TO authenticated;
GRANT EXECUTE ON FUNCTION sqp.get_anomaly_summary TO authenticated;

-- Add comments
COMMENT ON FUNCTION sqp.calculate_zscore IS 'Calculates Z-score for anomaly detection';
COMMENT ON FUNCTION sqp.classify_anomaly IS 'Classifies anomaly severity based on Z-score';
COMMENT ON FUNCTION sqp.detect_keyword_anomalies IS 'Detects anomalies in keyword performance metrics';
COMMENT ON FUNCTION sqp.detect_market_share_anomalies IS 'Detects significant changes in market share';
COMMENT ON FUNCTION sqp.get_anomaly_summary IS 'Returns summary statistics of recent anomalies';