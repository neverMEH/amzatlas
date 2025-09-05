-- Migration: Fix ASIN column length constraint
-- The ASIN column is currently VARCHAR(10) but some ASINs are 11 characters long

-- First, we need to drop dependent views
DROP VIEW IF EXISTS public.asin_performance_data CASCADE;

-- Now alter the column in the base table
ALTER TABLE sqp.asin_performance_data 
ALTER COLUMN asin TYPE VARCHAR(20);

-- Recreate the public view
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

-- Grant permissions on the view
GRANT SELECT ON public.asin_performance_data TO authenticated;
GRANT SELECT ON public.asin_performance_data TO anon;
GRANT SELECT ON public.asin_performance_data TO service_role;

-- Also update any other tables that have ASIN columns to ensure consistency
-- Check if search_query_performance has an asin column
DO $$
BEGIN
  -- Update search_query_performance if it has an asin column
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'sqp' 
    AND table_name = 'search_query_performance' 
    AND column_name = 'asin'
  ) THEN
    -- Drop dependent views if any
    DROP VIEW IF EXISTS public.search_query_performance CASCADE;
    
    -- Alter the column
    ALTER TABLE sqp.search_query_performance 
    ALTER COLUMN asin TYPE VARCHAR(20);
    
    -- Recreate view if it existed
    IF EXISTS (
      SELECT 1 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
      AND table_name = 'search_query_performance'
    ) THEN
      CREATE VIEW public.search_query_performance AS
      SELECT * FROM sqp.search_query_performance;
      
      GRANT SELECT ON public.search_query_performance TO authenticated;
      GRANT SELECT ON public.search_query_performance TO anon;
      GRANT SELECT ON public.search_query_performance TO service_role;
    END IF;
  END IF;
  
  -- Update daily_sqp_data if it exists and has an asin column
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'sqp' 
    AND table_name = 'daily_sqp_data' 
    AND column_name = 'asin'
  ) THEN
    ALTER TABLE sqp.daily_sqp_data 
    ALTER COLUMN asin TYPE VARCHAR(20);
  END IF;
  
  -- Update search_performance_summary if it exists and has an asin column
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'search_performance_summary' 
    AND column_name = 'asin'
  ) THEN
    -- This is a materialized view, need to drop and recreate
    DROP MATERIALIZED VIEW IF EXISTS public.search_performance_summary CASCADE;
    
    -- Recreate it with the new column type
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
    SELECT 
      asin,
      start_date,
      end_date,
      product_title,
      search_query,
      search_query_score,
      search_query_volume,
      asin_impression_count,
      asin_click_count,
      asin_cart_add_count,
      asin_purchase_count,
      asin_impression_share,
      asin_click_share,
      asin_cart_add_share,
      asin_purchase_share
    FROM performance_data
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

-- Add a comment explaining the change
COMMENT ON COLUMN sqp.asin_performance_data.asin IS 'Amazon Standard Identification Number - increased to VARCHAR(20) to handle longer ASINs';