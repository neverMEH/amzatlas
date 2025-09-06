# ASIN Migration - Manual Step-by-Step Guide

## Step 1: Identify All Dependencies

First, run this query to find ALL views that depend on ASIN columns:

```sql
-- Find all views/materialized views that use ASIN columns
SELECT DISTINCT
  n.nspname || '.' || c.relname as full_name,
  CASE c.relkind 
    WHEN 'v' THEN 'VIEW'
    WHEN 'm' THEN 'MATERIALIZED VIEW'
  END as type
FROM pg_depend d
JOIN pg_class c ON c.oid = d.objid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
WHERE a.attname = 'asin'
  AND c.relkind IN ('v', 'm')
ORDER BY type DESC, full_name;
```

## Step 2: Drop All Dependent Objects

Based on your errors, at minimum you need to drop:

```sql
-- Drop materialized views first (they're blocking the changes)
DROP MATERIALIZED VIEW IF EXISTS sqp.search_performance_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS sqp.brand_search_query_metrics CASCADE;

-- Drop any other views found in Step 1
-- Add more DROP statements here based on query results
```

## Step 3: Alter ASIN Columns

Now you can alter the columns:

```sql
-- Update main tables
ALTER TABLE sqp.asin_performance_data 
  ALTER COLUMN asin TYPE VARCHAR(20);

ALTER TABLE sqp.search_query_performance 
  ALTER COLUMN asin TYPE VARCHAR(20);

-- Check for other tables with ASIN columns
SELECT table_schema, table_name, column_name, character_maximum_length
FROM information_schema.columns
WHERE column_name = 'asin'
  AND table_schema IN ('sqp', 'public')
  AND data_type = 'character varying'
  AND character_maximum_length = 10;

-- Update any other tables found
-- ALTER TABLE schema.table ALTER COLUMN asin TYPE VARCHAR(20);
```

## Step 4: Verify Column Updates

```sql
-- Verify all ASIN columns are now VARCHAR(20)
SELECT table_schema, table_name, column_name, character_maximum_length
FROM information_schema.columns
WHERE column_name = 'asin'
  AND table_schema IN ('sqp', 'public')
  AND data_type = 'character varying'
ORDER BY table_schema, table_name;
```

## Step 5: Recreate Views

After columns are updated, recreate the views. You'll need the original CREATE statements for:
- `sqp.search_performance_summary`
- `sqp.brand_search_query_metrics`
- Any other views you dropped

## Alternative: Comprehensive Script

If manual steps are too complex, use the comprehensive migration:
`/root/amzatlas/src/lib/supabase/migrations/031_fix_asin_comprehensive.sql`

This script:
1. Automatically finds all dependencies
2. Drops them in the correct order
3. Updates all ASIN columns
4. Recreates all views

## Testing After Migration

```sql
-- Test inserting an 11-character ASIN
INSERT INTO sqp.asin_performance_data (asin, start_date, end_date)
VALUES ('B0123456789', '2025-09-06', '2025-09-06');

-- If successful, the migration worked!
-- Clean up test data
DELETE FROM sqp.asin_performance_data 
WHERE asin = 'B0123456789' AND start_date = '2025-09-06';
```

## Common Issues

1. **"cannot alter type of a column used by a view"**
   - You missed a dependent view. Run Step 1 again to find it.

2. **"relation does not exist"**
   - Check if the object is in 'sqp' schema vs 'public' schema

3. **Views won't recreate**
   - Make sure you have the original CREATE statements
   - Check that all referenced tables/columns exist