-- Create views in the public schema that reference sqp schema tables
-- This allows access through the Supabase client without needing to expose the sqp schema

-- Drop existing views if they exist
DROP VIEW IF EXISTS public.sqp_weekly_summary CASCADE;
DROP VIEW IF EXISTS public.sqp_monthly_summary CASCADE;
DROP VIEW IF EXISTS public.sqp_quarterly_summary CASCADE;
DROP VIEW IF EXISTS public.sqp_yearly_summary CASCADE;
DROP VIEW IF EXISTS public.sqp_period_comparisons CASCADE;
DROP VIEW IF EXISTS public.sqp_weekly_trends CASCADE;
DROP VIEW IF EXISTS public.sqp_monthly_trends CASCADE;
DROP VIEW IF EXISTS public.sqp_top_keywords_by_period CASCADE;
DROP VIEW IF EXISTS public.sqp_market_share CASCADE;
DROP VIEW IF EXISTS public.sqp_year_over_year CASCADE;
DROP VIEW IF EXISTS public.sqp_performance_scores CASCADE;

-- Create views for tables
CREATE VIEW public.sqp_weekly_summary AS 
SELECT * FROM sqp.weekly_summary;

CREATE VIEW public.sqp_monthly_summary AS 
SELECT * FROM sqp.monthly_summary;

CREATE VIEW public.sqp_quarterly_summary AS 
SELECT * FROM sqp.quarterly_summary;

CREATE VIEW public.sqp_yearly_summary AS 
SELECT * FROM sqp.yearly_summary;

CREATE VIEW public.sqp_period_comparisons AS 
SELECT * FROM sqp.period_comparisons;

-- Create views for materialized views
CREATE VIEW public.sqp_weekly_trends AS 
SELECT * FROM sqp.weekly_trends;

CREATE VIEW public.sqp_monthly_trends AS 
SELECT * FROM sqp.monthly_trends;

CREATE VIEW public.sqp_top_keywords_by_period AS 
SELECT * FROM sqp.top_keywords_by_period;

CREATE VIEW public.sqp_market_share AS 
SELECT * FROM sqp.market_share;

CREATE VIEW public.sqp_year_over_year AS 
SELECT * FROM sqp.year_over_year;

CREATE VIEW public.sqp_performance_scores AS 
SELECT * FROM sqp.performance_scores;

-- Grant permissions
GRANT SELECT ON public.sqp_weekly_summary TO anon, authenticated, service_role;
GRANT SELECT ON public.sqp_monthly_summary TO anon, authenticated, service_role;
GRANT SELECT ON public.sqp_quarterly_summary TO anon, authenticated, service_role;
GRANT SELECT ON public.sqp_yearly_summary TO anon, authenticated, service_role;
GRANT SELECT ON public.sqp_period_comparisons TO anon, authenticated, service_role;
GRANT SELECT ON public.sqp_weekly_trends TO anon, authenticated, service_role;
GRANT SELECT ON public.sqp_monthly_trends TO anon, authenticated, service_role;
GRANT SELECT ON public.sqp_top_keywords_by_period TO anon, authenticated, service_role;
GRANT SELECT ON public.sqp_market_share TO anon, authenticated, service_role;
GRANT SELECT ON public.sqp_year_over_year TO anon, authenticated, service_role;
GRANT SELECT ON public.sqp_performance_scores TO anon, authenticated, service_role;

-- Grant insert/update/delete on main tables for service_role
GRANT INSERT, UPDATE, DELETE ON public.sqp_weekly_summary TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.sqp_monthly_summary TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.sqp_quarterly_summary TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.sqp_yearly_summary TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.sqp_period_comparisons TO service_role;

-- Create RPC function to refresh materialized views (accessible from public schema)
CREATE OR REPLACE FUNCTION public.refresh_sqp_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM sqp.refresh_all_views();
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_sqp_views() TO service_role;