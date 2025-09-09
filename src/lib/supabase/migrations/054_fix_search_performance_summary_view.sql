-- Migration: Fix search_performance_summary view to have the correct columns
-- Description: Ensures the public view has the columns that the API expects

-- Drop the existing view if it exists
DROP VIEW IF EXISTS public.search_performance_summary CASCADE;

-- Create the view with the correct columns from the base tables
CREATE VIEW public.search_performance_summary AS
SELECT 
    apd.asin,
    apd.start_date,
    apd.end_date,
    apd.product_title,
    sqp.search_query,
    sqp.search_query_score,
    sqp.search_query_volume,
    -- Use the actual column names from the tables
    sqp.asin_impression_count,
    sqp.asin_click_count,
    sqp.asin_cart_add_count,
    sqp.asin_purchase_count,
    sqp.asin_impression_share,
    sqp.asin_click_share,
    sqp.asin_cart_add_share,
    sqp.asin_purchase_share,
    -- Also include total columns if they exist
    sqp.total_query_impression_count,
    sqp.total_click_count,
    sqp.total_cart_add_count,
    sqp.total_purchase_count
FROM sqp.asin_performance_data apd
LEFT JOIN sqp.search_query_performance sqp 
    ON apd.id = sqp.asin_performance_id
WHERE sqp.search_query IS NOT NULL;

-- Grant permissions
GRANT SELECT ON public.search_performance_summary TO anon, authenticated;

-- Add comment
COMMENT ON VIEW public.search_performance_summary IS 'Public view for search performance data with correct column names';