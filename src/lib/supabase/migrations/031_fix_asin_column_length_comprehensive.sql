-- Migration: Fix ASIN column length constraint
-- The ASIN column is currently VARCHAR(10) but some ASINs are 11+ characters long
-- This comprehensive version finds and drops ALL dependent objects

-- Step 1: Create a function to find all dependent views and materialized views
CREATE OR REPLACE FUNCTION find_dependent_views(schema_name text, table_name text, column_name text) 
RETURNS TABLE(view_schema text, view_name text, view_type text) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE view_deps AS (
    -- Find direct dependencies
    SELECT DISTINCT 
      n2.nspname::text as view_schema,
      c2.relname::text as view_name,
      CASE c2.relkind 
        WHEN 'v' THEN 'VIEW'
        WHEN 'm' THEN 'MATERIALIZED VIEW'
      END::text as view_type
    FROM pg_depend d
    JOIN pg_rewrite r ON r.oid = d.objid
    JOIN pg_class c ON c.oid = d.refobjid
    JOIN pg_class c2 ON c2.oid = r.ev_class
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_namespace n2 ON n2.oid = c2.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = d.refobjsubid
    WHERE n.nspname = schema_name
      AND c.relname = table_name
      AND a.attname = column_name
      AND c2.relkind IN ('v', 'm')
    
    UNION
    
    -- Find indirect dependencies (views depending on views)
    SELECT DISTINCT 
      n3.nspname::text as view_schema,
      c3.relname::text as view_name,
      CASE c3.relkind 
        WHEN 'v' THEN 'VIEW'
        WHEN 'm' THEN 'MATERIALIZED VIEW'
      END::text as view_type
    FROM view_deps vd
    JOIN pg_depend d2 ON d2.refobjid IN (
      SELECT c.oid FROM pg_class c 
      JOIN pg_namespace n ON n.oid = c.relnamespace 
      WHERE n.nspname = vd.view_schema AND c.relname = vd.view_name
    )
    JOIN pg_rewrite r2 ON r2.oid = d2.objid
    JOIN pg_class c3 ON c3.oid = r2.ev_class
    JOIN pg_namespace n3 ON n3.oid = c3.relnamespace
    WHERE c3.relkind IN ('v', 'm')
  )
  SELECT * FROM view_deps
  ORDER BY view_type DESC, view_schema, view_name;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Drop all dependent views
DO $$
DECLARE
  dep RECORD;
BEGIN
  -- Find and drop all views that depend on sqp.asin_performance_data.asin
  FOR dep IN 
    SELECT * FROM find_dependent_views('sqp', 'asin_performance_data', 'asin')
  LOOP
    IF dep.view_type = 'MATERIALIZED VIEW' THEN
      EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %I.%I CASCADE', dep.view_schema, dep.view_name);
      RAISE NOTICE 'Dropped materialized view %.%', dep.view_schema, dep.view_name;
    ELSE
      EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', dep.view_schema, dep.view_name);
      RAISE NOTICE 'Dropped view %.%', dep.view_schema, dep.view_name;
    END IF;
  END LOOP;
  
  -- Also manually drop known views to be sure
  DROP MATERIALIZED VIEW IF EXISTS sqp.brand_search_query_metrics CASCADE;
  DROP VIEW IF EXISTS public.asin_performance_by_brand CASCADE;
  DROP VIEW IF EXISTS public.search_performance_summary CASCADE;
  DROP VIEW IF EXISTS public.asin_performance_data CASCADE;
END $$;

-- Clean up the helper function
DROP FUNCTION IF EXISTS find_dependent_views(text, text, text);

-- Step 3: Alter the ASIN columns in all tables
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

-- Grant permissions
GRANT SELECT ON public.asin_performance_data TO authenticated;
GRANT SELECT ON public.asin_performance_data TO anon;
GRANT SELECT ON public.asin_performance_data TO service_role;

-- Step 5: Recreate search_performance_summary view (if the tables exist)
DO $$
BEGIN
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

    -- Grant permissions
    GRANT SELECT ON public.search_performance_summary TO authenticated;
    GRANT SELECT ON public.search_performance_summary TO anon;
    GRANT SELECT ON public.search_performance_summary TO service_role;
  END IF;
END $$;

-- Add documentation
COMMENT ON COLUMN sqp.asin_performance_data.asin IS 'Amazon Standard Identification Number - increased to VARCHAR(20) to handle longer ASINs';

-- Note: Additional views will need to be recreated in subsequent migrations:
-- 1. public.asin_performance_by_brand (migration 032)
-- 2. sqp.brand_search_query_metrics (migration 033)