# ASIN Column Migration - Final Execution Guide

## Problem Summary
The BigQuery sync is failing because ASINs longer than 10 characters (like "B0FM1J8DXM1") cannot be inserted into the database. The ASIN column is currently VARCHAR(10) but needs to be VARCHAR(20).

## Solution Overview
Run three SQL migrations in sequence to:
1. Fix the ASIN column length in all tables
2. Recreate the brand performance view
3. Recreate the brand search query metrics

## Step-by-Step Execution

### Step 1: Run the ASIN Column Fix
1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy the **ENTIRE** contents of: `/src/lib/supabase/migrations/031_fix_asin_column_corrected.sql`
4. Paste it into the SQL editor
5. Click "Run"
6. You should see output like:
   ```
   === Checking all relevant objects ===
   public.asin_performance_data: VIEW
   public.search_performance_summary: VIEW
   ...
   Dropped VIEW public.search_performance_summary
   ...
   Altered ASIN column in sqp.asin_performance_data to VARCHAR(20)
   ...
   === Migration Complete - Final Status ===
   ```

### Step 2: Recreate Brand Performance View
1. In the same SQL Editor (clear the previous content)
2. Copy the **ENTIRE** contents of: `/src/lib/supabase/migrations/032_recreate_asin_performance_by_brand.sql`
3. Paste and click "Run"
4. You should see: "CREATE VIEW" success message

### Step 3: Recreate Brand Search Query Metrics
1. Clear the SQL Editor again
2. Copy the **ENTIRE** contents of: `/src/lib/supabase/migrations/033_recreate_brand_search_query_metrics.sql`
3. Paste and click "Run"
4. You should see: "CREATE MATERIALIZED VIEW" success message

## Verification
After all three migrations complete:

1. Run this query to verify the column change:
   ```sql
   SELECT 
     column_name, 
     data_type, 
     character_maximum_length
   FROM information_schema.columns
   WHERE table_schema = 'sqp' 
     AND table_name = 'asin_performance_data'
     AND column_name = 'asin';
   ```
   Should show: `character_maximum_length: 20`

2. Test the sync:
   - Go back to your app
   - Click the refresh button
   - The sync should now process all 4,622 records successfully
   - Check the dashboard - data should appear

## Important Notes
- **Use the CORRECTED version**: `031_fix_asin_column_corrected.sql` (not the other versions)
- Run the migrations in order (031 → 032 → 033)
- Each migration builds on the previous one
- If any migration fails, stop and report the error

## Expected Outcome
✅ All ASIN columns support up to 20 characters  
✅ BigQuery sync completes without errors  
✅ Dashboard displays data for all ASINs  
✅ No more "value too long" errors

## If Something Goes Wrong
The migrations are designed to be safe:
- They check object types before dropping
- They use IF EXISTS clauses
- They provide detailed logging

If you see any error, copy the exact error message and we can troubleshoot.