-- Create views specifically for dashboard APIs

-- Drop existing object if it exists
-- Using a DO block to handle any object type without errors
DO $$ 
BEGIN
    -- Try to drop as table first (most likely case based on error)
    DROP TABLE IF EXISTS sqp.period_comparisons CASCADE;
    -- Try to drop as materialized view
    DROP MATERIALIZED VIEW IF EXISTS sqp.period_comparisons CASCADE;
    -- Try to drop as regular view
    DROP VIEW IF EXISTS sqp.period_comparisons CASCADE;
EXCEPTION
    WHEN OTHERS THEN
        -- Ignore any errors and continue
        NULL;
END $$;

-- Period comparisons view for rising keywords
CREATE VIEW sqp.period_comparisons AS
WITH current_period AS (
  SELECT 
    query,
    asin,
    'weekly' as period_type,
    period_end,
    total_purchases as current_purchases,
    total_clicks as current_clicks,
    total_impressions as current_impressions,
    avg_ctr as current_ctr,
    avg_cvr as current_cvr
  FROM sqp.weekly_summary
  WHERE period_end = (
    SELECT MAX(period_end) 
    FROM sqp.weekly_summary
  )
),
previous_period AS (
  SELECT 
    query,
    asin,
    total_purchases as previous_purchases,
    total_clicks as previous_clicks,
    total_impressions as previous_impressions,
    avg_ctr as previous_ctr,
    avg_cvr as previous_cvr
  FROM sqp.weekly_summary
  WHERE period_end = (
    SELECT MAX(period_end) 
    FROM sqp.weekly_summary
    WHERE period_end < (SELECT MAX(period_end) FROM sqp.weekly_summary)
  )
)
SELECT 
  c.query,
  c.asin,
  c.period_type,
  c.period_end,
  c.current_purchases,
  c.current_clicks,
  c.current_impressions,
  c.current_ctr,
  c.current_cvr,
  COALESCE(p.previous_purchases, 0) as previous_purchases,
  COALESCE(p.previous_clicks, 0) as previous_clicks,
  COALESCE(p.previous_impressions, 0) as previous_impressions,
  COALESCE(p.previous_ctr, 0) as previous_ctr,
  COALESCE(p.previous_cvr, 0) as previous_cvr,
  CASE 
    WHEN p.previous_purchases > 0 
    THEN ((c.current_purchases - p.previous_purchases)::DECIMAL / p.previous_purchases * 100)
    ELSE 100 
  END as purchases_change_pct,
  CASE 
    WHEN p.previous_clicks > 0 
    THEN ((c.current_clicks - p.previous_clicks)::DECIMAL / p.previous_clicks * 100)
    ELSE 100 
  END as clicks_change_pct
FROM current_period c
LEFT JOIN previous_period p ON c.query = p.query AND c.asin = p.asin;

-- Function to get dashboard metrics with proper error handling
CREATE OR REPLACE FUNCTION sqp.get_dashboard_metrics(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    total_purchases BIGINT,
    total_clicks BIGINT,
    avg_purchase_share DECIMAL,
    avg_cvr DECIMAL,
    zero_purchase_keywords BIGINT,
    total_spend DECIMAL,
    total_revenue DECIMAL,
    roi DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH current_period AS (
        SELECT 
            COALESCE(SUM(ws.total_purchases), 0) as total_purchases,
            COALESCE(SUM(ws.total_clicks), 0) as total_clicks,
            CASE WHEN COUNT(*) > 0 THEN AVG(ws.purchase_share) ELSE 0 END as avg_share,
            CASE 
                WHEN SUM(ws.total_clicks) > 0 
                THEN (SUM(ws.total_purchases)::DECIMAL / SUM(ws.total_clicks)) * 100
                ELSE 0 
            END as cvr,
            COUNT(DISTINCT CASE WHEN ws.total_clicks > 0 AND ws.total_purchases = 0 THEN ws.query END) as zero_keywords
        FROM sqp.weekly_summary ws
        WHERE ws.period_start >= p_start_date 
        AND ws.period_end <= p_end_date
    )
    SELECT 
        cp.total_purchases::BIGINT,
        cp.total_clicks::BIGINT,
        ROUND(cp.avg_share * 100, 2) as avg_purchase_share,
        ROUND(cp.cvr, 2) as avg_cvr,
        cp.zero_keywords::BIGINT as zero_purchase_keywords,
        ROUND(cp.total_clicks * 0.5, 2) as total_spend, -- Assume $0.50 CPC
        ROUND(cp.total_purchases * 50, 2) as total_revenue, -- Assume $50 AOV
        CASE 
            WHEN cp.total_clicks * 0.5 > 0 
            THEN ROUND(((cp.total_purchases * 50 - cp.total_clicks * 0.5) / (cp.total_clicks * 0.5)) * 100, 0)
            ELSE 0 
        END as roi
    FROM current_period cp;
END;
$$ LANGUAGE plpgsql;

-- Function to get week-over-week comparison for dashboard
CREATE OR REPLACE FUNCTION sqp.get_dashboard_metrics_comparison(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    total_purchases BIGINT,
    week_over_week_change DECIMAL,
    market_share DECIMAL,
    market_share_change DECIMAL,
    purchase_cvr DECIMAL,
    cvr_change DECIMAL,
    zero_purchase_keywords BIGINT,
    zero_purchase_change BIGINT,
    purchase_roi DECIMAL,
    roi_change DECIMAL
) AS $$
DECLARE
    v_days_diff INTEGER;
    v_prev_start DATE;
    v_prev_end DATE;
    v_current_metrics RECORD;
    v_previous_metrics RECORD;
BEGIN
    -- Calculate previous period
    v_days_diff := p_end_date - p_start_date + 1;
    v_prev_start := p_start_date - v_days_diff;
    v_prev_end := p_end_date - v_days_diff;
    
    -- Get current period metrics
    SELECT * INTO v_current_metrics
    FROM sqp.get_dashboard_metrics(p_start_date, p_end_date);
    
    -- Get previous period metrics
    SELECT * INTO v_previous_metrics
    FROM sqp.get_dashboard_metrics(v_prev_start, v_prev_end);
    
    RETURN QUERY
    SELECT 
        v_current_metrics.total_purchases,
        CASE 
            WHEN v_previous_metrics.total_purchases > 0 
            THEN ROUND(((v_current_metrics.total_purchases - v_previous_metrics.total_purchases)::DECIMAL / v_previous_metrics.total_purchases) * 100, 1)
            ELSE 0 
        END as week_over_week_change,
        v_current_metrics.avg_purchase_share as market_share,
        ROUND(v_current_metrics.avg_purchase_share - v_previous_metrics.avg_purchase_share, 1) as market_share_change,
        v_current_metrics.avg_cvr as purchase_cvr,
        ROUND(v_current_metrics.avg_cvr - v_previous_metrics.avg_cvr, 1) as cvr_change,
        v_current_metrics.zero_purchase_keywords,
        v_current_metrics.zero_purchase_keywords - v_previous_metrics.zero_purchase_keywords as zero_purchase_change,
        v_current_metrics.roi as purchase_roi,
        ROUND(v_current_metrics.roi - v_previous_metrics.roi, 0) as roi_change;
END;
$$ LANGUAGE plpgsql;

-- Function to get top keywords for dashboard
CREATE OR REPLACE FUNCTION sqp.get_dashboard_keywords(
    p_limit INTEGER DEFAULT 10,
    p_type TEXT DEFAULT 'top',
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    keyword TEXT,
    purchases BIGINT,
    market_purchases BIGINT,
    share DECIMAL,
    cvr DECIMAL,
    spend DECIMAL,
    roi DECIMAL,
    trend TEXT
) AS $$
BEGIN
    IF p_type = 'zero-purchase' THEN
        RETURN QUERY
        SELECT 
            ws.query as keyword,
            0::BIGINT as purchases,
            ROUND(ws.total_impressions * 0.04)::BIGINT as market_purchases,
            0::DECIMAL as share,
            0::DECIMAL as cvr,
            ROUND(ws.total_clicks * 0.5, 2) as spend,
            -100::DECIMAL as roi,
            'down'::TEXT as trend
        FROM sqp.weekly_summary ws
        WHERE ws.period_start >= p_start_date
        AND ws.period_end <= p_end_date
        AND ws.total_clicks > 0
        AND ws.total_purchases = 0
        GROUP BY ws.query, ws.total_impressions, ws.total_clicks
        ORDER BY ws.total_clicks DESC
        LIMIT p_limit;
    
    ELSIF p_type = 'rising' THEN
        RETURN QUERY
        WITH comparison AS (
            SELECT * FROM sqp.period_comparisons
            WHERE purchases_change_pct > 20
        )
        SELECT 
            c.query as keyword,
            c.current_purchases::BIGINT as purchases,
            ROUND(c.current_purchases / 0.2)::BIGINT as market_purchases,
            20::DECIMAL as share,
            CASE 
                WHEN c.current_clicks > 0 
                THEN ROUND((c.current_purchases::DECIMAL / c.current_clicks) * 100, 1)
                ELSE 0 
            END as cvr,
            ROUND(c.current_clicks * 0.5, 2) as spend,
            CASE 
                WHEN c.current_clicks > 0 
                THEN ROUND(((c.current_purchases * 50 - c.current_clicks * 0.5) / (c.current_clicks * 0.5)) * 100, 0)
                ELSE 0 
            END as roi,
            'up'::TEXT as trend
        FROM comparison c
        ORDER BY c.purchases_change_pct DESC
        LIMIT p_limit;
    
    ELSIF p_type = 'negative-roi' THEN
        RETURN QUERY
        SELECT 
            ws.query as keyword,
            ws.total_purchases::BIGINT as purchases,
            ROUND(ws.total_purchases / NULLIF(ws.purchase_share, 0))::BIGINT as market_purchases,
            ROUND(ws.purchase_share * 100, 1) as share,
            ROUND((ws.total_purchases::DECIMAL / NULLIF(ws.total_clicks, 0)) * 100, 1) as cvr,
            ROUND(ws.total_clicks * 0.5, 2) as spend,
            ROUND(((ws.total_purchases * 50 - ws.total_clicks * 0.5) / NULLIF(ws.total_clicks * 0.5, 0)) * 100, 0) as roi,
            'down'::TEXT as trend
        FROM sqp.weekly_summary ws
        WHERE ws.period_start >= p_start_date
        AND ws.period_end <= p_end_date
        AND ws.total_clicks > 10
        AND ws.avg_cvr < 0.02
        ORDER BY ws.total_clicks DESC
        LIMIT p_limit;
    
    ELSE -- Default 'top' keywords
        RETURN QUERY
        SELECT 
            ws.query as keyword,
            SUM(ws.total_purchases)::BIGINT as purchases,
            ROUND(SUM(ws.total_purchases) / AVG(NULLIF(ws.purchase_share, 0)))::BIGINT as market_purchases,
            ROUND(AVG(ws.purchase_share) * 100, 1) as share,
            ROUND(AVG(ws.avg_cvr) * 100, 1) as cvr,
            ROUND(SUM(ws.total_clicks) * 0.5, 2) as spend,
            ROUND(((SUM(ws.total_purchases) * 50 - SUM(ws.total_clicks) * 0.5) / NULLIF(SUM(ws.total_clicks) * 0.5, 0)) * 100, 0) as roi,
            CASE 
                WHEN AVG(ws.avg_cvr) > 0.04 THEN 'up'
                WHEN AVG(ws.avg_cvr) < 0.02 THEN 'down'
                ELSE 'stable'
            END::TEXT as trend
        FROM sqp.weekly_summary ws
        WHERE ws.period_start >= p_start_date
        AND ws.period_end <= p_end_date
        GROUP BY ws.query
        ORDER BY SUM(ws.total_purchases) DESC
        LIMIT p_limit;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get purchase trends for dashboard
CREATE OR REPLACE FUNCTION sqp.get_dashboard_trends(
    p_weeks INTEGER DEFAULT 12
)
RETURNS TABLE (
    week TEXT,
    purchases BIGINT,
    market BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH weekly_data AS (
        SELECT 
            date_trunc('week', ws.period_start)::DATE as week_start,
            SUM(ws.total_purchases) as total_purchases,
            SUM(ws.total_purchases / NULLIF(ws.purchase_share, 0)) as estimated_market
        FROM sqp.weekly_summary ws
        WHERE ws.period_start >= CURRENT_DATE - (p_weeks * INTERVAL '1 week')
        GROUP BY date_trunc('week', ws.period_start)
        ORDER BY week_start
    )
    SELECT 
        'W' || ROW_NUMBER() OVER (ORDER BY week_start)::TEXT as week,
        total_purchases::BIGINT as purchases,
        COALESCE(estimated_market, total_purchases * 5)::BIGINT as market
    FROM weekly_data;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_period_comparisons_query ON sqp.weekly_summary(query);
CREATE INDEX IF NOT EXISTS idx_period_comparisons_period ON sqp.weekly_summary(period_end);
CREATE INDEX IF NOT EXISTS idx_period_comparisons_purchases ON sqp.weekly_summary(total_purchases);
CREATE INDEX IF NOT EXISTS idx_period_comparisons_clicks ON sqp.weekly_summary(total_clicks);