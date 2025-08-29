-- Cleanup Script: Remove unused tables and views before implementing new schema
-- Run this script to clean up the database before adding new tables

-- Drop all views in public schema that are duplicates or will be replaced
DROP VIEW IF EXISTS public.asin_performance_data CASCADE;
DROP VIEW IF EXISTS public.daily_sqp_data CASCADE;
DROP VIEW IF EXISTS public.data_quality_checks CASCADE;
DROP VIEW IF EXISTS public.monthly_summary CASCADE;
DROP VIEW IF EXISTS public.quarterly_summary CASCADE;
DROP VIEW IF EXISTS public.search_performance_summary CASCADE;
DROP VIEW IF EXISTS public.search_query_performance CASCADE;
DROP VIEW IF EXISTS public.sqp_market_share CASCADE;
DROP VIEW IF EXISTS public.sqp_monthly_summary CASCADE;
DROP VIEW IF EXISTS public.sqp_monthly_trends CASCADE;
DROP VIEW IF EXISTS public.sqp_performance_scores CASCADE;
DROP VIEW IF EXISTS public.sqp_period_comparisons CASCADE;
DROP VIEW IF EXISTS public.sqp_quarterly_summary CASCADE;
DROP VIEW IF EXISTS public.sqp_top_keywords_by_period CASCADE;
DROP VIEW IF EXISTS public.sqp_weekly_summary CASCADE;
DROP VIEW IF EXISTS public.sqp_weekly_trends CASCADE;
DROP VIEW IF EXISTS public.sqp_year_over_year CASCADE;
DROP VIEW IF EXISTS public.sqp_yearly_summary CASCADE;
DROP VIEW IF EXISTS public.sync_log CASCADE;
DROP VIEW IF EXISTS public.weekly_summary CASCADE;
DROP VIEW IF EXISTS public.yearly_summary CASCADE;

-- Drop all existing materialized views in sqp schema (will be replaced)
DROP MATERIALIZED VIEW IF EXISTS sqp.market_share CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sqp.monthly_trends CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sqp.performance_scores CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sqp.search_performance_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sqp.top_keywords_by_period CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sqp.weekly_trends CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sqp.year_over_year CASCADE;

-- Drop regular views in sqp schema
DROP VIEW IF EXISTS sqp.period_comparisons CASCADE;

-- Drop unused tables
DROP TABLE IF EXISTS sqp.weekly_summary CASCADE;
DROP TABLE IF EXISTS sqp.monthly_summary CASCADE;
DROP TABLE IF EXISTS sqp.quarterly_summary CASCADE;
DROP TABLE IF EXISTS sqp.yearly_summary CASCADE;
DROP TABLE IF EXISTS sqp.daily_sqp_data CASCADE;

-- Drop test table
DROP TABLE IF EXISTS public.sqp_test CASCADE;

-- Drop pipeline tables (not in spec)
DROP TABLE IF EXISTS public.pipeline_logs CASCADE;
DROP TABLE IF EXISTS public.pipeline_errors CASCADE;
DROP TABLE IF EXISTS public.pipeline_metrics CASCADE;
DROP TABLE IF EXISTS public.pipeline_transitions CASCADE;
DROP TABLE IF EXISTS public.pipeline_metadata CASCADE;
DROP TABLE IF EXISTS public.pipeline_states CASCADE;

-- Verify remaining tables
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN tablename IN ('search_query_performance', 'asin_performance_data', 'sync_log', 'data_quality_checks') 
        THEN 'KEEP - Core table'
        ELSE 'Review'
    END as status
FROM pg_tables
WHERE schemaname IN ('sqp', 'public')
    AND tablename NOT LIKE 'pg_%'
ORDER BY schemaname, tablename;