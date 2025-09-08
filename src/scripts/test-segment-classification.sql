-- Test script to verify the corrected brand product segments logic
-- This validates that the migration logic works correctly with actual data

-- 1. Test segment type classification (should show all weekly)
SELECT 'Segment Type Distribution' as test_name;
WITH date_segments AS (
  SELECT DISTINCT
    ap.start_date,
    ap.end_date,
    ap.end_date - ap.start_date as days_diff,
    CASE 
      WHEN ap.end_date - ap.start_date = 0 THEN 'weekly'
      WHEN ap.end_date - ap.start_date <= 31 THEN 'monthly'  
      WHEN ap.end_date - ap.start_date <= 93 THEN 'quarterly'
      WHEN ap.end_date - ap.start_date <= 366 THEN 'yearly'
      ELSE 'other'
    END as segment_type
  FROM sqp.asin_performance_data ap
  WHERE ap.start_date >= '2024-08-01'
)
SELECT 
  segment_type,
  COUNT(*) as segment_count,
  MIN(days_diff) as min_days,
  MAX(days_diff) as max_days
FROM date_segments 
GROUP BY segment_type 
ORDER BY segment_count DESC;

-- 2. Test brand mapping with segments
SELECT 'Brand Mapping Test' as test_name;
WITH brand_asin_mapping AS (
  SELECT DISTINCT
    bm.brand_id,
    b.brand_name,
    bm.asin,
    bm.product_title as product_name
  FROM public.asin_brand_mapping bm
  JOIN public.brands b ON b.id = bm.brand_id
  WHERE b.is_active = true
    AND bm.asin IS NOT NULL
    AND bm.product_title IS NOT NULL
)
SELECT 
  brand_name,
  COUNT(DISTINCT asin) as unique_asins,
  COUNT(*) as total_mappings
FROM brand_asin_mapping
GROUP BY brand_name
ORDER BY unique_asins DESC;

-- 3. Test aggregation performance (sample of what the materialized view would contain)
SELECT 'Sample Aggregated Performance' as test_name;
WITH brand_asin_mapping AS (
  SELECT DISTINCT
    bm.brand_id,
    b.brand_name,
    bm.asin,
    bm.product_title as product_name
  FROM public.asin_brand_mapping bm
  JOIN public.brands b ON b.id = bm.brand_id
  WHERE b.is_active = true
    AND bm.asin IS NOT NULL
    AND bm.product_title IS NOT NULL
  LIMIT 3  -- Sample only
),
date_segments AS (
  SELECT DISTINCT
    ap.asin,
    ap.start_date,
    ap.end_date,
    'weekly' as segment_type,
    ap.start_date as segment_start_date,
    ap.end_date as segment_end_date
  FROM sqp.asin_performance_data ap
  WHERE ap.start_date >= '2024-08-25'
    AND ap.asin IN (SELECT asin FROM brand_asin_mapping)
  LIMIT 10
),
aggregated_performance AS (
  SELECT 
    ds.asin,
    ds.segment_type,
    ds.segment_start_date,
    ds.segment_end_date,
    SUM(COALESCE(sq.total_query_impression_count, 0)) as total_impressions,
    SUM(COALESCE(sq.asin_impression_count, 0)) as asin_impressions,
    SUM(COALESCE(sq.asin_click_count, 0)) as total_clicks,
    SUM(COALESCE(sq.asin_cart_add_count, 0)) as total_cart_adds,
    SUM(COALESCE(sq.asin_purchase_count, 0)) as total_purchases,
    COUNT(DISTINCT sq.search_query) as query_count,
    -- Calculate rates
    CASE 
      WHEN SUM(COALESCE(sq.asin_impression_count, 0)) > 0 THEN 
        ROUND(SUM(COALESCE(sq.asin_click_count, 0))::decimal / SUM(COALESCE(sq.asin_impression_count, 0)), 6)
      ELSE 0 
    END as click_through_rate
  FROM date_segments ds
  JOIN sqp.asin_performance_data ap ON ap.asin = ds.asin 
    AND ap.start_date = ds.segment_start_date 
    AND ap.end_date = ds.segment_end_date
  LEFT JOIN sqp.search_query_performance sq ON ap.id = sq.asin_performance_id
  GROUP BY ds.asin, ds.segment_type, ds.segment_start_date, ds.segment_end_date
)
SELECT 
  bam.brand_name,
  bam.asin,
  LEFT(bam.product_name, 30) as product_name_short,
  ap.segment_start_date,
  ap.total_impressions,
  ap.total_clicks,
  ap.total_purchases,
  ap.click_through_rate,
  ap.query_count
FROM brand_asin_mapping bam
JOIN aggregated_performance ap ON ap.asin = bam.asin
WHERE ap.total_impressions > 0
ORDER BY ap.total_impressions DESC
LIMIT 10;

-- 4. Verify data quality
SELECT 'Data Quality Check' as test_name;
WITH sample_data AS (
  SELECT 
    COUNT(*) as total_segments,
    COUNT(DISTINCT asin) as unique_asins,
    MIN(start_date) as earliest_date,
    MAX(start_date) as latest_date,
    AVG(EXTRACT(DOW FROM start_date)) as avg_day_of_week
  FROM sqp.asin_performance_data 
  WHERE start_date >= '2024-08-01'
)
SELECT 
  total_segments,
  unique_asins,
  earliest_date,
  latest_date,
  ROUND(avg_day_of_week, 1) as avg_day_of_week_should_be_0_for_sundays
FROM sample_data;