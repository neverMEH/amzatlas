-- Find weeks with the most data to use as default date range

-- 1. Show weeks with the most records
SELECT 
    start_date,
    end_date,
    COUNT(DISTINCT asin) as asin_count,
    COUNT(*) as total_records,
    SUM(CASE WHEN asin = 'B003UA18GC' THEN 1 ELSE 0 END) as records_for_test_asin
FROM sqp.asin_performance_data
WHERE start_date >= '2025-07-01'  -- Recent data only
GROUP BY start_date, end_date
ORDER BY total_records DESC, start_date DESC
LIMIT 10;

-- 2. Show data density by week for search queries
SELECT 
    apd.start_date,
    apd.end_date,
    COUNT(DISTINCT apd.asin) as asin_count,
    COUNT(DISTINCT sqp.search_query) as unique_queries,
    COUNT(*) as total_query_records,
    SUM(sqp.asin_impression_count) as total_impressions
FROM sqp.asin_performance_data apd
JOIN sqp.search_query_performance sqp ON apd.id = sqp.asin_performance_id
WHERE apd.start_date >= '2025-07-01'
GROUP BY apd.start_date, apd.end_date
ORDER BY total_query_records DESC
LIMIT 10;

-- 3. Check what's in search_query_detail view
SELECT 
    start_date,
    end_date,
    COUNT(DISTINCT asin) as asin_count,
    COUNT(*) as record_count,
    SUM(impressions) as total_impressions
FROM public.search_query_detail
WHERE start_date >= '2025-07-01'
GROUP BY start_date, end_date
ORDER BY start_date DESC
LIMIT 10;