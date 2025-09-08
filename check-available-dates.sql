-- Check what date ranges actually have data in the database

-- 1. Check the date ranges available in asin_performance_data
SELECT 'Date Ranges in Database' as check_type;
SELECT 
    MIN(start_date) as earliest_start_date,
    MAX(end_date) as latest_end_date,
    COUNT(DISTINCT start_date) as unique_start_dates,
    COUNT(DISTINCT asin) as unique_asins,
    COUNT(*) as total_records
FROM sqp.asin_performance_data;

-- 2. Show recent date ranges (last 10 weeks)
SELECT 'Recent Date Ranges' as check_type;
SELECT DISTINCT
    start_date,
    end_date,
    COUNT(DISTINCT asin) as asin_count
FROM sqp.asin_performance_data
GROUP BY start_date, end_date
ORDER BY start_date DESC
LIMIT 10;

-- 3. Check data for the specific ASIN
SELECT 'Data for ASIN B003UA18GC' as check_type;
SELECT 
    start_date,
    end_date,
    asin,
    product_title
FROM sqp.asin_performance_data
WHERE asin = 'B003UA18GC'
ORDER BY start_date DESC
LIMIT 10;

-- 4. Check search_query_detail view for this ASIN
SELECT 'Search Query Detail for ASIN B003UA18GC' as check_type;
SELECT 
    start_date,
    end_date,
    COUNT(*) as query_count,
    SUM(impressions) as total_impressions,
    SUM(clicks) as total_clicks
FROM public.search_query_detail
WHERE asin = 'B003UA18GC'
GROUP BY start_date, end_date
ORDER BY start_date DESC
LIMIT 10;

-- 5. Get the most recent data across all ASINs
SELECT 'Most Recent Data' as check_type;
SELECT 
    start_date,
    end_date,
    COUNT(DISTINCT asin) as asin_count,
    SUM(impressions) as total_impressions
FROM public.search_query_detail
GROUP BY start_date, end_date
ORDER BY start_date DESC
LIMIT 5;