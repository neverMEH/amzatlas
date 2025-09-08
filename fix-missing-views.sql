-- Fix missing views for chart population
-- Created: 2025-09-08
-- Purpose: Create views that the dashboard APIs expect for populating charts

-- ================================================================
-- 1. Create detailed search query view (used by asin-overview route)
-- ================================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.search_query_detail CASCADE;

-- Create the view that provides row-level search query data
CREATE VIEW public.search_query_detail AS
SELECT 
    ap.start_date,
    ap.end_date,
    ap.asin,
    ap.product_title,
    sq.search_query,
    sq.search_query_score,
    sq.search_query_volume,
    -- Use the individual ASIN metrics (not totals)
    sq.asin_impression_count AS impressions,
    sq.asin_click_count AS clicks,
    sq.asin_cart_add_count AS cart_adds,
    sq.asin_purchase_count AS purchases,
    -- Share metrics
    sq.asin_impression_share AS impression_share,
    sq.asin_click_share AS click_share,
    sq.asin_cart_add_share AS cart_add_share,
    sq.asin_purchase_share AS purchase_share,
    -- Calculate rates
    CASE 
        WHEN sq.asin_impression_count > 0 
        THEN (sq.asin_click_count::DECIMAL / sq.asin_impression_count) * 100
        ELSE 0 
    END AS click_through_rate,
    CASE 
        WHEN sq.asin_click_count > 0 
        THEN (sq.asin_cart_add_count::DECIMAL / sq.asin_click_count) * 100
        ELSE 0 
    END AS cart_add_rate,
    CASE 
        WHEN sq.asin_cart_add_count > 0 
        THEN (sq.asin_purchase_count::DECIMAL / sq.asin_cart_add_count) * 100
        ELSE 0 
    END AS purchase_rate,
    CASE 
        WHEN sq.asin_impression_count > 0 
        THEN (sq.asin_purchase_count::DECIMAL / sq.asin_impression_count) * 100
        ELSE 0 
    END AS conversion_rate,
    -- Pricing
    sq.asin_median_purchase_price AS median_price,
    sq.asin_median_click_price AS median_click_price,
    sq.asin_median_cart_add_price AS median_cart_add_price,
    ap.created_at,
    ap.updated_at
FROM sqp.asin_performance_data ap
JOIN sqp.search_query_performance sq ON ap.id = sq.asin_performance_id;

-- Grant permissions
GRANT SELECT ON public.search_query_detail TO anon, authenticated, service_role;

-- Add comment
COMMENT ON VIEW public.search_query_detail IS 'Detailed search query performance data for each ASIN and query combination';

-- ================================================================
-- 2. Create an alias for the API that expects search_performance_summary
-- ================================================================

-- Since the existing search_performance_summary has aggregated data,
-- we'll rename the query-detail view to match what the API expects
DROP VIEW IF EXISTS public.search_performance_summary_detail CASCADE;

-- Create an alias that points to our detailed view
CREATE VIEW public.search_performance_summary_detail AS
SELECT * FROM public.search_query_detail;

-- Grant permissions
GRANT SELECT ON public.search_performance_summary_detail TO anon, authenticated, service_role;

-- ================================================================
-- 3. Ensure asin_performance_by_brand view exists (for brand dashboard)
-- ================================================================

-- Check if the view exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = 'asin_performance_by_brand'
    ) THEN
        -- Create the view
        CREATE VIEW public.asin_performance_by_brand AS
        SELECT 
            b.id as brand_id,
            b.display_name as brand_name,
            apd.asin,
            apd.product_title,
            -- Aggregate metrics from search_query_performance
            COALESCE(SUM(sqp.asin_impression_count), 0) as impressions,
            COALESCE(SUM(sqp.asin_click_count), 0) as clicks,
            COALESCE(SUM(sqp.asin_cart_add_count), 0) as cart_adds,
            COALESCE(SUM(sqp.asin_purchase_count), 0) as purchases,
            -- Calculate rates
            CASE WHEN SUM(sqp.asin_impression_count) > 0 
                THEN ROUND((SUM(sqp.asin_click_count)::numeric / SUM(sqp.asin_impression_count)::numeric) * 100, 1)
                ELSE 0 
            END as click_through_rate,
            CASE WHEN SUM(sqp.asin_click_count) > 0 
                THEN ROUND((SUM(sqp.asin_purchase_count)::numeric / SUM(sqp.asin_click_count)::numeric) * 100, 1)
                ELSE 0 
            END as conversion_rate,
            -- Average share metrics
            COALESCE(AVG(sqp.asin_impression_share), 0) as impression_share,
            COALESCE(AVG(sqp.asin_click_share), 0) as click_share,
            COALESCE(AVG(sqp.asin_purchase_share), 0) as purchase_share
        FROM sqp.brands b
        JOIN sqp.asin_brand_mapping abm ON b.id = abm.brand_id
        JOIN sqp.asin_performance_data apd ON abm.asin = apd.asin
        LEFT JOIN sqp.search_query_performance sqp ON apd.id = sqp.asin_performance_id
        GROUP BY b.id, b.display_name, apd.asin, apd.product_title;
        
        -- Grant permissions
        GRANT SELECT ON public.asin_performance_by_brand TO anon, authenticated, service_role;
    END IF;
END $$;

-- ================================================================
-- 4. Create period comparison views if they don't exist
-- ================================================================

-- Check for period_comparisons view
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = 'period_comparisons'
    ) THEN
        -- Create a basic period comparisons view
        CREATE VIEW public.period_comparisons AS
        WITH weekly_data AS (
            SELECT 
                apd.asin,
                DATE_TRUNC('week', apd.start_date) as period_start,
                'weekly' as period_type,
                SUM(sqp.asin_impression_count) as impressions,
                SUM(sqp.asin_click_count) as clicks,
                SUM(sqp.asin_cart_add_count) as cart_adds,
                SUM(sqp.asin_purchase_count) as purchases
            FROM sqp.asin_performance_data apd
            JOIN sqp.search_query_performance sqp ON apd.id = sqp.asin_performance_id
            GROUP BY apd.asin, DATE_TRUNC('week', apd.start_date)
        ),
        monthly_data AS (
            SELECT 
                apd.asin,
                DATE_TRUNC('month', apd.start_date) as period_start,
                'monthly' as period_type,
                SUM(sqp.asin_impression_count) as impressions,
                SUM(sqp.asin_click_count) as clicks,
                SUM(sqp.asin_cart_add_count) as cart_adds,
                SUM(sqp.asin_purchase_count) as purchases
            FROM sqp.asin_performance_data apd
            JOIN sqp.search_query_performance sqp ON apd.id = sqp.asin_performance_id
            GROUP BY apd.asin, DATE_TRUNC('month', apd.start_date)
        )
        SELECT * FROM weekly_data
        UNION ALL
        SELECT * FROM monthly_data;
        
        -- Grant permissions
        GRANT SELECT ON public.period_comparisons TO anon, authenticated, service_role;
    END IF;
END $$;

-- ================================================================
-- 5. Verification queries
-- ================================================================

-- List all views that should now exist
SELECT 
    'Views Created/Verified' as status,
    string_agg(table_name, ', ' ORDER BY table_name) as view_names
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name IN (
    'search_query_detail',
    'search_performance_summary_detail',
    'asin_performance_by_brand',
    'period_comparisons'
);

-- Show row counts for key tables
SELECT 
    'asin_performance_data' as table_name,
    COUNT(*) as row_count
FROM sqp.asin_performance_data
UNION ALL
SELECT 
    'search_query_performance' as table_name,
    COUNT(*) as row_count
FROM sqp.search_query_performance;