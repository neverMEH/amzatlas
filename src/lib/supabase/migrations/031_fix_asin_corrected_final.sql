-- Migration: Fix ASIN column length - Final Corrected Version
-- Understanding: sqp schema has TABLES, public schema has VIEWS

-- Step 1: Drop all VIEWS and MATERIALIZED VIEWS that depend on ASIN columns
-- (Tables cannot be dropped as they contain the actual data)

-- Drop materialized views first
DROP MATERIALIZED VIEW IF EXISTS sqp.search_performance_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sqp.brand_search_query_metrics CASCADE;

-- Drop regular views
DROP VIEW IF EXISTS public.search_query_performance CASCADE;
DROP VIEW IF EXISTS public.search_performance_summary CASCADE;
DROP VIEW IF EXISTS public.asin_performance_data CASCADE;
DROP VIEW IF EXISTS public.asin_performance_by_brand CASCADE;

-- Step 2: Alter ASIN columns in TABLES
-- These are the actual tables that store data

-- Main tables in sqp schema
ALTER TABLE sqp.asin_performance_data ALTER COLUMN asin TYPE VARCHAR(20);
ALTER TABLE sqp.search_query_performance ALTER COLUMN asin TYPE VARCHAR(20);

-- Check for other tables with ASIN columns
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
    -- Only alter if it's not one we already did
    IF NOT (rec.table_schema = 'sqp' AND rec.table_name IN ('asin_performance_data', 'search_query_performance')) THEN
      EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN asin TYPE VARCHAR(20)', 
                     rec.table_schema, rec.table_name);
      RAISE NOTICE 'Updated %.% ASIN column to VARCHAR(20)', rec.table_schema, rec.table_name;
    END IF;
  END LOOP;
END $$;

-- Step 3: Recreate essential views

-- 3a. Recreate public view for search_query_performance
CREATE OR REPLACE VIEW public.search_query_performance AS
SELECT * FROM sqp.search_query_performance;

-- 3b. Recreate public view for asin_performance_data
CREATE OR REPLACE VIEW public.asin_performance_data AS
SELECT * FROM sqp.asin_performance_data;

-- 3c. Recreate search_performance_summary materialized view
CREATE MATERIALIZED VIEW sqp.search_performance_summary AS
SELECT 
    apd.asin,
    apd.start_date,
    apd.end_date,
    COUNT(DISTINCT sqp.search_query) as unique_search_queries,
    COUNT(*) as total_query_records,
    SUM(sqp.asin_impression_count) as total_impressions,
    AVG(sqp.asin_impression_share) as avg_impression_share,
    SUM(sqp.total_query_impression_count) as market_impressions,
    SUM(sqp.asin_click_count) as total_clicks,
    AVG(sqp.asin_click_share) as avg_click_share,
    SUM(sqp.total_click_count) as market_clicks,
    CASE 
        WHEN SUM(sqp.asin_impression_count) > 0 
        THEN CAST(SUM(sqp.asin_click_count) AS FLOAT) / SUM(sqp.asin_impression_count) * 100
        ELSE 0 
    END as click_through_rate,
    SUM(sqp.asin_cart_add_count) as total_cart_adds,
    AVG(sqp.asin_cart_add_share) as avg_cart_add_share,
    SUM(sqp.total_cart_add_count) as market_cart_adds,
    CASE 
        WHEN SUM(sqp.asin_click_count) > 0 
        THEN CAST(SUM(sqp.asin_cart_add_count) AS FLOAT) / SUM(sqp.asin_click_count) * 100
        ELSE 0 
    END as cart_add_rate,
    SUM(sqp.asin_purchase_count) as total_purchases,
    AVG(sqp.asin_purchase_share) as avg_purchase_share,
    SUM(sqp.total_purchase_count) as market_purchases,
    CASE 
        WHEN SUM(sqp.asin_click_count) > 0 
        THEN CAST(SUM(sqp.asin_purchase_count) AS FLOAT) / SUM(sqp.asin_click_count) * 100
        ELSE 0 
    END as conversion_rate,
    AVG(sqp.asin_median_click_price) as avg_click_price,
    AVG(sqp.asin_median_cart_add_price) as avg_cart_add_price,
    AVG(sqp.asin_median_purchase_price) as avg_purchase_price,
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sps_asin ON sqp.search_performance_summary(asin);
CREATE INDEX IF NOT EXISTS idx_sps_dates ON sqp.search_performance_summary(start_date, end_date);

-- 3d. Create public view for search_performance_summary
CREATE OR REPLACE VIEW public.search_performance_summary AS
SELECT * FROM sqp.search_performance_summary;

-- 3e. Recreate brand-related views if brands table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables 
             WHERE table_schema = 'sqp' AND table_name = 'brands') THEN
    
    -- Recreate brand_search_query_metrics
    EXECUTE '
      CREATE MATERIALIZED VIEW sqp.brand_search_query_metrics AS
      SELECT 
        b.id as brand_id,
        b.name as brand_name,
        sqp.search_query,
        apd.asin,
        SUM(sqp.asin_impression_count) as impressions,
        SUM(sqp.asin_click_count) as clicks,
        SUM(sqp.asin_cart_add_count) as cart_adds,
        SUM(sqp.asin_purchase_count) as purchases,
        AVG(sqp.asin_impression_share) as avg_impression_share,
        AVG(sqp.asin_click_share) as avg_click_share,
        AVG(sqp.asin_cart_add_share) as avg_cart_add_share,
        AVG(sqp.asin_purchase_share) as avg_purchase_share,
        COUNT(*) as data_points
      FROM sqp.search_query_performance sqp
      JOIN sqp.asin_performance_data apd ON apd.id = sqp.asin_performance_id
      JOIN sqp.asin_brands ab ON ab.asin = apd.asin
      JOIN sqp.brands b ON b.id = ab.brand_id
      GROUP BY b.id, b.name, sqp.search_query, apd.asin
    ';
    
    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_bsqm_brand ON sqp.brand_search_query_metrics(brand_id);
    CREATE INDEX IF NOT EXISTS idx_bsqm_query ON sqp.brand_search_query_metrics(search_query);
    CREATE INDEX IF NOT EXISTS idx_bsqm_asin ON sqp.brand_search_query_metrics(asin);
    
    -- Recreate asin_performance_by_brand view
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
  END IF;
END $$;

-- Step 4: Grant permissions
GRANT SELECT ON ALL TABLES IN SCHEMA sqp TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA sqp TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Step 5: Verify the migration
DO $$
DECLARE
  rec RECORD;
  success_count INTEGER := 0;
  fail_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== ASIN Column Migration Verification ===';
  RAISE NOTICE '';
  
  -- Check all ASIN columns
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
    RAISE NOTICE '  %.%: VARCHAR(%)', 
      rec.table_schema, rec.table_name, rec.character_maximum_length;
    
    IF rec.character_maximum_length >= 20 THEN
      success_count := success_count + 1;
    ELSE
      fail_count := fail_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Summary: % ASIN columns successfully updated, % need attention', 
    success_count, fail_count;
  
  IF fail_count = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Migration completed successfully! All ASIN columns are now VARCHAR(20) or greater.';
  ELSE
    RAISE NOTICE '⚠️  Some ASIN columns were not updated. Check the list above.';
  END IF;
END $$;