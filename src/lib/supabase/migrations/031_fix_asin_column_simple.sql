-- Migration: Fix ASIN column length constraint - Simple Version
-- This version handles the sqp schema materialized view properly

-- Step 1: Drop the materialized view that's blocking the change
DROP MATERIALIZED VIEW IF EXISTS sqp.search_performance_summary CASCADE;

-- Step 2: Drop any other dependent views
DROP VIEW IF EXISTS public.search_performance_summary CASCADE;
DROP VIEW IF EXISTS public.asin_performance_data CASCADE;
DROP VIEW IF EXISTS public.asin_performance_by_brand CASCADE;

-- Step 3: Now alter the ASIN columns
ALTER TABLE sqp.asin_performance_data 
  ALTER COLUMN asin TYPE VARCHAR(20);

ALTER TABLE sqp.search_query_performance 
  ALTER COLUMN asin TYPE VARCHAR(20);

-- Also check and update other tables with ASIN columns
DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Find all tables with ASIN columns
  FOR rec IN 
    SELECT 
      table_schema,
      table_name,
      column_name
    FROM information_schema.columns
    WHERE column_name = 'asin'
      AND table_schema IN ('sqp', 'public')
      AND data_type = 'character varying'
      AND character_maximum_length = 10
  LOOP
    -- Skip tables we've already updated
    IF NOT (rec.table_schema = 'sqp' AND rec.table_name IN ('asin_performance_data', 'search_query_performance')) THEN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE VARCHAR(20)', 
                     rec.table_schema, rec.table_name, rec.column_name);
      RAISE NOTICE 'Updated %.%.% to VARCHAR(20)', rec.table_schema, rec.table_name, rec.column_name;
    END IF;
  END LOOP;
END $$;

-- Step 4: Recreate the materialized view
CREATE MATERIALIZED VIEW sqp.search_performance_summary AS
SELECT 
    apd.asin,
    apd.start_date,
    apd.end_date,
    -- Basic counts
    COUNT(DISTINCT sqp.search_query) as unique_search_queries,
    COUNT(*) as total_query_records,
    
    -- Impressions
    SUM(sqp.asin_impression_count) as total_impressions,
    AVG(sqp.asin_impression_share) as avg_impression_share,
    SUM(sqp.total_query_impression_count) as market_impressions,
    
    -- Clicks  
    SUM(sqp.asin_click_count) as total_clicks,
    AVG(sqp.asin_click_share) as avg_click_share,
    SUM(sqp.total_click_count) as market_clicks,
    CASE 
        WHEN SUM(sqp.asin_impression_count) > 0 
        THEN CAST(SUM(sqp.asin_click_count) AS FLOAT) / SUM(sqp.asin_impression_count) * 100
        ELSE 0 
    END as click_through_rate,
    
    -- Cart Adds
    SUM(sqp.asin_cart_add_count) as total_cart_adds,
    AVG(sqp.asin_cart_add_share) as avg_cart_add_share,
    SUM(sqp.total_cart_add_count) as market_cart_adds,
    CASE 
        WHEN SUM(sqp.asin_click_count) > 0 
        THEN CAST(SUM(sqp.asin_cart_add_count) AS FLOAT) / SUM(sqp.asin_click_count) * 100
        ELSE 0 
    END as cart_add_rate,
    
    -- Purchases
    SUM(sqp.asin_purchase_count) as total_purchases,
    AVG(sqp.asin_purchase_share) as avg_purchase_share,
    SUM(sqp.total_purchase_count) as market_purchases,
    CASE 
        WHEN SUM(sqp.asin_click_count) > 0 
        THEN CAST(SUM(sqp.asin_purchase_count) AS FLOAT) / SUM(sqp.asin_click_count) * 100
        ELSE 0 
    END as conversion_rate,
    
    -- Pricing
    AVG(sqp.asin_median_click_price) as avg_click_price,
    AVG(sqp.asin_median_cart_add_price) as avg_cart_add_price,
    AVG(sqp.asin_median_purchase_price) as avg_purchase_price,
    
    -- Metadata
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

-- Create indexes on the materialized view
CREATE INDEX idx_search_perf_summary_asin ON sqp.search_performance_summary(asin);
CREATE INDEX idx_search_perf_summary_dates ON sqp.search_performance_summary(start_date, end_date);

-- Grant permissions
GRANT SELECT ON sqp.search_performance_summary TO authenticated;
GRANT SELECT ON sqp.search_performance_summary TO anon;

-- Step 5: Recreate public views
CREATE OR REPLACE VIEW public.search_performance_summary AS
SELECT * FROM sqp.search_performance_summary;

CREATE OR REPLACE VIEW public.asin_performance_data AS
SELECT * FROM sqp.asin_performance_data;

-- Create asin_performance_by_brand view if brands table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'sqp' AND table_name = 'brands') THEN
    EXECUTE '
      CREATE OR REPLACE VIEW public.asin_performance_by_brand AS
      SELECT 
        b.name as brand_name,
        b.id as brand_id,
        apd.*
      FROM sqp.asin_performance_data apd
      LEFT JOIN sqp.asin_brands ab ON ab.asin = apd.asin
      LEFT JOIN sqp.brands b ON b.id = ab.brand_id
    ';
    GRANT SELECT ON public.asin_performance_by_brand TO authenticated;
    GRANT SELECT ON public.asin_performance_by_brand TO anon;
  END IF;
END $$;

-- Grant permissions on public views
GRANT SELECT ON public.search_performance_summary TO authenticated;
GRANT SELECT ON public.search_performance_summary TO anon;
GRANT SELECT ON public.asin_performance_data TO authenticated;
GRANT SELECT ON public.asin_performance_data TO anon;

-- Step 6: Verify the changes
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '=== Verification of ASIN column updates ===';
  
  FOR rec IN 
    SELECT 
      table_schema,
      table_name,
      column_name,
      character_maximum_length
    FROM information_schema.columns
    WHERE column_name = 'asin'
      AND table_schema IN ('sqp', 'public')
      AND data_type = 'character varying'
    ORDER BY table_schema, table_name
  LOOP
    RAISE NOTICE '%.%.%: VARCHAR(%)', 
      rec.table_schema, rec.table_name, rec.column_name, rec.character_maximum_length;
  END LOOP;
END $$;