-- Migration: Create public view for search_performance_summary
-- Description: Expose sqp.search_performance_summary through public schema view for API access

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.search_performance_summary CASCADE;

-- Create view in public schema that references sqp materialized view
CREATE VIEW public.search_performance_summary AS
SELECT * FROM sqp.search_performance_summary;

-- Grant permissions
GRANT SELECT ON public.search_performance_summary TO anon, authenticated;

-- Comment
COMMENT ON VIEW public.search_performance_summary IS 'Public view for sqp.search_performance_summary to enable API access';