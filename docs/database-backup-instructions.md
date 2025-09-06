# Database Backup Instructions

## Pre-Migration Backup Process

### Option 1: Supabase Dashboard Backup
1. Go to your Supabase Dashboard
2. Navigate to Settings → Database
3. Click on "Backups" tab
4. Click "Create backup" to create a manual backup
5. Note the backup timestamp for reference

### Option 2: SQL Export (Recommended for ASIN tables)
1. In Supabase SQL Editor, run:
```sql
-- Export current ASIN column definitions
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

-- Export sample data from each table
SELECT * FROM sqp.asin_performance_data LIMIT 100;
SELECT * FROM sqp.search_query_performance LIMIT 100;
SELECT * FROM sqp.daily_sqp_data LIMIT 100;
```
2. Save the results to a file for reference

### Option 3: pg_dump (If you have direct access)
```bash
pg_dump -h [SUPABASE_HOST] -U postgres -d postgres \
  -t sqp.asin_performance_data \
  -t sqp.search_query_performance \
  -t sqp.daily_sqp_data \
  -t sqp.weekly_summary \
  -t sqp.monthly_summary \
  -t sqp.quarterly_summary \
  -t sqp.yearly_summary \
  > asin_tables_backup_$(date +%Y%m%d_%H%M%S).sql
```

## What to Backup

### Critical Tables:
1. `sqp.asin_performance_data` - Core performance metrics
2. `sqp.search_query_performance` - Search query data
3. `sqp.daily_sqp_data` - Daily aggregations
4. All summary tables (weekly, monthly, quarterly, yearly)

### Critical Views:
1. `public.asin_performance_data`
2. `public.search_performance_summary`
3. `public.asin_performance_by_brand`

## Backup Verification
After creating the backup:
1. Verify the backup was created successfully
2. Note the backup ID/timestamp
3. Document in migration log
4. Test restore process on a dev environment if possible

## Recovery Plan
If migration fails:
1. Restore from Supabase backup using Dashboard
2. Or re-run the original table creation scripts
3. Re-sync data from BigQuery if needed