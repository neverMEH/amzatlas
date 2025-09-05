-- Migration: Fix ASIN column length constraint
-- The ASIN column is currently VARCHAR(10) but some ASINs are 11+ characters long

-- Step 1: Drop dependent views and materialized views
-- We need to drop them in dependency order
DROP VIEW IF EXISTS public.asin_performance_by_brand CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.search_performance_summary CASCADE;
DROP VIEW IF EXISTS public.asin_performance_data CASCADE;

-- Step 2: Alter the ASIN columns in all tables
ALTER TABLE sqp.asin_performance_data 
ALTER COLUMN asin TYPE VARCHAR(20);

-- Update other tables that have ASIN columns
DO $$
BEGIN
  -- Check and update search_query_performance
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sqp' 
    AND table_name = 'search_query_performance' 
    AND column_name = 'asin'
  ) THEN
    ALTER TABLE sqp.search_query_performance 
    ALTER COLUMN asin TYPE VARCHAR(20);
  END IF;
  
  -- Check and update daily_sqp_data
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sqp' 
    AND table_name = 'daily_sqp_data' 
    AND column_name = 'asin'
  ) THEN
    ALTER TABLE sqp.daily_sqp_data 
    ALTER COLUMN asin TYPE VARCHAR(20);
  END IF;
  
  -- Check and update brands table if it has asin column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sqp' 
    AND table_name = 'brands' 
    AND column_name = 'asin'
  ) THEN
    ALTER TABLE sqp.brands 
    ALTER COLUMN asin TYPE VARCHAR(20);
  END IF;
END $$;

-- Step 3: Recreate the basic asin_performance_data view
CREATE VIEW public.asin_performance_data AS
SELECT 
  id,
  start_date,
  end_date,
  asin,
  created_at,
  updated_at,
  product_title
FROM sqp.asin_performance_data;

-- Grant permissions
GRANT SELECT ON public.asin_performance_data TO authenticated;
GRANT SELECT ON public.asin_performance_data TO anon;
GRANT SELECT ON public.asin_performance_data TO service_role;

-- Step 4: Recreate search_performance_summary materialized view (if the tables exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'sqp' 
    AND table_name = 'search_query_performance'
  ) THEN
    CREATE MATERIALIZED VIEW public.search_performance_summary AS
    WITH performance_data AS (
      SELECT 
        apd.asin,
        apd.start_date,
        apd.end_date,
        apd.product_title,
        sqp.search_query,
        sqp.search_query_score,
        sqp.search_query_volume,
        sqp.asin_impression_count,
        sqp.asin_click_count,
        sqp.asin_cart_add_count,
        sqp.asin_purchase_count,
        sqp.asin_impression_share,
        sqp.asin_click_share,
        sqp.asin_cart_add_share,
        sqp.asin_purchase_share
      FROM sqp.asin_performance_data apd
      LEFT JOIN sqp.search_query_performance sqp 
        ON apd.id = sqp.asin_performance_id
    )
    SELECT * FROM performance_data
    WHERE search_query IS NOT NULL;

    -- Create indexes
    CREATE INDEX idx_sps_asin ON public.search_performance_summary(asin);
    CREATE INDEX idx_sps_dates ON public.search_performance_summary(start_date, end_date);
    CREATE INDEX idx_sps_search_query ON public.search_performance_summary(search_query);

    -- Grant permissions
    GRANT SELECT ON public.search_performance_summary TO authenticated;
    GRANT SELECT ON public.search_performance_summary TO anon;
    GRANT SELECT ON public.search_performance_summary TO service_role;
  END IF;
END $$;

-- Add documentation
COMMENT ON COLUMN sqp.asin_performance_data.asin IS 'Amazon Standard Identification Number - increased to VARCHAR(20) to handle longer ASINs';

-- Note: The asin_performance_by_brand view needs to be recreated separately 
-- as it has complex aggregations and brand relationships that require 
-- understanding the exact schema and brand mapping approach