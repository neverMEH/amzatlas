# Deploying Daily BigQuery Refresh Edge Functions

This guide walks through deploying the edge functions for the automated daily BigQuery refresh system.

## Prerequisites

1. **Supabase CLI installed**:
   ```bash
   npm install -g supabase
   ```

2. **Logged into Supabase**:
   ```bash
   supabase login
   ```

3. **Project linked**:
   ```bash
   supabase link --project-ref unkdghonqrxplvjxeotl
   ```

## Step 1: Apply Database Migration

First, apply the helper functions migration:

```sql
-- Run this in Supabase SQL Editor
-- Migration: 032_add_refresh_helper_functions.sql

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_view(view_name TEXT)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_matviews 
    WHERE schemaname || '.' || matviewname = view_name
  ) THEN
    RAISE EXCEPTION 'Materialized view % does not exist', view_name;
  END IF;
  
  EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY ' || view_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION refresh_materialized_view TO service_role;

-- Function to execute SQL (use carefully)
CREATE OR REPLACE FUNCTION execute_sql(sql TEXT)
RETURNS void AS $$
BEGIN
  IF sql ~* '(drop|truncate|delete|grant|revoke|alter)\s' THEN
    RAISE EXCEPTION 'Unsafe SQL operation detected';
  END IF;
  
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION execute_sql TO service_role;

-- Function to get table columns
CREATE OR REPLACE FUNCTION get_table_columns(schema_name TEXT, table_name TEXT)
RETURNS TABLE(column_name TEXT, data_type TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::TEXT,
    c.data_type::TEXT
  FROM information_schema.columns c
  WHERE c.table_schema = schema_name
    AND c.table_name = table_name
  ORDER BY c.ordinal_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_table_columns TO service_role;

-- Additional index for performance
CREATE INDEX IF NOT EXISTS idx_refresh_config_enabled_next 
ON sqp.refresh_config(is_enabled, next_refresh_at) 
WHERE is_enabled = true;
```

## Step 2: Set Edge Function Secrets

Configure the required environment variables for edge functions:

```bash
# Set BigQuery credentials
supabase secrets set GOOGLE_APPLICATION_CREDENTIALS_JSON='paste_your_bigquery_json_here'
supabase secrets set BIGQUERY_PROJECT_ID='amazon-sp-report-loader'
supabase secrets set BIGQUERY_DATASET='dataclient_amzatlas_agency_85'
```

## Step 3: Deploy Edge Functions

Run the deployment commands:

```bash
# Deploy orchestrator with daily schedule (2 AM UTC)
supabase functions deploy daily-refresh-orchestrator \
  --schedule "0 2 * * *" \
  --no-verify-jwt

# Deploy worker functions
supabase functions deploy refresh-asin-performance --no-verify-jwt
supabase functions deploy refresh-search-queries --no-verify-jwt
supabase functions deploy refresh-summary-tables --no-verify-jwt
supabase functions deploy refresh-daily-sqp --no-verify-jwt
supabase functions deploy refresh-generic-table --no-verify-jwt
```

## Step 4: Test the Deployment

### Test Helper Functions

Run this script to verify helper functions:

```bash
npm run test:refresh-functions
```

Or test manually in SQL Editor:

```sql
-- Test get_table_columns
SELECT * FROM get_table_columns('sqp', 'asin_performance_data');

-- Test table row count
SELECT get_table_row_count('sqp', 'asin_performance_data');

-- Check refresh configuration
SELECT * FROM sqp.refresh_config ORDER BY priority DESC;
```

### Test Orchestrator Function

Manually trigger the orchestrator:

```bash
supabase functions invoke daily-refresh-orchestrator
```

Expected response:
```json
{
  "success": true,
  "tablesProcessed": 8,
  "results": ["fulfilled", "fulfilled", ...]
}
```

### Test Individual Worker Functions

Test a specific refresh function:

```bash
# Test ASIN performance refresh
supabase functions invoke refresh-asin-performance \
  --body '{
    "config": {
      "id": 1,
      "table_schema": "sqp",
      "table_name": "asin_performance_data",
      "refresh_frequency_hours": 24
    },
    "auditLogId": 1
  }'
```

## Step 5: Monitor Function Execution

### Check Function Logs

```bash
# View orchestrator logs
supabase functions logs daily-refresh-orchestrator

# View specific worker logs
supabase functions logs refresh-asin-performance
```

### Monitor in Dashboard

1. Go to Supabase Dashboard > Edge Functions
2. Click on each function to see:
   - Execution count
   - Error rate
   - Average duration
   - Recent logs

### Check Audit Logs

```sql
-- View recent refresh attempts
SELECT 
  table_name,
  status,
  refresh_started_at,
  refresh_completed_at,
  rows_processed,
  execution_time_ms,
  error_message
FROM sqp.refresh_audit_log
ORDER BY refresh_started_at DESC
LIMIT 20;

-- Check refresh schedule
SELECT 
  table_name,
  is_enabled,
  last_refresh_at,
  next_refresh_at,
  priority
FROM sqp.refresh_config
ORDER BY next_refresh_at;
```

## Step 6: Verify Daily Schedule

The orchestrator will run automatically at 2 AM UTC daily. To verify:

1. Check the next scheduled run:
   ```sql
   SELECT 
     table_name,
     next_refresh_at,
     next_refresh_at - CURRENT_TIMESTAMP as time_until_refresh
   FROM sqp.refresh_config
   WHERE is_enabled = true
   ORDER BY next_refresh_at
   LIMIT 1;
   ```

2. Wait for the scheduled execution or manually trigger it
3. Check audit logs the next day to confirm execution

## Troubleshooting

### Function Not Found

If you get "function not found" errors:
- Verify deployment: `supabase functions list`
- Check function names match exactly
- Ensure you're in the correct project directory

### Permission Errors

If you get permission errors:
- Verify service role key is set correctly
- Check RLS policies on tables
- Ensure helper functions have SECURITY DEFINER

### BigQuery Connection Issues

If BigQuery queries fail:
- Verify GOOGLE_APPLICATION_CREDENTIALS_JSON is valid
- Check BigQuery dataset and table names
- Test BigQuery access separately

### Timeout Issues

If functions timeout:
- Check batch sizes in the code
- Monitor execution time in audit logs
- Consider increasing checkpoint frequency

## Production Checklist

- [ ] Database migration 032 applied
- [ ] Edge function secrets configured
- [ ] All 6 functions deployed successfully
- [ ] Manual test of orchestrator passed
- [ ] Audit logs show successful test run
- [ ] Daily schedule verified (2 AM UTC)
- [ ] Monitoring alerts configured
- [ ] Documentation updated

## Next Steps

After successful deployment:

1. Monitor first automated run at 2 AM UTC
2. Check audit logs for any issues
3. Adjust refresh priorities if needed
4. Set up alerting for failures
5. Document any customizations

The system is now ready for automated daily BigQuery data refreshes!