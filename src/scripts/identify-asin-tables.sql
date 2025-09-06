-- List all tables with ASIN columns that need to be checked
-- This query identifies all tables and views that have ASIN columns

-- 1. Base tables with ASIN columns in sqp schema
SELECT 'Tables with ASIN columns in sqp schema:' as category;
SELECT 
    table_name,
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'sqp' 
    AND column_name IN ('asin', 'child_asin')
    AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Views dependent on ASIN columns
SELECT '
Views that depend on tables with ASIN columns:' as category;
SELECT DISTINCT
    v.schemaname,
    v.viewname
FROM pg_views v
WHERE v.definition LIKE '%asin%'
ORDER BY v.schemaname, v.viewname;

-- 3. Check materialized views
SELECT '
Materialized views with ASIN dependencies:' as category;
SELECT 
    schemaname,
    matviewname
FROM pg_matviews
WHERE definition LIKE '%asin%'
ORDER BY schemaname, matviewname;

-- 4. Summary of tables that need ASIN column updates
SELECT '
Summary - Tables needing ASIN column updates:' as category;
SELECT 
    'sqp.asin_performance_data' as table_name,
    'Core table with ASIN performance metrics' as description
UNION ALL
SELECT 
    'sqp.search_query_performance',
    'Search query metrics by ASIN'
UNION ALL
SELECT 
    'sqp.daily_sqp_data',
    'Daily aggregated SQP data'
UNION ALL
SELECT 
    'sqp.weekly_summary',
    'Weekly aggregated summary'
UNION ALL
SELECT 
    'sqp.monthly_summary',
    'Monthly aggregated summary'
UNION ALL
SELECT 
    'sqp.quarterly_summary',
    'Quarterly aggregated summary'
UNION ALL
SELECT 
    'sqp.yearly_summary',
    'Yearly aggregated summary';