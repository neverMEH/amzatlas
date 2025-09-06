-- Migration: Fix ASIN column length constraint - Comprehensive Version
-- This version finds and drops ALL dependent views before altering columns

-- Step 1: Find and drop ALL dependent views/materialized views
DO $$
DECLARE
  dep RECORD;
  cmd TEXT;
BEGIN
  RAISE NOTICE 'Finding all views dependent on ASIN columns...';
  
  -- Find all dependent views (including materialized views)
  FOR dep IN 
    WITH RECURSIVE dependent_views AS (
      -- Start with tables that have ASIN columns
      SELECT DISTINCT
        d.refobjid::regclass::text as dependent_view,
        c.relkind
      FROM pg_depend d
      JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
      JOIN pg_class c ON c.oid = d.refobjid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE a.attname = 'asin'
        AND c.relkind IN ('v', 'm') -- views and materialized views
        AND n.nspname IN ('sqp', 'public')
      
      UNION
      
      -- Find views that depend on other views
      SELECT DISTINCT
        d.refobjid::regclass::text as dependent_view,
        c.relkind
      FROM dependent_views dv
      JOIN pg_depend d ON d.objid = dv.dependent_view::regclass::oid
      JOIN pg_class c ON c.oid = d.refobjid
      WHERE c.relkind IN ('v', 'm')
    )
    SELECT DISTINCT dependent_view, relkind
    FROM dependent_views
    ORDER BY dependent_view
  LOOP
    -- Determine the correct DROP command based on object type
    IF dep.relkind = 'm' THEN
      cmd := 'DROP MATERIALIZED VIEW IF EXISTS ' || dep.dependent_view || ' CASCADE';
    ELSE
      cmd := 'DROP VIEW IF EXISTS ' || dep.dependent_view || ' CASCADE';
    END IF;
    
    RAISE NOTICE 'Dropping: %', cmd;
    EXECUTE cmd;
  END LOOP;
  
  -- Also explicitly drop known problematic views
  DROP MATERIALIZED VIEW IF EXISTS sqp.search_performance_summary CASCADE;
  DROP MATERIALIZED VIEW IF EXISTS sqp.brand_search_query_metrics CASCADE;
  DROP VIEW IF EXISTS public.search_performance_summary CASCADE;
  DROP VIEW IF EXISTS public.asin_performance_data CASCADE;
  DROP VIEW IF EXISTS public.asin_performance_by_brand CASCADE;
  
END $$;

-- Step 2: Now we can safely alter the ASIN columns
ALTER TABLE sqp.asin_performance_data 
  ALTER COLUMN asin TYPE VARCHAR(20);

ALTER TABLE sqp.search_query_performance 
  ALTER COLUMN asin TYPE VARCHAR(20);

-- Step 3: Update any other tables with ASIN columns
DO $$
DECLARE
  rec RECORD;
BEGIN
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
      BEGIN
        EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE VARCHAR(20)', 
                       rec.table_schema, rec.table_name, rec.column_name);
        RAISE NOTICE 'Updated %.%.% to VARCHAR(20)', rec.table_schema, rec.table_name, rec.column_name;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not update %.%.%: %', rec.table_schema, rec.table_name, rec.column_name, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- Step 4: Recreate the materialized views

-- 4a. Recreate search_performance_summary
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
CREATE INDEX idx_search_perf_summary_asin ON sqp.search_performance_summary(asin);
CREATE INDEX idx_search_perf_summary_dates ON sqp.search_performance_summary(start_date, end_date);

-- 4b. Recreate brand_search_query_metrics if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'sqp' AND table_name = 'brands'
  ) THEN
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
    
    CREATE INDEX idx_brand_metrics_brand ON sqp.brand_search_query_metrics(brand_id);
    CREATE INDEX idx_brand_metrics_query ON sqp.brand_search_query_metrics(search_query);
    CREATE INDEX idx_brand_metrics_asin ON sqp.brand_search_query_metrics(asin);
  END IF;
END $$;

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
  END IF;
END $$;

-- Step 6: Grant permissions
GRANT SELECT ON ALL TABLES IN SCHEMA sqp TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA sqp TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Step 7: Final verification
DO $$
DECLARE
  rec RECORD;
  count_updated INTEGER := 0;
  count_remaining INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== ASIN Column Migration Verification ===';
  
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
    
    IF rec.character_maximum_length = 20 THEN
      count_updated := count_updated + 1;
    ELSE
      count_remaining := count_remaining + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Summary: % columns updated to VARCHAR(20), % columns remaining', 
    count_updated, count_remaining;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Migration complete!';
END $$;