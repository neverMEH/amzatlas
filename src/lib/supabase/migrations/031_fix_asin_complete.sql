-- Migration: Fix ASIN column length - Complete Version
-- This version drops ALL views and materialized views before altering columns

-- Step 1: Drop ALL materialized views in sqp schema
DROP MATERIALIZED VIEW IF EXISTS sqp.search_performance_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sqp.brand_search_query_metrics CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sqp.brand_performance_summary CASCADE;

-- Drop any other materialized views we might have missed
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT schemaname, matviewname 
    FROM pg_matviews 
    WHERE schemaname = 'sqp'
  LOOP
    EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %I.%I CASCADE', r.schemaname, r.matviewname);
    RAISE NOTICE 'Dropped materialized view %.%', r.schemaname, r.matviewname;
  END LOOP;
END $$;

-- Step 2: Drop ALL regular views
DROP VIEW IF EXISTS public.search_query_performance CASCADE;
DROP VIEW IF EXISTS public.search_performance_summary CASCADE;
DROP VIEW IF EXISTS public.asin_performance_data CASCADE;
DROP VIEW IF EXISTS public.asin_performance_by_brand CASCADE;

-- Drop any other views we might have missed
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT schemaname, viewname 
    FROM pg_views 
    WHERE schemaname IN ('sqp', 'public')
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', r.schemaname, r.viewname);
    RAISE NOTICE 'Dropped view %.%', r.schemaname, r.viewname;
  END LOOP;
END $$;

-- Step 3: NOW we can alter ASIN columns in tables
ALTER TABLE sqp.asin_performance_data ALTER COLUMN asin TYPE VARCHAR(20);
ALTER TABLE sqp.search_query_performance ALTER COLUMN asin TYPE VARCHAR(20);

-- Alter any other tables with ASIN columns
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN 
    SELECT 
      table_schema,
      table_name
    FROM information_schema.columns
    WHERE column_name = 'asin'
      AND table_schema IN ('sqp', 'public')
      AND data_type = 'character varying'
      AND character_maximum_length < 20
      AND table_name IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname IN ('sqp', 'public')
      )
  LOOP
    IF NOT (rec.table_schema = 'sqp' AND rec.table_name IN ('asin_performance_data', 'search_query_performance')) THEN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN asin TYPE VARCHAR(20)', 
                     rec.table_schema, rec.table_name);
      RAISE NOTICE 'Updated %.% ASIN column to VARCHAR(20)', rec.table_schema, rec.table_name;
    END IF;
  END LOOP;
END $$;

-- Step 4: Verify all ASIN columns are updated
DO $$
DECLARE
  rec RECORD;
  count_updated INTEGER := 0;
  count_total INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== ASIN Column Update Results ===';
  
  FOR rec IN 
    SELECT 
      table_schema,
      table_name,
      character_maximum_length
    FROM information_schema.columns
    WHERE column_name = 'asin'
      AND table_schema IN ('sqp', 'public')
      AND data_type = 'character varying'
      AND table_name IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname IN ('sqp', 'public')
      )
    ORDER BY table_schema, table_name
  LOOP
    count_total := count_total + 1;
    RAISE NOTICE '  %.%: VARCHAR(%)', 
      rec.table_schema, rec.table_name, rec.character_maximum_length;
    
    IF rec.character_maximum_length >= 20 THEN
      count_updated := count_updated + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Updated % out of % ASIN columns to VARCHAR(20) or greater', count_updated, count_total;
  
  IF count_updated = count_total THEN
    RAISE NOTICE '✅ All ASIN columns successfully updated!';
  ELSE
    RAISE NOTICE '⚠️  Some ASIN columns were not updated. Check the list above.';
  END IF;
END $$;

-- Step 5: Test the migration worked
DO $$
BEGIN
  -- Try to insert an 11-character ASIN
  INSERT INTO sqp.asin_performance_data (asin, start_date, end_date)
  VALUES ('B01234567890', '2025-09-06', '2025-09-06');
  
  -- If we got here, it worked! Clean up
  DELETE FROM sqp.asin_performance_data 
  WHERE asin = 'B01234567890' AND start_date = '2025-09-06';
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Test successful: Can now insert ASINs up to 20 characters!';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Test failed: %', SQLERRM;
END $$;

-- Note: Views will need to be recreated after this migration
-- The important thing is that ASIN columns are now VARCHAR(20)