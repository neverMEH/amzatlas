-- Create public wrapper functions for sqp schema RPC functions
-- This allows access through the Supabase REST API

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS public.get_period_comparison;
DROP FUNCTION IF EXISTS public.get_dashboard_trends;
DROP FUNCTION IF EXISTS public.get_dashboard_metrics;
DROP FUNCTION IF EXISTS public.get_dashboard_keywords;

-- Create wrapper for get_period_comparison
CREATE OR REPLACE FUNCTION public.get_period_comparison(
    p_comparison_type TEXT DEFAULT 'week',
    p_brand_id UUID DEFAULT NULL,
    p_asin VARCHAR DEFAULT NULL,
    p_search_query TEXT DEFAULT NULL,
    p_limit INT DEFAULT 100,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    asin VARCHAR,
    brand_id UUID,
    search_query TEXT,
    period_start DATE,
    period_end DATE,
    current_impressions BIGINT,
    previous_impressions BIGINT,
    impressions_change_pct NUMERIC,
    current_clicks BIGINT,
    previous_clicks BIGINT,
    clicks_change_pct NUMERIC,
    current_purchases BIGINT,
    previous_purchases BIGINT,
    purchases_change_pct NUMERIC,
    current_revenue NUMERIC,
    previous_revenue NUMERIC,
    revenue_change_pct NUMERIC,
    current_cvr NUMERIC,
    previous_cvr NUMERIC,
    cvr_change_pct NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Call the sqp schema function
    RETURN QUERY
    SELECT * FROM sqp.get_period_comparison(
        p_comparison_type,
        p_brand_id,
        p_asin,
        p_search_query,
        p_limit,
        p_offset
    );
END;
$$;

-- Create wrapper for get_dashboard_trends  
CREATE OR REPLACE FUNCTION public.get_dashboard_trends(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_brand_id UUID DEFAULT NULL,
    p_limit INT DEFAULT 12
)
RETURNS TABLE (
    period_date DATE,
    impressions BIGINT,
    clicks BIGINT,
    purchases BIGINT,
    revenue NUMERIC,
    cvr NUMERIC,
    ctr NUMERIC,
    asin_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Call the sqp schema function
    RETURN QUERY
    SELECT * FROM sqp.get_dashboard_trends(
        p_start_date,
        p_end_date,
        p_brand_id,
        p_limit
    );
END;
$$;

-- Create wrapper for get_dashboard_metrics
CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_brand_id UUID DEFAULT NULL
)
RETURNS TABLE (
    total_impressions BIGINT,
    total_clicks BIGINT,
    total_purchases BIGINT,
    total_revenue NUMERIC,
    avg_cvr NUMERIC,
    avg_ctr NUMERIC,
    active_asins INT,
    active_keywords INT
)
LANGUAGE plpgsql
SECURITY DEFINER  
AS $$
BEGIN
    -- Call the sqp schema function
    RETURN QUERY
    SELECT * FROM sqp.get_dashboard_metrics(
        p_start_date,
        p_end_date,
        p_brand_id
    );
END;
$$;

-- Create wrapper for get_dashboard_keywords
CREATE OR REPLACE FUNCTION public.get_dashboard_keywords(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_brand_id UUID DEFAULT NULL,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    search_query TEXT,
    impressions BIGINT,
    clicks BIGINT,
    purchases BIGINT,
    revenue NUMERIC,
    cvr NUMERIC,
    ctr NUMERIC,
    avg_position NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Call the sqp schema function
    RETURN QUERY
    SELECT * FROM sqp.get_dashboard_keywords(
        p_start_date,
        p_end_date,
        p_brand_id,
        p_limit
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_period_comparison TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_dashboard_trends TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_dashboard_metrics TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_dashboard_keywords TO anon, authenticated, service_role;

-- Add comments
COMMENT ON FUNCTION public.get_period_comparison IS 'Public wrapper for sqp.get_period_comparison - Returns period-over-period comparison data';
COMMENT ON FUNCTION public.get_dashboard_trends IS 'Public wrapper for sqp.get_dashboard_trends - Returns trend data for dashboard charts';
COMMENT ON FUNCTION public.get_dashboard_metrics IS 'Public wrapper for sqp.get_dashboard_metrics - Returns aggregated dashboard metrics';
COMMENT ON FUNCTION public.get_dashboard_keywords IS 'Public wrapper for sqp.get_dashboard_keywords - Returns top performing keywords';