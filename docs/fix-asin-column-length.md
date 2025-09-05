# Fix ASIN Column Length

## Issue
The BigQuery sync is failing because the ASIN column in `sqp.asin_performance_data` is limited to VARCHAR(10), but some ASINs are 11 characters long (e.g., "B0FM1J8DXM").

Additionally, there's a dependent view `asin_performance_by_brand` that prevents altering the column directly.

## Solution
Run two migrations in order:
1. `031_fix_asin_column_length_final.sql` - Fixes the ASIN column length
2. `032_recreate_asin_performance_by_brand.sql` - Recreates the brand performance view

## Steps

### Step 1: Fix ASIN Column Length
1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy and paste the entire contents of `/src/lib/supabase/migrations/031_fix_asin_column_length_final.sql`
4. Click "Run" to execute the migration

### Step 2: Recreate Brand Performance View
1. After the first migration completes successfully
2. Copy and paste the entire contents of `/src/lib/supabase/migrations/032_recreate_asin_performance_by_brand.sql`
3. Click "Run" to execute the migration

## What the Migration Does

1. **Drops dependent views** - The public.asin_performance_data view depends on the column
2. **Alters the ASIN column** - Changes from VARCHAR(10) to VARCHAR(20)
3. **Recreates views** - Rebuilds the public views with proper permissions
4. **Updates related tables** - Ensures consistency across all tables with ASIN columns
5. **Handles materialized views** - Properly recreates search_performance_summary if needed

## After Running the Migration

Once the migration is complete, the BigQuery sync should work properly:

1. Go back to the app
2. Click the refresh button
3. The sync should now process all 4,622 records successfully
4. Check that data appears in the dashboard

## Verification

To verify the migration worked:

```sql
-- Check column type
SELECT 
  column_name, 
  data_type, 
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'sqp' 
  AND table_name = 'asin_performance_data'
  AND column_name = 'asin';
```

Should show:
- data_type: `character varying`
- character_maximum_length: `20`