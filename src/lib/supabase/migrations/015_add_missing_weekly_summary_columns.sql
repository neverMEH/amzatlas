-- Add missing columns to weekly_summary table that should have been added in migration 013

-- Add columns to weekly_summary table to store additional metrics
ALTER TABLE sqp.weekly_summary 
    ADD COLUMN IF NOT EXISTS search_query_score DECIMAL(10, 6),
    ADD COLUMN IF NOT EXISTS search_query_volume BIGINT,
    ADD COLUMN IF NOT EXISTS total_query_impression_count BIGINT,
    ADD COLUMN IF NOT EXISTS total_click_count BIGINT,
    ADD COLUMN IF NOT EXISTS total_cart_add_count BIGINT,
    ADD COLUMN IF NOT EXISTS total_purchase_count BIGINT,
    ADD COLUMN IF NOT EXISTS total_median_click_price DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS asin_median_click_price DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS total_median_cart_add_price DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS asin_median_cart_add_price DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS total_median_purchase_price DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS asin_median_purchase_price DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS cart_adds INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cart_add_rate DECIMAL(10, 6) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cart_add_share DECIMAL(10, 6) DEFAULT 0;

-- Update monthly, quarterly, and yearly tables with cart add metrics
ALTER TABLE sqp.monthly_summary 
    ADD COLUMN IF NOT EXISTS cart_adds INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cart_add_rate DECIMAL(10, 6) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cart_add_share DECIMAL(10, 6) DEFAULT 0;

ALTER TABLE sqp.quarterly_summary 
    ADD COLUMN IF NOT EXISTS cart_adds INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cart_add_rate DECIMAL(10, 6) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cart_add_share DECIMAL(10, 6) DEFAULT 0;

ALTER TABLE sqp.yearly_summary 
    ADD COLUMN IF NOT EXISTS cart_adds INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cart_add_rate DECIMAL(10, 6) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cart_add_share DECIMAL(10, 6) DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN sqp.weekly_summary.cart_adds IS 'Number of times product was added to cart for this query-ASIN combination';
COMMENT ON COLUMN sqp.weekly_summary.cart_add_rate IS 'Cart add rate (cart adds / clicks)';
COMMENT ON COLUMN sqp.weekly_summary.cart_add_share IS 'Share of total cart adds for this query';
COMMENT ON COLUMN sqp.weekly_summary.search_query_score IS 'Relevance score for this search query';
COMMENT ON COLUMN sqp.weekly_summary.search_query_volume IS 'Total search volume for this query';

-- Refresh the public views to pick up the new columns
CREATE OR REPLACE VIEW public.weekly_summary AS
SELECT * FROM sqp.weekly_summary;

-- Grant permissions
GRANT SELECT ON public.weekly_summary TO authenticated, service_role;