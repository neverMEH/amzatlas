-- Migration to restructure Supabase schema to match actual BigQuery structure
-- This migration adds new tables and columns to support the nested BigQuery data

-- Add new tables for the complete BigQuery data structure

-- Main table for ASIN-level data (flattened from dataByAsin)
CREATE TABLE IF NOT EXISTS sqp.asin_performance_data (
    id BIGSERIAL PRIMARY KEY,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    asin VARCHAR(10) NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint
    UNIQUE(start_date, end_date, asin)
);

-- Search query performance data (searchQueryData array)
CREATE TABLE IF NOT EXISTS sqp.search_query_performance (
    id BIGSERIAL PRIMARY KEY,
    asin_performance_id BIGINT NOT NULL REFERENCES sqp.asin_performance_data(id) ON DELETE CASCADE,
    
    -- Query data
    search_query TEXT NOT NULL,
    search_query_score DECIMAL(10, 6),
    search_query_volume BIGINT,
    
    -- Impression metrics (from impressionData)
    total_query_impression_count BIGINT NOT NULL DEFAULT 0,
    asin_impression_count BIGINT NOT NULL DEFAULT 0,
    asin_impression_share DECIMAL(10, 6) DEFAULT 0,
    
    -- Click metrics (from clickData)
    total_click_count BIGINT NOT NULL DEFAULT 0,
    total_click_rate DECIMAL(10, 6) DEFAULT 0,
    asin_click_count BIGINT NOT NULL DEFAULT 0,
    asin_click_share DECIMAL(10, 6) DEFAULT 0,
    total_median_click_price DECIMAL(10, 2),
    asin_median_click_price DECIMAL(10, 2),
    total_same_day_shipping_click_count BIGINT DEFAULT 0,
    total_one_day_shipping_click_count BIGINT DEFAULT 0,
    total_two_day_shipping_click_count BIGINT DEFAULT 0,
    
    -- Cart add metrics (from cartAddData)
    total_cart_add_count BIGINT NOT NULL DEFAULT 0,
    total_cart_add_rate DECIMAL(10, 6) DEFAULT 0,
    asin_cart_add_count BIGINT NOT NULL DEFAULT 0,
    asin_cart_add_share DECIMAL(10, 6) DEFAULT 0,
    total_median_cart_add_price DECIMAL(10, 2),
    asin_median_cart_add_price DECIMAL(10, 2),
    total_same_day_shipping_cart_add_count BIGINT DEFAULT 0,
    total_one_day_shipping_cart_add_count BIGINT DEFAULT 0,
    total_two_day_shipping_cart_add_count BIGINT DEFAULT 0,
    
    -- Purchase metrics (from purchaseData)
    total_purchase_count BIGINT NOT NULL DEFAULT 0,
    total_purchase_rate DECIMAL(10, 6) DEFAULT 0,
    asin_purchase_count BIGINT NOT NULL DEFAULT 0,
    asin_purchase_share DECIMAL(10, 6) DEFAULT 0,
    total_median_purchase_price DECIMAL(10, 2),
    asin_median_purchase_price DECIMAL(10, 2),
    total_same_day_shipping_purchase_count BIGINT DEFAULT 0,
    total_one_day_shipping_purchase_count BIGINT DEFAULT 0,
    total_two_day_shipping_purchase_count BIGINT DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    UNIQUE(asin_performance_id, search_query)
);

-- Create indexes for the new tables
CREATE INDEX idx_asin_performance_dates ON sqp.asin_performance_data(start_date, end_date);
CREATE INDEX idx_asin_performance_asin ON sqp.asin_performance_data(asin);

CREATE INDEX idx_search_query_performance_asin_id ON sqp.search_query_performance(asin_performance_id);
CREATE INDEX idx_search_query_performance_query ON sqp.search_query_performance(search_query);
CREATE INDEX idx_search_query_performance_volume ON sqp.search_query_performance(search_query_volume DESC);
CREATE INDEX idx_search_query_performance_purchase_share ON sqp.search_query_performance(asin_purchase_share DESC);

-- Add columns to existing weekly_summary table to store additional metrics
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

-- Note: period_comparisons is a view, not a table. 
-- Cart add columns would need to be added to the view definition in migration 009
-- or we need to drop and recreate the view with the new columns

-- Create a materialized view for easy querying of flattened data
CREATE MATERIALIZED VIEW IF NOT EXISTS sqp.search_performance_summary AS
SELECT 
    ap.start_date,
    ap.end_date,
    ap.asin,
    sq.search_query,
    sq.search_query_score,
    sq.search_query_volume,
    -- Impressions
    sq.total_query_impression_count,
    sq.asin_impression_count,
    sq.asin_impression_share,
    -- Clicks
    sq.total_click_count,
    sq.total_click_rate,
    sq.asin_click_count,
    sq.asin_click_share,
    sq.asin_click_count::DECIMAL / NULLIF(sq.asin_impression_count, 0) AS asin_click_rate,
    -- Cart Adds
    sq.total_cart_add_count,
    sq.total_cart_add_rate,
    sq.asin_cart_add_count,
    sq.asin_cart_add_share,
    sq.asin_cart_add_count::DECIMAL / NULLIF(sq.asin_click_count, 0) AS asin_cart_add_rate,
    -- Purchases
    sq.total_purchase_count,
    sq.total_purchase_rate,
    sq.asin_purchase_count,
    sq.asin_purchase_share,
    sq.asin_purchase_count::DECIMAL / NULLIF(sq.asin_cart_add_count, 0) AS asin_purchase_conversion_rate,
    -- Pricing
    sq.total_median_click_price,
    sq.asin_median_click_price,
    sq.total_median_cart_add_price,
    sq.asin_median_cart_add_price,
    sq.total_median_purchase_price,
    sq.asin_median_purchase_price,
    -- Shipping preferences
    sq.total_same_day_shipping_purchase_count,
    sq.total_one_day_shipping_purchase_count,
    sq.total_two_day_shipping_purchase_count,
    ap.created_at,
    ap.updated_at
FROM sqp.asin_performance_data ap
JOIN sqp.search_query_performance sq ON ap.id = sq.asin_performance_id;

-- Create indexes on the materialized view
CREATE INDEX idx_search_perf_summary_dates ON sqp.search_performance_summary(start_date, end_date);
CREATE INDEX idx_search_perf_summary_asin ON sqp.search_performance_summary(asin);
CREATE INDEX idx_search_perf_summary_query ON sqp.search_performance_summary(search_query);

-- Create trigger to refresh materialized view
CREATE OR REPLACE FUNCTION sqp.refresh_search_performance_summary()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY sqp.search_performance_summary;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on inserts/updates to the base tables
CREATE TRIGGER refresh_search_summary_on_asin_change
AFTER INSERT OR UPDATE OR DELETE ON sqp.asin_performance_data
FOR EACH STATEMENT
EXECUTE FUNCTION sqp.refresh_search_performance_summary();

CREATE TRIGGER refresh_search_summary_on_query_change
AFTER INSERT OR UPDATE OR DELETE ON sqp.search_query_performance
FOR EACH STATEMENT
EXECUTE FUNCTION sqp.refresh_search_performance_summary();

-- Update the timestamp triggers for new tables
CREATE TRIGGER update_asin_performance_timestamp
BEFORE UPDATE ON sqp.asin_performance_data
FOR EACH ROW
EXECUTE FUNCTION sqp.update_timestamp();

CREATE TRIGGER update_search_query_performance_timestamp
BEFORE UPDATE ON sqp.search_query_performance
FOR EACH ROW
EXECUTE FUNCTION sqp.update_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON sqp.asin_performance_data TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON sqp.search_query_performance TO authenticated, service_role;
GRANT SELECT ON sqp.search_performance_summary TO authenticated, service_role;

GRANT USAGE ON SEQUENCE sqp.asin_performance_data_id_seq TO authenticated, service_role;
GRANT USAGE ON SEQUENCE sqp.search_query_performance_id_seq TO authenticated, service_role;

-- Create views in public schema for easier access
CREATE OR REPLACE VIEW public.asin_performance_data AS
SELECT * FROM sqp.asin_performance_data;

CREATE OR REPLACE VIEW public.search_query_performance AS
SELECT * FROM sqp.search_query_performance;

CREATE OR REPLACE VIEW public.search_performance_summary AS
SELECT * FROM sqp.search_performance_summary;

-- Grant permissions on public views
GRANT SELECT ON public.asin_performance_data TO authenticated, service_role;
GRANT SELECT ON public.search_query_performance TO authenticated, service_role;
GRANT SELECT ON public.search_performance_summary TO authenticated, service_role;

-- Add comments for documentation
COMMENT ON TABLE sqp.asin_performance_data IS 'Main table storing ASIN-level performance data for each time period';
COMMENT ON TABLE sqp.search_query_performance IS 'Detailed search query performance metrics for each ASIN and time period';
COMMENT ON MATERIALIZED VIEW sqp.search_performance_summary IS 'Flattened view combining ASIN and search query performance data';