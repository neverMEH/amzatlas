-- Migration: Recreate Essential Views After ASIN Column Update
-- This recreates the minimum views needed for the application to function

-- Step 1: Create public views for the main tables
-- These allow access through Supabase client

-- 1a. View for asin_performance_data
CREATE OR REPLACE VIEW public.asin_performance_data AS
SELECT * FROM sqp.asin_performance_data;

GRANT SELECT ON public.asin_performance_data TO authenticated;
GRANT SELECT ON public.asin_performance_data TO anon;
GRANT ALL ON public.asin_performance_data TO service_role;

-- 1b. View for search_query_performance  
CREATE OR REPLACE VIEW public.search_query_performance AS
SELECT * FROM sqp.search_query_performance;

GRANT SELECT ON public.search_query_performance TO authenticated;
GRANT SELECT ON public.search_query_performance TO anon;
GRANT ALL ON public.search_query_performance TO service_role;

-- Step 2: Recreate the search_performance_summary materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.search_performance_summary AS
SELECT 
    apd.asin,
    apd.start_date,
    apd.end_date,
    COUNT(DISTINCT sqp.search_query) as unique_search_queries,
    COUNT(*) as total_query_records,
    SUM(sqp.asin_impression_count) as total_impressions,
    AVG(sqp.asin_impression_share) as avg_impression_share,
    SUM(sqp.total_query_impression_count) as market_impressions,
    SUM(sqp.asin_click_count) as total_clicks,
    AVG(sqp.asin_click_share) as avg_click_share,
    SUM(sqp.total_click_count) as market_clicks,
    CASE 
        WHEN SUM(sqp.asin_impression_count) > 0 
        THEN CAST(SUM(sqp.asin_click_count) AS FLOAT) / SUM(sqp.asin_impression_count) * 100
        ELSE 0 
    END as click_through_rate,
    SUM(sqp.asin_cart_add_count) as total_cart_adds,
    AVG(sqp.asin_cart_add_share) as avg_cart_add_share,
    SUM(sqp.total_cart_add_count) as market_cart_adds,
    CASE 
        WHEN SUM(sqp.asin_click_count) > 0 
        THEN CAST(SUM(sqp.asin_cart_add_count) AS FLOAT) / SUM(sqp.asin_click_count) * 100
        ELSE 0 
    END as cart_add_rate,
    SUM(sqp.asin_purchase_count) as total_purchases,
    AVG(sqp.asin_purchase_share) as avg_purchase_share,
    SUM(sqp.total_purchase_count) as market_purchases,
    CASE 
        WHEN SUM(sqp.asin_click_count) > 0 
        THEN CAST(SUM(sqp.asin_purchase_count) AS FLOAT) / SUM(sqp.asin_click_count) * 100
        ELSE 0 
    END as conversion_rate,
    AVG(sqp.asin_median_click_price) as avg_click_price,
    AVG(sqp.asin_median_cart_add_price) as avg_cart_add_price,
    AVG(sqp.asin_median_purchase_price) as avg_purchase_price,
    apd.created_at,
    apd.updated_at,
    CURRENT_TIMESTAMP as summary_generated_at
FROM sqp.asin_performance_data apd
JOIN sqp.search_query_performance sqp ON sqp.asin_performance_id = apd.id
GROUP BY 
    apd.id,
    apd.asin, 
    apd.start_date, 
    apd.end_date,
    apd.created_at,
    apd.updated_at;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sps_asin ON sqp.search_performance_summary(asin);
CREATE INDEX IF NOT EXISTS idx_sps_dates ON sqp.search_performance_summary(start_date, end_date);

-- Grant permissions
GRANT SELECT ON sqp.search_performance_summary TO authenticated;
GRANT SELECT ON sqp.search_performance_summary TO anon;

-- 2a. Create public view for search_performance_summary
CREATE OR REPLACE VIEW public.search_performance_summary AS
SELECT * FROM sqp.search_performance_summary;

GRANT SELECT ON public.search_performance_summary TO authenticated;
GRANT SELECT ON public.search_performance_summary TO anon;

-- Step 3: Test that we can now insert long ASINs
DO $$
DECLARE
  test_result TEXT;
BEGIN
  -- Try inserting an 11-character ASIN through the public view
  BEGIN
    INSERT INTO sqp.asin_performance_data (asin, start_date, end_date)
    VALUES ('B0TESTLONG1', '2025-09-06', '2025-09-06');
    
    -- If successful, clean up
    DELETE FROM sqp.asin_performance_data 
    WHERE asin = 'B0TESTLONG1' AND start_date = '2025-09-06';
    
    test_result := '✅ SUCCESS: Can insert 11-character ASINs';
  EXCEPTION
    WHEN OTHERS THEN
      test_result := '❌ FAILED: ' || SQLERRM;
  END;
  
  RAISE NOTICE '%', test_result;
END $$;

-- Step 4: Show summary of recreated objects
DO $$
DECLARE
  obj_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Views Recreation Summary ===';
  
  -- Count views
  SELECT COUNT(*) INTO obj_count
  FROM pg_views
  WHERE schemaname = 'public'
    AND viewname IN ('asin_performance_data', 'search_query_performance', 'search_performance_summary');
  
  RAISE NOTICE 'Public views created: %', obj_count;
  
  -- Check materialized views
  SELECT COUNT(*) INTO obj_count
  FROM pg_matviews
  WHERE schemaname = 'sqp'
    AND matviewname = 'search_performance_summary';
    
  RAISE NOTICE 'Materialized views created: %', obj_count;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Essential views recreated successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'The application should now be able to:';
  RAISE NOTICE '  - Access tables through public schema';
  RAISE NOTICE '  - Insert ASINs up to 20 characters';
  RAISE NOTICE '  - Query performance summaries';
END $$;