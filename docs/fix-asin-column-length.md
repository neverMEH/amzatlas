# Fix ASIN Column Length

## Issue
The BigQuery sync is failing because the ASIN column in `sqp.asin_performance_data` is limited to VARCHAR(10), but some ASINs are 11 characters long (e.g., "B0FM1J8DXM").

Additionally, there are multiple dependent views and materialized views that prevent altering the column directly:
- `public.asin_performance_by_brand` 
- `public.search_performance_summary`
- `sqp.brand_search_query_metrics`

## Solution

### Recommended: Use the Final Safe Migration
Run three migrations in order:
1. `031_fix_asin_column_final_safe.sql` - Fixes the ASIN column length (checks each object individually)
2. `032_recreate_asin_performance_by_brand.sql` - Recreates the brand performance view
3. `033_recreate_brand_search_query_metrics.sql` - Recreates the brand search query metrics

### Why This Works
The final safe migration:
- Checks each object individually to determine if it's a TABLE, VIEW, or MATERIALIZED VIEW
- Only drops the appropriate type (no more "not a view" or "not a materialized view" errors)
- Provides detailed logging throughout the process
- Handles all tables with ASIN columns

## Steps

### Using the Final Safe Migration

#### Step 1: Fix ASIN Column Length
1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy and paste the entire contents of `/src/lib/supabase/migrations/031_fix_asin_column_final_safe.sql`
4. Click "Run" to execute the migration
   - You'll see detailed logging showing each object being checked and handled
   - The migration will report the final status of all ASIN columns

#### Step 2: Recreate Brand Performance View
1. After the first migration completes successfully
2. Copy and paste the entire contents of `/src/lib/supabase/migrations/032_recreate_asin_performance_by_brand.sql`
3. Click "Run" to execute the migration

#### Step 3: Recreate Brand Search Query Metrics
1. After the second migration completes successfully
2. Copy and paste the entire contents of `/src/lib/supabase/migrations/033_recreate_brand_search_query_metrics.sql`
3. Click "Run" to execute the migration

### If Option A Fails

If you encounter errors with the alternative migration, use the comprehensive version (`031_fix_asin_column_length_comprehensive.sql`) which uses a recursive function to find all dependencies automatically.

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