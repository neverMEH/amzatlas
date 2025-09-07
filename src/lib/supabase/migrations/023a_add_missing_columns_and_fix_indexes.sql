-- Migration: Add Missing Columns and Fix Indexes
-- Description: Adds missing columns to tables and fixes index references

-- Add missing columns to search_query_performance for easier joins
ALTER TABLE sqp.search_query_performance 
ADD COLUMN IF NOT EXISTS asin VARCHAR(10),
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Update the columns with data from the parent table
UPDATE sqp.search_query_performance sp
SET 
  asin = apd.asin,
  start_date = apd.start_date,
  end_date = apd.end_date
FROM sqp.asin_performance_data apd
WHERE sp.asin_performance_id = apd.id
  AND sp.asin IS NULL;

-- Add simplified aggregate columns for easier calculations
ALTER TABLE sqp.search_query_performance
ADD COLUMN IF NOT EXISTS impressions_sum BIGINT GENERATED ALWAYS AS (asin_impression_count) STORED,
ADD COLUMN IF NOT EXISTS clicks_sum BIGINT GENERATED ALWAYS AS (asin_click_count) STORED,
ADD COLUMN IF NOT EXISTS cart_adds_sum BIGINT GENERATED ALWAYS AS (asin_cart_add_count) STORED,
ADD COLUMN IF NOT EXISTS purchases_sum BIGINT GENERATED ALWAYS AS (asin_purchase_count) STORED,
ADD COLUMN IF NOT EXISTS median_price_purchase DECIMAL(10,2) GENERATED ALWAYS AS (asin_median_purchase_price) STORED;

-- Create indexes on the new columns
CREATE INDEX IF NOT EXISTS idx_search_query_performance_asin ON sqp.search_query_performance(asin);
CREATE INDEX IF NOT EXISTS idx_search_query_performance_dates ON sqp.search_query_performance(start_date, end_date);

-- Add constraint to ensure data integrity
ALTER TABLE sqp.search_query_performance
ADD CONSTRAINT fk_asin_dates_match 
FOREIGN KEY (asin, start_date, end_date) 
REFERENCES sqp.asin_performance_data(asin, start_date, end_date)
ON DELETE CASCADE;