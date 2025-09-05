-- Migration: Fix ASIN column length constraint (Safe Version)
-- This version checks object types before dropping

-- Step 1: Check what search_query_performance objects exist
DO $$
DECLARE
  obj RECORD;
BEGIN
  RAISE NOTICE 'Checking search_query_performance objects...';
  
  FOR obj IN
    SELECT 
      n.nspname as schema_name,
      c.relname as object_name,
      CASE c.relkind 
        WHEN 'r' THEN 'TABLE'
        WHEN 'v' THEN 'VIEW'
        WHEN 'm' THEN 'MATERIALIZED VIEW'
      END as object_type
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'search_query_performance'
    ORDER BY n.nspname
  LOOP
    RAISE NOTICE 'Found: % %.%', obj.object_type, obj.schema_name, obj.object_name;
  END LOOP;
END $$;

-- Step 2: Drop views and materialized views (not tables)
-- Drop materialized views first
DROP MATERIALIZED VIEW IF EXISTS sqp.brand_search_query_metrics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.search_performance_summary CASCADE;

-- Drop regular views
DROP VIEW IF EXISTS public.asin_performance_by_brand CASCADE;
DROP VIEW IF EXISTS public.search_performance_summary CASCADE;
DROP VIEW IF EXISTS public.asin_performance_data CASCADE;

-- Only drop search_query_performance if it's a view
DO $$
BEGIN
  -- Check if public.search_query_performance is a view
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
    AND c.relname = 'search_query_performance'
    AND c.relkind = 'v'
  ) THEN
    DROP VIEW public.search_query_performance CASCADE;
    RAISE NOTICE 'Dropped view public.search_query_performance';
  END IF;
  
  -- Check if sqp.search_query_performance is a view (unlikely, should be a table)
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'sqp' 
    AND c.relname = 'search_query_performance'
    AND c.relkind = 'v'
  ) THEN
    DROP VIEW sqp.search_query_performance CASCADE;
    RAISE NOTICE 'Dropped view sqp.search_query_performance';
  END IF;
END $$;

-- Step 3: Alter the ASIN columns in tables
ALTER TABLE sqp.asin_performance_data 
ALTER COLUMN asin TYPE VARCHAR(20);

-- Update other tables that have ASIN columns
DO $$
BEGIN
  -- Check and update search_query_performance if it's a table with asin column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'sqp' 
    AND table_name = 'search_query_performance' 
    AND column_name = 'asin'
  ) THEN
    ALTER TABLE sqp.search_query_performance 
    ALTER COLUMN asin TYPE VARCHAR(20);
    RAISE NOTICE 'Updated ASIN column in sqp.search_query_performance';
  END IF;
  
  -- Check for search_query_performance in public schema (if it's a table)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'search_query_performance' 
    AND column_name = 'asin'
  ) AND EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
    AND c.relname = 'search_query_performance'
    AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.search_query_performance 
    ALTER COLUMN asin TYPE VARCHAR(20);
    RAISE NOTICE 'Updated ASIN column in public.search_query_performance';
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

-- Step 5: Recreate other views based on what exists

-- If sqp.search_query_performance is a table, we might need to create a view for it
DO $$
BEGIN
  -- Check if we need to create public.search_query_performance as a view
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'sqp' 
    AND table_name = 'search_query_performance'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'search_query_performance'
  ) THEN
    -- Create as a view pointing to sqp table
    CREATE VIEW public.search_query_performance AS
    SELECT * FROM sqp.search_query_performance;
    
    GRANT SELECT ON public.search_query_performance TO authenticated;
    GRANT SELECT ON public.search_query_performance TO anon;
    GRANT SELECT ON public.search_query_performance TO service_role;
    
    RAISE NOTICE 'Created view public.search_query_performance';
  END IF;
  
  -- Recreate search_performance_summary
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
    
    RAISE NOTICE 'Created view public.search_performance_summary';
  END IF;
END $$;

-- Add documentation
COMMENT ON COLUMN sqp.asin_performance_data.asin IS 'Amazon Standard Identification Number - increased to VARCHAR(20) to handle longer ASINs';

-- Final status report
DO $$
DECLARE
  obj RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Final Status ===';
  
  -- Check ASIN column lengths
  FOR obj IN
    SELECT 
      table_schema,
      table_name,
      character_maximum_length
    FROM information_schema.columns
    WHERE column_name = 'asin'
      AND table_schema IN ('sqp', 'public')
    ORDER BY table_schema, table_name
  LOOP
    RAISE NOTICE 'ASIN column in %.%: VARCHAR(%)', 
      obj.table_schema, obj.table_name, obj.character_maximum_length;
  END LOOP;
END $$;

-- Note: Run migrations 032 and 033 after this to recreate the other views