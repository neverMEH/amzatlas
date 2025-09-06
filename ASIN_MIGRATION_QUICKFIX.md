# ASIN Migration - Quick Fix Guide

## The Problem
Multiple views depend on ASIN columns, creating a cascade of errors when trying to alter the column type.

## Quick Solution - Execute These Commands in Order:

### Step 1: Drop ALL Views First
```sql
-- Drop all known views/materialized views
DROP VIEW IF EXISTS public.search_query_performance CASCADE;
DROP VIEW IF EXISTS sqp.search_query_performance CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sqp.search_performance_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sqp.brand_search_query_metrics CASCADE;
DROP VIEW IF EXISTS public.search_performance_summary CASCADE;
DROP VIEW IF EXISTS public.asin_performance_data CASCADE;
DROP VIEW IF EXISTS public.asin_performance_by_brand CASCADE;
```

### Step 2: Alter ASIN Columns
```sql
-- Now alter the columns (this should work after dropping views)
ALTER TABLE sqp.asin_performance_data ALTER COLUMN asin TYPE VARCHAR(20);
ALTER TABLE sqp.search_query_performance ALTER COLUMN asin TYPE VARCHAR(20);

-- Check for other tables
SELECT table_schema, table_name 
FROM information_schema.columns 
WHERE column_name = 'asin' 
  AND table_schema IN ('sqp', 'public')
  AND data_type = 'character varying';
```

### Step 3: Test the Fix
```sql
-- Test with an 11-character ASIN
INSERT INTO sqp.asin_performance_data (asin, start_date, end_date)
VALUES ('B0123456789', '2025-09-06', '2025-09-06');

-- If it works, clean up
DELETE FROM sqp.asin_performance_data 
WHERE asin = 'B0123456789' AND start_date = '2025-09-06';
```

### Step 4: Recreate Essential Views (Optional)
```sql
-- Recreate the public view for asin_performance_data
CREATE OR REPLACE VIEW public.asin_performance_data AS
SELECT * FROM sqp.asin_performance_data;

-- Grant permissions
GRANT SELECT ON public.asin_performance_data TO authenticated;
GRANT SELECT ON public.asin_performance_data TO anon;
```

## If You Still Get Errors

Run this to find ALL views that need to be dropped:
```sql
SELECT DISTINCT 
  n.nspname || '.' || c.relname as view_name,
  CASE c.relkind 
    WHEN 'v' THEN 'VIEW'
    WHEN 'm' THEN 'MATERIALIZED VIEW'
  END as type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid
WHERE a.attname = 'asin'
  AND c.relkind IN ('v', 'm')
  AND n.nspname IN ('sqp', 'public');
```

## Nuclear Option

If you're still stuck, use the nuclear migration:
`/root/amzatlas/src/lib/supabase/migrations/031_fix_asin_nuclear.sql`

This drops ALL views in sqp schema and recreates only the essential ones.