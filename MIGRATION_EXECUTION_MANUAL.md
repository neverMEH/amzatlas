# ASIN Column Migration - Manual Execution Guide

## 🚨 IMPORTANT: Execute in Order!

This guide provides step-by-step instructions for manually executing the ASIN column migration in your Supabase Dashboard.

## Pre-Execution Checklist
- [ ] Database backup created (see Phase 1 documentation)
- [ ] No active queries running on affected tables
- [ ] Ready to monitor execution

## Step 1: Execute ASIN Column Migration

### File: `031_fix_asin_column_corrected.sql`

1. **Open Supabase Dashboard**
   - Go to your Supabase project
   - Navigate to **SQL Editor**

2. **Copy the SQL content**
   - Open file: `/root/amzatlas/migrations_backup_2025_09_06/031_fix_asin_column_corrected.sql`
   - Copy the ENTIRE contents

3. **Execute in SQL Editor**
   - Paste the SQL into the editor
   - Click **Run** or press Ctrl+Enter
   
4. **Expected Output**
   You should see multiple NOTICE messages like:
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

5. **Verify Success**
   - Check for "Migration Complete" message
   - Note any errors (there should be none)
   - Save the output for reference

**Estimated Duration**: 30-60 seconds

---

## Step 2: Recreate Brand Performance View

### File: `032_recreate_asin_performance_by_brand.sql`

1. **Clear SQL Editor**
   - Remove previous content
   
2. **Copy and Execute**
   - Open file: `/root/amzatlas/migrations_backup_2025_09_06/032_recreate_asin_performance_by_brand.sql`
   - Copy entire contents
   - Paste and run

3. **Expected Output**
   ```
   CREATE VIEW
   ```

4. **Verify Success**
   - Should see "CREATE VIEW" success message
   - No errors

**Estimated Duration**: 5-10 seconds

---

## Step 3: Recreate Brand Search Query Metrics

### File: `033_recreate_brand_search_query_metrics.sql`

1. **Clear SQL Editor Again**
   
2. **Copy and Execute**
   - Open file: `/root/amzatlas/migrations_backup_2025_09_06/033_recreate_brand_search_query_metrics.sql`
   - Copy entire contents
   - Paste and run

3. **Expected Output**
   ```
   CREATE MATERIALIZED VIEW
   ```

4. **Verify Success**
   - Should see "CREATE MATERIALIZED VIEW" success message
   - No errors

**Estimated Duration**: 10-20 seconds

---

## Post-Migration Verification

After all three migrations complete successfully:

### 1. Verify Column Changes
Run this query to confirm all ASIN columns are now VARCHAR(20):
```sql
SELECT 
  table_schema,
  table_name,
  column_name,
  data_type,
  character_maximum_length
FROM information_schema.columns
WHERE column_name = 'asin'
  AND table_schema IN ('sqp', 'public')
ORDER BY table_schema, table_name;
```

**Expected**: All `character_maximum_length` should show `20`

### 2. Test Views
Run these queries to ensure views work:
```sql
-- Test public view
SELECT COUNT(*) FROM public.asin_performance_data;

-- Test brand performance view
SELECT COUNT(*) FROM public.asin_performance_by_brand;

-- Test search performance summary
SELECT COUNT(*) FROM public.search_performance_summary;
```

### 3. Check for Broken Dependencies
```sql
-- Find any invalid objects
SELECT 
  n.nspname as schema_name,
  c.relname as object_name,
  CASE c.relkind
    WHEN 'v' THEN 'VIEW'
    WHEN 'm' THEN 'MATERIALIZED VIEW'
  END as object_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('v', 'm')
  AND NOT EXISTS (
    SELECT 1 
    FROM pg_views v 
    WHERE v.schemaname = n.nspname 
      AND v.viewname = c.relname
  );
```

**Expected**: No results (no broken objects)

---

## Troubleshooting

### If Step 1 Fails
- Check for active connections: `SELECT * FROM pg_stat_activity WHERE state = 'active';`
- Kill blocking queries if needed
- Retry the migration

### If Views Don't Recreate
- Check that Step 1 completed fully
- Manually drop any remaining views
- Re-run the view creation scripts

### If Permissions Are Missing
Run:
```sql
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA sqp TO authenticated;
```

---

## Success Criteria

✅ All ASIN columns show VARCHAR(20)
✅ All views recreated successfully
✅ No error messages during execution
✅ Test queries return data
✅ No broken dependencies

---

## Next Steps

Once migration is complete:
1. Update the migration-execution-checklist.md
2. Proceed to Phase 3: BigQuery Sync Testing
3. Monitor for any application errors