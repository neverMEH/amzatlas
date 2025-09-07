-- Migration: Create Trend Classification Functions
-- Description: Functions to classify keyword trends as emerging, declining, stable, or volatile

-- Function to calculate trend metrics
CREATE OR REPLACE FUNCTION sqp.calculate_trend_metrics(
  p_values NUMERIC[],
  p_timestamps BIGINT[]
)
RETURNS TABLE (
  slope NUMERIC,
  r_squared NUMERIC,
  volatility NUMERIC,
  momentum NUMERIC
) AS $$
DECLARE
  n INTEGER;
  sum_x NUMERIC := 0;
  sum_y NUMERIC := 0;
  sum_xy NUMERIC := 0;
  sum_x2 NUMERIC := 0;
  sum_y2 NUMERIC := 0;
  mean_y NUMERIC;
  ss_tot NUMERIC := 0;
  ss_res NUMERIC := 0;
  i INTEGER;
  y_pred NUMERIC;
  variance_sum NUMERIC := 0;
  stddev_val NUMERIC;
BEGIN
  n := array_length(p_values, 1);
  
  IF n < 3 THEN
    RETURN QUERY SELECT NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;
  
  -- Calculate sums for linear regression
  FOR i IN 1..n LOOP
    sum_x := sum_x + p_timestamps[i];
    sum_y := sum_y + p_values[i];
    sum_xy := sum_xy + (p_timestamps[i] * p_values[i]);
    sum_x2 := sum_x2 + (p_timestamps[i] * p_timestamps[i]);
    sum_y2 := sum_y2 + (p_values[i] * p_values[i]);
  END LOOP;
  
  -- Calculate slope
  slope := (n * sum_xy - sum_x * sum_y) / NULLIF(n * sum_x2 - sum_x * sum_x, 0);
  
  -- Calculate R-squared
  mean_y := sum_y / n;
  
  FOR i IN 1..n LOOP
    y_pred := slope * p_timestamps[i] + (sum_y - slope * sum_x) / n;
    ss_tot := ss_tot + POWER(p_values[i] - mean_y, 2);
    ss_res := ss_res + POWER(p_values[i] - y_pred, 2);
  END LOOP;
  
  r_squared := 1 - (ss_res / NULLIF(ss_tot, 0));
  
  -- Calculate volatility (coefficient of variation)
  -- Manual standard deviation calculation for array
  FOR i IN 1..n LOOP
    variance_sum := variance_sum + POWER(p_values[i] - mean_y, 2);
  END LOOP;
  
  stddev_val := SQRT(variance_sum / n);
  
  volatility := CASE 
    WHEN mean_y > 0 THEN stddev_val / mean_y
    ELSE NULL 
  END;
  
  -- Calculate momentum (recent vs historical average)
  momentum := CASE 
    WHEN n >= 6 AND mean_y > 0 THEN 
      ((p_values[n] + p_values[n-1] + p_values[n-2]) / 3.0 - mean_y) / mean_y
    ELSE NULL 
  END;
  
  RETURN QUERY SELECT 
    COALESCE(slope, 0)::NUMERIC,
    COALESCE(r_squared, 0)::NUMERIC,
    COALESCE(volatility, 0)::NUMERIC,
    COALESCE(momentum, 0)::NUMERIC;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to classify keyword trends
CREATE OR REPLACE FUNCTION sqp.classify_keyword_trend(
  p_slope NUMERIC,
  p_r_squared NUMERIC,
  p_volatility NUMERIC,
  p_momentum NUMERIC,
  p_current_value NUMERIC,
  p_avg_value NUMERIC
)
RETURNS TEXT AS $$
BEGIN
  -- High volatility trumps other classifications
  IF p_volatility > 0.5 THEN
    RETURN 'volatile';
  END IF;
  
  -- Strong trends with good fit
  IF p_r_squared > 0.7 THEN
    IF p_slope > 0 AND p_momentum > 0.2 THEN
      RETURN 'emerging';
    ELSIF p_slope < 0 AND p_momentum < -0.2 THEN
      RETURN 'declining';
    END IF;
  END IF;
  
  -- Moderate trends
  IF p_r_squared > 0.3 THEN
    IF p_slope > 0 AND p_current_value > p_avg_value * 1.1 THEN
      RETURN 'growing';
    ELSIF p_slope < 0 AND p_current_value < p_avg_value * 0.9 THEN
      RETURN 'weakening';
    END IF;
  END IF;
  
  -- Recent spikes or drops
  IF p_momentum > 0.5 THEN
    RETURN 'surging';
  ELSIF p_momentum < -0.5 THEN
    RETURN 'plummeting';
  END IF;
  
  -- Default
  RETURN 'stable';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Main function to analyze keyword trends
CREATE OR REPLACE FUNCTION sqp.analyze_keyword_trends(
  p_brand_id UUID DEFAULT NULL,
  p_weeks INTEGER DEFAULT 12,
  p_min_impressions INTEGER DEFAULT 100
)
RETURNS TABLE (
  o_asin VARCHAR(20),
  o_brand_id UUID,
  o_brand_name VARCHAR(255),
  o_search_query TEXT,
  o_current_week_impressions BIGINT,
  o_avg_weekly_impressions NUMERIC,
  o_trend_classification TEXT,
  o_trend_strength NUMERIC,
  o_trend_direction TEXT,
  o_volatility_score NUMERIC,
  o_momentum_score NUMERIC,
  o_weeks_of_data INTEGER,
  o_first_seen_date DATE,
  o_last_seen_date DATE
) AS $$
BEGIN
  RETURN QUERY
  WITH weekly_data AS (
    SELECT 
      sp.asin,
      abm.brand_id,
      b.brand_name,
      sp.search_query,
      DATE_TRUNC('week', sp.start_date)::DATE as week_start,
      SUM(sp.impressions_sum) as impressions,
      SUM(sp.clicks_sum) as clicks,
      SUM(sp.purchases_sum) as purchases
    FROM sqp.search_query_performance sp
    JOIN sqp.asin_brand_mapping abm ON sp.asin = abm.asin
    JOIN sqp.brands b ON abm.brand_id = b.id
    WHERE (p_brand_id IS NULL OR abm.brand_id = p_brand_id)
      AND sp.start_date >= CURRENT_DATE - (p_weeks * INTERVAL '1 week')
    GROUP BY sp.asin, abm.brand_id, b.brand_name, sp.search_query, DATE_TRUNC('week', sp.start_date)
    HAVING SUM(sp.impressions_sum) >= p_min_impressions / p_weeks  -- Average minimum
  ),
  keyword_arrays AS (
    SELECT 
      wd.asin,
      wd.brand_id,
      wd.brand_name,
      wd.search_query,
      array_agg(wd.impressions ORDER BY wd.week_start) as impression_values,
      array_agg(EXTRACT(EPOCH FROM wd.week_start)::BIGINT ORDER BY wd.week_start) as timestamps,
      array_agg(wd.week_start ORDER BY wd.week_start) as week_starts,
      COUNT(*) as weeks_of_data,
      MIN(wd.week_start) as first_seen,
      MAX(wd.week_start) as last_seen,
      AVG(wd.impressions) as avg_impressions
    FROM weekly_data wd
    GROUP BY wd.asin, wd.brand_id, wd.brand_name, wd.search_query
    HAVING COUNT(*) >= 3  -- Minimum data points
  ),
  trend_calculations AS (
    SELECT 
      ka.*,
      tm.slope,
      tm.r_squared,
      tm.volatility,
      tm.momentum,
      ka.impression_values[array_length(ka.impression_values, 1)] as current_impressions
    FROM keyword_arrays ka
    CROSS JOIN LATERAL sqp.calculate_trend_metrics(
      ka.impression_values::NUMERIC[], 
      ka.timestamps
    ) tm
  )
  SELECT 
    tc.asin::VARCHAR(20) as o_asin,
    tc.brand_id as o_brand_id,
    tc.brand_name as o_brand_name,
    tc.search_query as o_search_query,
    tc.current_impressions::BIGINT as o_current_week_impressions,
    ROUND(tc.avg_impressions, 0) as o_avg_weekly_impressions,
    sqp.classify_keyword_trend(
      tc.slope,
      tc.r_squared,
      tc.volatility,
      tc.momentum,
      tc.current_impressions,
      tc.avg_impressions
    ) as o_trend_classification,
    ROUND(tc.r_squared, 3) as o_trend_strength,
    CASE 
      WHEN tc.slope > 0 THEN 'up'
      WHEN tc.slope < 0 THEN 'down'
      ELSE 'flat'
    END as o_trend_direction,
    ROUND(tc.volatility, 3) as o_volatility_score,
    ROUND(tc.momentum, 3) as o_momentum_score,
    tc.weeks_of_data::INTEGER as o_weeks_of_data,
    tc.first_seen as o_first_seen_date,
    tc.last_seen as o_last_seen_date
  FROM trend_calculations tc
  WHERE tc.avg_impressions >= p_min_impressions
  ORDER BY 
    CASE sqp.classify_keyword_trend(tc.slope, tc.r_squared, tc.volatility, tc.momentum, tc.current_impressions, tc.avg_impressions)
      WHEN 'emerging' THEN 1
      WHEN 'surging' THEN 2
      WHEN 'declining' THEN 3
      WHEN 'plummeting' THEN 4
      WHEN 'volatile' THEN 5
      ELSE 6
    END,
    ABS(tc.momentum) DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get trend distribution summary
CREATE OR REPLACE FUNCTION sqp.get_trend_distribution(
  p_brand_id UUID DEFAULT NULL
)
RETURNS TABLE (
  trend_type TEXT,
  keyword_count INTEGER,
  avg_impressions NUMERIC,
  total_impressions BIGINT,
  example_keywords TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  WITH trend_data AS (
    SELECT 
      o_asin as asin,
      o_brand_id as brand_id,
      o_brand_name as brand_name,
      o_search_query as search_query,
      o_current_week_impressions as current_week_impressions,
      o_avg_weekly_impressions as avg_weekly_impressions,
      o_trend_classification as trend_classification,
      o_trend_strength as trend_strength,
      o_trend_direction as trend_direction,
      o_volatility_score as volatility_score,
      o_momentum_score as momentum_score,
      o_weeks_of_data as weeks_of_data,
      o_first_seen_date as first_seen_date,
      o_last_seen_date as last_seen_date
    FROM sqp.analyze_keyword_trends(p_brand_id, 12, 100)
  ),
  trend_summary AS (
    SELECT 
      trend_classification as trend_type,
      COUNT(*)::INTEGER as keyword_count,
      AVG(current_week_impressions)::NUMERIC as avg_impressions,
      SUM(current_week_impressions)::BIGINT as total_impressions,
      array_agg(DISTINCT search_query ORDER BY current_week_impressions DESC) 
        FILTER (WHERE row_number <= 5) as example_keywords
    FROM (
      SELECT 
        *,
        ROW_NUMBER() OVER (PARTITION BY trend_classification ORDER BY current_week_impressions DESC) as row_number
      FROM trend_data
    ) ranked
    GROUP BY trend_classification
  )
  SELECT * FROM trend_summary
  ORDER BY 
    CASE trend_type
      WHEN 'emerging' THEN 1
      WHEN 'surging' THEN 2
      WHEN 'growing' THEN 3
      WHEN 'stable' THEN 4
      WHEN 'volatile' THEN 5
      WHEN 'weakening' THEN 6
      WHEN 'declining' THEN 7
      WHEN 'plummeting' THEN 8
      ELSE 9
    END;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create materialized view for trend snapshots
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.keyword_trend_snapshot AS
SELECT 
  o_asin as asin,
  o_brand_id as brand_id,
  o_brand_name as brand_name,
  o_search_query as search_query,
  o_current_week_impressions as current_week_impressions,
  o_avg_weekly_impressions as avg_weekly_impressions,
  o_trend_classification as trend_classification,
  o_trend_strength as trend_strength,
  o_trend_direction as trend_direction,
  o_volatility_score as volatility_score,
  o_momentum_score as momentum_score,
  o_weeks_of_data as weeks_of_data,
  o_first_seen_date as first_seen_date,
  o_last_seen_date as last_seen_date,
  CURRENT_DATE as snapshot_date,
  CASE 
    WHEN o_trend_classification IN ('emerging', 'surging') THEN 'opportunity'
    WHEN o_trend_classification IN ('declining', 'plummeting') THEN 'risk'
    WHEN o_trend_classification = 'volatile' THEN 'monitor'
    ELSE 'maintain'
  END as action_type
FROM sqp.analyze_keyword_trends(NULL, 12, 100);

CREATE INDEX idx_keyword_trend_snapshot_brand 
ON sqp.keyword_trend_snapshot (brand_id, trend_classification);

CREATE INDEX idx_keyword_trend_snapshot_query 
ON sqp.keyword_trend_snapshot (search_query, snapshot_date DESC);

CREATE INDEX idx_keyword_trend_snapshot_action 
ON sqp.keyword_trend_snapshot (action_type, trend_strength DESC);

-- Grant permissions
GRANT EXECUTE ON FUNCTION sqp.calculate_trend_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION sqp.classify_keyword_trend TO authenticated;
GRANT EXECUTE ON FUNCTION sqp.analyze_keyword_trends TO authenticated;
GRANT EXECUTE ON FUNCTION sqp.get_trend_distribution TO authenticated;
GRANT SELECT ON sqp.keyword_trend_snapshot TO authenticated;

-- Add comments
COMMENT ON FUNCTION sqp.calculate_trend_metrics IS 'Calculates statistical metrics for trend analysis';
COMMENT ON FUNCTION sqp.classify_keyword_trend IS 'Classifies trends based on statistical metrics';
COMMENT ON FUNCTION sqp.analyze_keyword_trends IS 'Comprehensive keyword trend analysis with classification';
COMMENT ON FUNCTION sqp.get_trend_distribution IS 'Summary of trend types and distribution';
COMMENT ON MATERIALIZED VIEW sqp.keyword_trend_snapshot IS 'Point-in-time snapshot of keyword trends';