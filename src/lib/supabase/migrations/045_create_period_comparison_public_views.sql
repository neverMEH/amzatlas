-- Create public views for period comparison materialized views
-- This allows access through the Supabase REST API

-- Drop existing views if they exist
DROP VIEW IF EXISTS public.week_over_week_comparison CASCADE;
DROP VIEW IF EXISTS public.month_over_month_comparison CASCADE;
DROP VIEW IF EXISTS public.quarter_over_quarter_comparison CASCADE;
DROP VIEW IF EXISTS public.year_over_year_comparison CASCADE;

-- Create public views
CREATE VIEW public.week_over_week_comparison AS 
SELECT * FROM sqp.week_over_week_comparison;

CREATE VIEW public.month_over_month_comparison AS 
SELECT * FROM sqp.month_over_month_comparison;

CREATE VIEW public.quarter_over_quarter_comparison AS 
SELECT * FROM sqp.quarter_over_quarter_comparison;

CREATE VIEW public.year_over_year_comparison AS 
SELECT * FROM sqp.year_over_year_comparison;

-- Grant permissions
GRANT SELECT ON public.week_over_week_comparison TO anon, authenticated, service_role;
GRANT SELECT ON public.month_over_month_comparison TO anon, authenticated, service_role;
GRANT SELECT ON public.quarter_over_quarter_comparison TO anon, authenticated, service_role;
GRANT SELECT ON public.year_over_year_comparison TO anon, authenticated, service_role;

-- Add comments
COMMENT ON VIEW public.week_over_week_comparison IS 'Public view for week-over-week performance comparison';
COMMENT ON VIEW public.month_over_month_comparison IS 'Public view for month-over-month performance comparison';
COMMENT ON VIEW public.quarter_over_quarter_comparison IS 'Public view for quarter-over-quarter performance comparison';
COMMENT ON VIEW public.year_over_year_comparison IS 'Public view for year-over-year performance comparison';