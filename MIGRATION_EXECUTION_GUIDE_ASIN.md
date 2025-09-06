# ASIN Column Migration Execution Guide

## ⚠️ CRITICAL: Migration Required

The ASIN columns are currently VARCHAR(10) and MUST be extended to VARCHAR(20) to handle longer ASINs.

## 📋 Pre-Migration Checklist

1. [ ] Have admin access to Supabase SQL Editor
2. [ ] Backup current data (if needed)
3. [ ] Understand that this will temporarily drop and recreate views

## 🚀 Migration Steps

### Option 1: Use the Simple Migration (Recommended)

1. Open Supabase SQL Editor
2. Copy the contents of: `/root/amzatlas/src/lib/supabase/migrations/031_fix_asin_column_simple.sql`
3. Paste and execute in SQL Editor

This migration:
- Drops the blocking materialized view
- Updates all ASIN columns to VARCHAR(20)
- Recreates all views with proper structure

### Option 2: Manual Step-by-Step Execution

If the full migration fails, execute these commands one at a time:

```sql
-- 1. Drop the materialized view that's blocking changes
DROP MATERIALIZED VIEW IF EXISTS sqp.search_performance_summary CASCADE;

-- 2. Update ASIN columns
ALTER TABLE sqp.asin_performance_data ALTER COLUMN asin TYPE VARCHAR(20);
ALTER TABLE sqp.search_query_performance ALTER COLUMN asin TYPE VARCHAR(20);

-- 3. Check for other tables with ASIN columns
SELECT table_schema, table_name, column_name, character_maximum_length
FROM information_schema.columns
WHERE column_name = 'asin'
  AND table_schema IN ('sqp', 'public')
  AND data_type = 'character varying';

-- 4. Update any other ASIN columns found (replace schema.table as needed)
-- ALTER TABLE schema.table_name ALTER COLUMN asin TYPE VARCHAR(20);
```

After updating columns, recreate the materialized view from the migration script.

## ✅ Post-Migration Verification

Run this verification script to ensure success:

```bash
npm run test-asin-insert
```

Or manually test in SQL Editor:

```sql
-- Test inserting an 11-character ASIN
INSERT INTO sqp.asin_performance_data (asin, start_date, end_date)
VALUES ('B0123456789', '2025-09-06', '2025-09-06');

-- If successful, clean up
DELETE FROM sqp.asin_performance_data 
WHERE asin = 'B0123456789' AND start_date = '2025-09-06';
```

## 🚨 If Migration Fails

Common issues and solutions:

1. **"cannot alter type of a column used by a view"**
   - Solution: Make sure to DROP the view/materialized view first
   - The simple migration handles this automatically

2. **"permission denied"**
   - Solution: Ensure you're using admin/service role credentials

3. **"relation does not exist"**
   - Solution: Check if the object is in 'sqp' schema, not 'public'

## 📊 Expected Results

After successful migration:
- All ASIN columns should be VARCHAR(20)
- Can insert ASINs up to 20 characters
- All views should be recreated and functional
- BigQuery sync can handle longer ASINs

## 🔧 Next Steps After Migration

1. Test BigQuery sync: `npm run test-sync`
2. Monitor for any application errors
3. Update sync service to fix query syntax issues
4. Document migration completion

## 📞 Support

If you encounter issues:
1. Check the error message carefully
2. Try the manual step-by-step approach
3. Verify you're in the correct database/project
4. Check Supabase logs for detailed errors

**Remember**: This migration is CRITICAL and must be completed before any 11+ character ASINs appear in BigQuery data.