-- Migration: Create search_performance_summary materialized view and public view
-- Description: Create the missing materialized view and expose it through public schema for API access

-- First, create the materialized view in sqp schema if it doesn't exist
-- This should have been created in migration 013 but seems to be missing
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.search_performance_summary AS
SELECT 
    ap.start_date,
    ap.end_date,
    ap.asin,
    ap.product_title,
    sq.search_query,
    sq.search_query_score,
    sq.search_query_volume,
    -- Impressions
    sq.total_query_impression_count AS total_impressions,
    sq.asin_impression_count AS impressions,
    sq.asin_impression_share AS impression_share,
    -- Clicks
    sq.total_click_count AS total_clicks,
    sq.total_click_rate,
    sq.asin_click_count AS clicks,
    sq.asin_click_share AS click_share,
    sq.asin_click_count::DECIMAL / NULLIF(sq.asin_impression_count, 0) AS click_through_rate,
    -- Cart Adds
    sq.total_cart_add_count AS total_cart_adds,
    sq.total_cart_add_rate,
    sq.asin_cart_add_count AS cart_adds,
    sq.asin_cart_add_share AS cart_add_share,
    sq.asin_cart_add_count::DECIMAL / NULLIF(sq.asin_click_count, 0) AS cart_add_rate,
    -- Purchases
    sq.total_purchase_count AS total_purchases,
    sq.total_purchase_rate,
    sq.asin_purchase_count AS purchases,
    sq.asin_purchase_share AS purchase_share,
    sq.asin_purchase_count::DECIMAL / NULLIF(sq.asin_cart_add_count, 0) AS purchase_rate,
    sq.asin_purchase_count::DECIMAL / NULLIF(sq.asin_impression_count, 0) AS conversion_rate,
    -- Pricing
    sq.total_median_click_price,
    sq.asin_median_click_price AS median_click_price,
    sq.total_median_cart_add_price,
    sq.asin_median_cart_add_price AS median_cart_add_price,
    sq.total_median_purchase_price,
    sq.asin_median_purchase_price AS median_price,
    -- Shipping preferences
    sq.total_same_day_shipping_purchase_count,
    sq.total_one_day_shipping_purchase_count,
    sq.total_two_day_shipping_purchase_count,
    ap.created_at,
    ap.updated_at
FROM sqp.asin_performance_data ap
JOIN sqp.search_query_performance sq ON ap.id = sq.asin_performance_id;

-- Create indexes on the materialized view
CREATE INDEX IF NOT EXISTS idx_search_perf_summary_dates ON sqp.search_performance_summary(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_search_perf_summary_asin ON sqp.search_performance_summary(asin);
CREATE INDEX IF NOT EXISTS idx_search_perf_summary_query ON sqp.search_performance_summary(search_query);

-- Drop existing public view if it exists
DROP VIEW IF EXISTS public.search_performance_summary CASCADE;

-- Create view in public schema that references sqp materialized view
CREATE VIEW public.search_performance_summary AS
SELECT * FROM sqp.search_performance_summary;

-- Grant permissions
GRANT SELECT ON public.search_performance_summary TO anon, authenticated;

-- Comment
COMMENT ON VIEW public.search_performance_summary IS 'Public view for sqp.search_performance_summary to enable API access';

-- Refresh the materialized view with data
REFRESH MATERIALIZED VIEW sqp.search_performance_summary;