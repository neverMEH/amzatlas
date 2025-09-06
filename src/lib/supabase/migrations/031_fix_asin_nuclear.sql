-- Migration: Fix ASIN column length - Nuclear Option
-- This drops ALL views/materialized views that might have ASIN columns

-- Step 1: Drop EVERYTHING that might depend on ASIN columns
-- We'll recreate what we need afterward

DROP VIEW IF EXISTS public.search_query_performance CASCADE;
DROP VIEW IF EXISTS sqp.search_query_performance CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sqp.search_performance_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sqp.brand_search_query_metrics CASCADE;
DROP VIEW IF EXISTS public.search_performance_summary CASCADE;
DROP VIEW IF EXISTS public.asin_performance_data CASCADE;
DROP VIEW IF EXISTS public.asin_performance_by_brand CASCADE;

-- Drop any other views in sqp schema that might have ASIN
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT schemaname, viewname 
    FROM pg_views 
    WHERE schemaname = 'sqp'
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', r.schemaname, r.viewname);
  END LOOP;
  
  -- Also drop materialized views
  FOR r IN
    SELECT schemaname, matviewname
    FROM pg_matviews
    WHERE schemaname = 'sqp'
  LOOP
    EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %I.%I CASCADE', r.schemaname, r.matviewname);
  END LOOP;
END $$;

-- Step 2: Now we can alter all ASIN columns
DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Find and update ALL ASIN columns
  FOR rec IN 
    SELECT 
      table_schema,
      table_name,
      column_name
    FROM information_schema.columns
    WHERE column_name = 'asin'
      AND table_schema IN ('sqp', 'public')
      AND data_type = 'character varying'
      AND table_name IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname IN ('sqp', 'public')
      )
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE VARCHAR(20)', 
                   rec.table_schema, rec.table_name, rec.column_name);
    RAISE NOTICE 'Updated %.%.% to VARCHAR(20)', rec.table_schema, rec.table_name, rec.column_name;
  END LOOP;
END $$;

-- Step 3: Verify all ASIN columns are updated
SELECT 
  table_schema || '.' || table_name as table_name,
  column_name,
  character_maximum_length as max_length
FROM information_schema.columns
WHERE column_name = 'asin'
  AND table_schema IN ('sqp', 'public')
  AND data_type = 'character varying'
ORDER BY table_schema, table_name;

-- Step 4: Recreate essential views (minimal set)

-- Public view for asin_performance_data
CREATE OR REPLACE VIEW public.asin_performance_data AS
SELECT * FROM sqp.asin_performance_data;

GRANT SELECT ON public.asin_performance_data TO authenticated;
GRANT SELECT ON public.asin_performance_data TO anon;

-- Note: You'll need to recreate other views as needed
-- The important thing is that the ASIN columns are now VARCHAR(20)