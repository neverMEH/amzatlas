-- Debug script to check why charts aren't populating
-- Run each query to diagnose the issue

-- 1. Check if base tables have data
SELECT 'Base Tables Check' as check_type;
SELECT 
    'asin_performance_data' as table_name,
    COUNT(*) as row_count,
    MIN(start_date) as earliest_date,
    MAX(end_date) as latest_date
FROM sqp.asin_performance_data
UNION ALL
SELECT 
    'search_query_performance' as table_name,
    COUNT(*) as row_count,
    MIN(start_date) as earliest_date,
    MAX(end_date) as latest_date
FROM sqp.search_query_performance;

-- 2. Check if the new view has data
SELECT 'search_query_detail View Check' as check_type;
SELECT COUNT(*) as total_rows FROM public.search_query_detail;

-- 3. Sample data from search_query_detail
SELECT 'Sample Data from search_query_detail' as check_type;
SELECT 
    start_date,
    end_date,
    asin,
    search_query,
    impressions,
    clicks,
    cart_adds,
    purchases,
    click_through_rate,
    conversion_rate
FROM public.search_query_detail
LIMIT 5;

-- 4. Check data for a specific ASIN (replace with an actual ASIN)
SELECT 'ASIN-specific Data Check' as check_type;
SELECT 
    asin,
    COUNT(*) as query_count,
    SUM(impressions) as total_impressions,
    SUM(clicks) as total_clicks,
    SUM(purchases) as total_purchases
FROM public.search_query_detail
GROUP BY asin
ORDER BY total_impressions DESC
LIMIT 10;

-- 5. Check date ranges in the data
SELECT 'Date Range Check' as check_type;
SELECT 
    DATE_TRUNC('week', start_date) as week,
    COUNT(DISTINCT asin) as asin_count,
    COUNT(*) as record_count,
    SUM(impressions) as total_impressions
FROM public.search_query_detail
GROUP BY DATE_TRUNC('week', start_date)
ORDER BY week DESC
LIMIT 10;

-- 6. Check if there's data for recent dates (last 30 days)
SELECT 'Recent Data Check' as check_type;
SELECT 
    COUNT(*) as recent_records,
    COUNT(DISTINCT asin) as recent_asins
FROM public.search_query_detail
WHERE start_date >= CURRENT_DATE - INTERVAL '30 days';

-- 7. Check aggregated metrics that the API would calculate
SELECT 'Aggregated Metrics Check' as check_type;
WITH asin_metrics AS (
    SELECT 
        asin,
        SUM(impressions) as total_impressions,
        SUM(clicks) as total_clicks,
        SUM(cart_adds) as total_cart_adds,
        SUM(purchases) as total_purchases,
        CASE 
            WHEN SUM(impressions) > 0 
            THEN (SUM(clicks)::DECIMAL / SUM(impressions)) * 100
            ELSE 0 
        END as ctr,
        CASE 
            WHEN SUM(clicks) > 0 
            THEN (SUM(purchases)::DECIMAL / SUM(clicks)) * 100
            ELSE 0 
        END as cvr
    FROM public.search_query_detail
    WHERE start_date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY asin
)
SELECT * FROM asin_metrics
ORDER BY total_impressions DESC
LIMIT 5;

-- 8. Check the existing search_performance_summary view structure
SELECT 'Existing View Structure' as check_type;
SELECT 
    column_name,
    data_type,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'search_performance_summary'
ORDER BY ordinal_position
LIMIT 10;