-- Migration: Fix ASIN column length constraint (Alternative Approach)
-- This version lists all views first, then drops them explicitly

-- Step 1: List all views that might depend on ASIN columns
DO $$
DECLARE
  view_record RECORD;
  view_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Checking for views that might depend on ASIN columns...';
  
  -- List all views in public and sqp schemas
  FOR view_record IN 
    SELECT 
      n.nspname as schema_name,
      c.relname as view_name,
      CASE c.relkind 
        WHEN 'v' THEN 'VIEW'
        WHEN 'm' THEN 'MATERIALIZED VIEW'
      END as view_type
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('v', 'm')
      AND n.nspname IN ('public', 'sqp', 'pg_catalog')
      AND c.relname LIKE '%performance%' OR c.relname LIKE '%brand%' OR c.relname LIKE '%asin%'
    ORDER BY n.nspname, c.relname
  LOOP
    RAISE NOTICE 'Found: % %.%', view_record.view_type, view_record.schema_name, view_record.view_name;
    view_count := view_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Total views found: %', view_count;
END $$;

-- Step 2: Drop all potentially dependent views explicitly
-- Drop in order of dependency (most dependent first)

-- Drop views that might reference search_query_performance
DROP VIEW IF EXISTS search_query_performance CASCADE;
DROP VIEW IF EXISTS public.search_query_performance CASCADE;
DROP VIEW IF EXISTS sqp.search_query_performance CASCADE;

-- Drop materialized views
DROP MATERIALIZED VIEW IF EXISTS sqp.brand_search_query_metrics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.search_performance_summary CASCADE;

-- Drop regular views
DROP VIEW IF EXISTS public.asin_performance_by_brand CASCADE;
DROP VIEW IF EXISTS public.search_performance_summary CASCADE;
DROP VIEW IF EXISTS public.asin_performance_data CASCADE;

-- Step 3: Now alter the ASIN columns
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

-- Step 4: Recreate the basic asin_performance_data view
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

GRANT SELECT ON public.asin_performance_data TO authenticated;
GRANT SELECT ON public.asin_performance_data TO anon;
GRANT SELECT ON public.asin_performance_data TO service_role;

-- Step 5: Check if search_query_performance is a table or view
DO $$
BEGIN
  -- If search_query_performance exists as a view in public schema, recreate it
  IF EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'search_query_performance'
  ) THEN
    -- Recreate as a simple pass-through view
    CREATE VIEW public.search_query_performance AS
    SELECT * FROM sqp.search_query_performance;
    
    GRANT SELECT ON public.search_query_performance TO authenticated;
    GRANT SELECT ON public.search_query_performance TO anon;
    GRANT SELECT ON public.search_query_performance TO service_role;
  END IF;
  
  -- Recreate search_performance_summary if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'sqp' 
    AND table_name = 'search_query_performance'
  ) THEN
    CREATE VIEW public.search_performance_summary AS
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

    GRANT SELECT ON public.search_performance_summary TO authenticated;
    GRANT SELECT ON public.search_performance_summary TO anon;
    GRANT SELECT ON public.search_performance_summary TO service_role;
  END IF;
END $$;

-- Add documentation
COMMENT ON COLUMN sqp.asin_performance_data.asin IS 'Amazon Standard Identification Number - increased to VARCHAR(20) to handle longer ASINs';

-- Note: Run migrations 032 and 033 after this to recreate the other views