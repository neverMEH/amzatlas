-- Check ASIN column constraints across all tables
SELECT 
    table_schema,
    table_name,
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE column_name IN ('asin', 'child_asin')
    AND table_schema IN ('sqp', 'public')
ORDER BY table_schema, table_name, column_name;

-- Check for any dependent objects
SELECT DISTINCT
    v.schemaname,
    v.viewname,
    v.definition LIKE '%asin%' as uses_asin_column
FROM pg_views v
WHERE v.definition LIKE '%asin_performance_data%'
   OR v.definition LIKE '%search_query_performance%'
   OR v.definition LIKE '%daily_sqp_data%'
ORDER BY v.schemaname, v.viewname;

-- Check for long ASINs that would fail with VARCHAR(10)
WITH asin_length_check AS (
    SELECT 
        'sqp.asin_performance_data' as table_name,
        asin,
        LENGTH(asin) as asin_length
    FROM sqp.asin_performance_data
    WHERE LENGTH(asin) > 10
    LIMIT 5
)
SELECT * FROM asin_length_check;