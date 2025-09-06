-- Migration: Create Period Comparison Functions
-- Description: Functions for flexible period comparisons with brand filtering

-- Function to get period comparison data
CREATE OR REPLACE FUNCTION sqp.get_period_comparison(
  p_period_type TEXT, -- 'week', 'month', 'quarter', 'year'
  p_brand_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_include_sub_brands BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  period_start DATE,
  period_label TEXT,
  brand_id UUID,
  brand_name VARCHAR(255),
  total_impressions BIGINT,
  total_clicks BIGINT,
  total_cart_adds BIGINT,
  total_purchases BIGINT,
  total_revenue NUMERIC,
  avg_ctr NUMERIC,
  avg_cart_add_rate NUMERIC,
  avg_cvr NUMERIC,
  unique_asins INTEGER,
  unique_queries INTEGER,
  prev_period_impressions BIGINT,
  prev_period_purchases BIGINT,
  prev_period_revenue NUMERIC,
  impressions_change_pct NUMERIC,
  purchases_change_pct NUMERIC,
  revenue_change_pct NUMERIC,
  ctr_change_pts NUMERIC,
  cvr_change_pts NUMERIC
) AS $$
DECLARE
  v_interval TEXT;
  v_format TEXT;
BEGIN
  -- Set interval and format based on period type
  CASE p_period_type
    WHEN 'week' THEN
      v_interval := '1 week';
      v_format := 'YYYY-"W"IW';
    WHEN 'month' THEN
      v_interval := '1 month';
      v_format := 'YYYY-MM';
    WHEN 'quarter' THEN
      v_interval := '3 months';
      v_format := '"Q"Q YYYY';
    WHEN 'year' THEN
      v_interval := '1 year';
      v_format := 'YYYY';
    ELSE
      RAISE EXCEPTION 'Invalid period type: %', p_period_type;
  END CASE;
  
  RETURN QUERY
  WITH brand_asins AS (
    -- Get ASINs for the brand(s)
    SELECT DISTINCT asin
    FROM sqp.get_brand_asins(p_brand_id, p_include_sub_brands)
  ),
  period_metrics AS (
    SELECT 
      DATE_TRUNC(p_period_type, sp.start_date)::DATE as period_start,
      TO_CHAR(DATE_TRUNC(p_period_type, sp.start_date), v_format) as period_label,
      abm.brand_id,
      b.brand_name,
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
      COUNT(DISTINCT sp.asin) as unique_asins,
      COUNT(DISTINCT sp.search_query) as unique_queries
    FROM sqp.search_query_performance sp
    JOIN sqp.asin_brand_mapping abm ON sp.asin = abm.asin
    JOIN sqp.brands b ON abm.brand_id = b.id
    WHERE (p_brand_id IS NULL OR sp.asin IN (SELECT asin FROM brand_asins))
      AND (p_start_date IS NULL OR sp.start_date >= p_start_date)
      AND (p_end_date IS NULL OR sp.end_date <= p_end_date)
    GROUP BY 
      DATE_TRUNC(p_period_type, sp.start_date),
      abm.brand_id,
      b.brand_name
  ),
  period_comparisons AS (
    SELECT 
      curr.*,
      prev.impressions as prev_impressions,
      prev.purchases as prev_purchases,
      prev.revenue as prev_revenue,
      prev.ctr as prev_ctr,
      prev.cvr as prev_cvr,
      
      -- Calculate percentage changes
      CASE WHEN prev.impressions > 0 
        THEN ((curr.impressions - prev.impressions)::FLOAT / prev.impressions) * 100 
        ELSE NULL END as impressions_change_pct,
      CASE WHEN prev.purchases > 0 
        THEN ((curr.purchases - prev.purchases)::FLOAT / prev.purchases) * 100 
        ELSE NULL END as purchases_change_pct,
      CASE WHEN prev.revenue > 0 
        THEN ((curr.revenue - prev.revenue)::FLOAT / prev.revenue) * 100 
        ELSE NULL END as revenue_change_pct,
      
      -- Point changes for rates
      (curr.ctr - COALESCE(prev.ctr, 0)) * 100 as ctr_change_pts,
      (curr.cvr - COALESCE(prev.cvr, 0)) * 100 as cvr_change_pts
      
    FROM period_metrics curr
    LEFT JOIN period_metrics prev 
      ON curr.brand_id = prev.brand_id 
      AND curr.period_start = (prev.period_start + v_interval::INTERVAL)
  )
  SELECT 
    pc.period_start,
    pc.period_label,
    pc.brand_id,
    pc.brand_name,
    pc.impressions::BIGINT as total_impressions,
    pc.clicks::BIGINT as total_clicks,
    pc.cart_adds::BIGINT as total_cart_adds,
    pc.purchases::BIGINT as total_purchases,
    ROUND(pc.revenue, 2) as total_revenue,
    ROUND(pc.ctr * 100, 2) as avg_ctr,
    ROUND(pc.cart_add_rate * 100, 2) as avg_cart_add_rate,
    ROUND(pc.cvr * 100, 2) as avg_cvr,
    pc.unique_asins::INTEGER,
    pc.unique_queries::INTEGER,
    pc.prev_impressions::BIGINT as prev_period_impressions,
    pc.prev_purchases::BIGINT as prev_period_purchases,
    ROUND(pc.prev_revenue, 2) as prev_period_revenue,
    ROUND(pc.impressions_change_pct, 1) as impressions_change_pct,
    ROUND(pc.purchases_change_pct, 1) as purchases_change_pct,
    ROUND(pc.revenue_change_pct, 1) as revenue_change_pct,
    ROUND(pc.ctr_change_pts, 2) as ctr_change_pts,
    ROUND(pc.cvr_change_pts, 2) as cvr_change_pts
  FROM period_comparisons pc
  ORDER BY pc.period_start DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function for custom date range comparisons
CREATE OR REPLACE FUNCTION sqp.compare_date_ranges(
  p_current_start DATE,
  p_current_end DATE,
  p_previous_start DATE,
  p_previous_end DATE,
  p_brand_id UUID DEFAULT NULL
)
RETURNS TABLE (
  metric_name TEXT,
  current_value NUMERIC,
  previous_value NUMERIC,
  absolute_change NUMERIC,
  percent_change NUMERIC,
  is_improvement BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH current_period AS (
    SELECT 
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
      COUNT(DISTINCT sp.asin) as unique_asins
    FROM sqp.search_query_performance sp
    LEFT JOIN sqp.asin_brand_mapping abm ON sp.asin = abm.asin
    WHERE sp.start_date >= p_current_start 
      AND sp.end_date <= p_current_end
      AND (p_brand_id IS NULL OR abm.brand_id = p_brand_id)
  ),
  previous_period AS (
    SELECT 
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
      COUNT(DISTINCT sp.asin) as unique_asins
    FROM sqp.search_query_performance sp
    LEFT JOIN sqp.asin_brand_mapping abm ON sp.asin = abm.asin
    WHERE sp.start_date >= p_previous_start 
      AND sp.end_date <= p_previous_end
      AND (p_brand_id IS NULL OR abm.brand_id = p_brand_id)
  )
  SELECT 
    'Impressions' as metric_name,
    curr.impressions::NUMERIC as current_value,
    prev.impressions::NUMERIC as previous_value,
    (curr.impressions - prev.impressions)::NUMERIC as absolute_change,
    CASE WHEN prev.impressions > 0 
      THEN ((curr.impressions - prev.impressions)::FLOAT / prev.impressions * 100)::NUMERIC 
      ELSE NULL END as percent_change,
    (curr.impressions >= prev.impressions) as is_improvement
  FROM current_period curr, previous_period prev
  
  UNION ALL
  
  SELECT 
    'Clicks',
    curr.clicks::NUMERIC,
    prev.clicks::NUMERIC,
    (curr.clicks - prev.clicks)::NUMERIC,
    CASE WHEN prev.clicks > 0 
      THEN ((curr.clicks - prev.clicks)::FLOAT / prev.clicks * 100)::NUMERIC 
      ELSE NULL END,
    (curr.clicks >= prev.clicks)
  FROM current_period curr, previous_period prev
  
  UNION ALL
  
  SELECT 
    'Cart Adds',
    curr.cart_adds::NUMERIC,
    prev.cart_adds::NUMERIC,
    (curr.cart_adds - prev.cart_adds)::NUMERIC,
    CASE WHEN prev.cart_adds > 0 
      THEN ((curr.cart_adds - prev.cart_adds)::FLOAT / prev.cart_adds * 100)::NUMERIC 
      ELSE NULL END,
    (curr.cart_adds >= prev.cart_adds)
  FROM current_period curr, previous_period prev
  
  UNION ALL
  
  SELECT 
    'Purchases',
    curr.purchases::NUMERIC,
    prev.purchases::NUMERIC,
    (curr.purchases - prev.purchases)::NUMERIC,
    CASE WHEN prev.purchases > 0 
      THEN ((curr.purchases - prev.purchases)::FLOAT / prev.purchases * 100)::NUMERIC 
      ELSE NULL END,
    (curr.purchases >= prev.purchases)
  FROM current_period curr, previous_period prev
  
  UNION ALL
  
  SELECT 
    'Revenue',
    ROUND(curr.revenue, 2),
    ROUND(prev.revenue, 2),
    ROUND(curr.revenue - prev.revenue, 2),
    CASE WHEN prev.revenue > 0 
      THEN ROUND(((curr.revenue - prev.revenue) / prev.revenue * 100)::NUMERIC, 1) 
      ELSE NULL END,
    (curr.revenue >= prev.revenue)
  FROM current_period curr, previous_period prev
  
  UNION ALL
  
  SELECT 
    'CTR %',
    ROUND(curr.ctr * 100, 2),
    ROUND(prev.ctr * 100, 2),
    ROUND((curr.ctr - prev.ctr) * 100, 2),
    NULL, -- Percentage change doesn't make sense for rates
    (curr.ctr >= prev.ctr)
  FROM current_period curr, previous_period prev
  
  UNION ALL
  
  SELECT 
    'Cart Add Rate %',
    ROUND(curr.cart_add_rate * 100, 2),
    ROUND(prev.cart_add_rate * 100, 2),
    ROUND((curr.cart_add_rate - prev.cart_add_rate) * 100, 2),
    NULL,
    (curr.cart_add_rate >= prev.cart_add_rate)
  FROM current_period curr, previous_period prev
  
  UNION ALL
  
  SELECT 
    'CVR %',
    ROUND(curr.cvr * 100, 2),
    ROUND(prev.cvr * 100, 2),
    ROUND((curr.cvr - prev.cvr) * 100, 2),
    NULL,
    (curr.cvr >= prev.cvr)
  FROM current_period curr, previous_period prev
  
  UNION ALL
  
  SELECT 
    'Unique Queries',
    curr.unique_queries::NUMERIC,
    prev.unique_queries::NUMERIC,
    (curr.unique_queries - prev.unique_queries)::NUMERIC,
    CASE WHEN prev.unique_queries > 0 
      THEN ((curr.unique_queries - prev.unique_queries)::FLOAT / prev.unique_queries * 100)::NUMERIC 
      ELSE NULL END,
    (curr.unique_queries >= prev.unique_queries)
  FROM current_period curr, previous_period prev;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get period performance summary
CREATE OR REPLACE FUNCTION sqp.get_period_performance_summary(
  p_brand_id UUID DEFAULT NULL,
  p_period_count INTEGER DEFAULT 12
)
RETURNS TABLE (
  period_type TEXT,
  latest_period_label TEXT,
  latest_period_revenue NUMERIC,
  period_over_period_growth NUMERIC,
  year_over_year_growth NUMERIC,
  best_performing_period TEXT,
  worst_performing_period TEXT,
  avg_period_revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  -- Weekly summary
  SELECT 
    'week'::TEXT as period_type,
    MAX(period_label) as latest_period_label,
    MAX(total_revenue) FILTER (WHERE rn = 1) as latest_period_revenue,
    MAX(revenue_change_pct) FILTER (WHERE rn = 1) as period_over_period_growth,
    NULL::NUMERIC as year_over_year_growth,
    MAX(period_label) FILTER (WHERE revenue_rank = 1) as best_performing_period,
    MAX(period_label) FILTER (WHERE revenue_rank = cnt) as worst_performing_period,
    AVG(total_revenue) as avg_period_revenue
  FROM (
    SELECT 
      *,
      ROW_NUMBER() OVER (ORDER BY period_start DESC) as rn,
      RANK() OVER (ORDER BY total_revenue DESC) as revenue_rank,
      COUNT(*) OVER () as cnt
    FROM sqp.get_period_comparison('week', p_brand_id)
    WHERE period_start >= CURRENT_DATE - INTERVAL '12 weeks'
  ) weekly_data
  
  UNION ALL
  
  -- Monthly summary
  SELECT 
    'month'::TEXT,
    MAX(period_label),
    MAX(total_revenue) FILTER (WHERE rn = 1),
    MAX(revenue_change_pct) FILTER (WHERE rn = 1),
    MAX(revenue_change_pct) FILTER (WHERE rn = 1 AND period_start = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 year')),
    MAX(period_label) FILTER (WHERE revenue_rank = 1),
    MAX(period_label) FILTER (WHERE revenue_rank = cnt),
    AVG(total_revenue)
  FROM (
    SELECT 
      *,
      ROW_NUMBER() OVER (ORDER BY period_start DESC) as rn,
      RANK() OVER (ORDER BY total_revenue DESC) as revenue_rank,
      COUNT(*) OVER () as cnt
    FROM sqp.get_period_comparison('month', p_brand_id)
    WHERE period_start >= CURRENT_DATE - INTERVAL '12 months'
  ) monthly_data
  
  UNION ALL
  
  -- Quarterly summary
  SELECT 
    'quarter'::TEXT,
    MAX(period_label),
    MAX(total_revenue) FILTER (WHERE rn = 1),
    MAX(revenue_change_pct) FILTER (WHERE rn = 1),
    MAX(revenue_change_pct) FILTER (WHERE rn = 5), -- YoY for quarters
    MAX(period_label) FILTER (WHERE revenue_rank = 1),
    MAX(period_label) FILTER (WHERE revenue_rank = cnt),
    AVG(total_revenue)
  FROM (
    SELECT 
      *,
      ROW_NUMBER() OVER (ORDER BY period_start DESC) as rn,
      RANK() OVER (ORDER BY total_revenue DESC) as revenue_rank,
      COUNT(*) OVER () as cnt
    FROM sqp.get_period_comparison('quarter', p_brand_id)
    WHERE period_start >= CURRENT_DATE - INTERVAL '2 years'
  ) quarterly_data;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION sqp.get_period_comparison TO authenticated;
GRANT EXECUTE ON FUNCTION sqp.compare_date_ranges TO authenticated;
GRANT EXECUTE ON FUNCTION sqp.get_period_performance_summary TO authenticated;

-- Add comments
COMMENT ON FUNCTION sqp.get_period_comparison IS 'Get period-over-period comparison data with brand filtering';
COMMENT ON FUNCTION sqp.compare_date_ranges IS 'Compare metrics between two custom date ranges';
COMMENT ON FUNCTION sqp.get_period_performance_summary IS 'High-level summary of performance across different time periods';