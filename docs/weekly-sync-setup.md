# Weekly 60-Day Rolling Sync Setup Guide

## Overview

The weekly 60-day rolling sync ensures comprehensive data synchronization between BigQuery and Supabase, addressing issues with the daily sync's limited 7-day lookback window.

## Why Weekly Sync?

1. **Data Delays**: BigQuery data can be delayed by days or weeks
2. **Weekly Segmentation**: Amazon SQP data is segmented by week (Sunday snapshots)
3. **Complete Coverage**: 60-day window ensures no data gaps
4. **De-duplication**: Handles duplicate search queries automatically

## Railway Cron Setup

### 1. Create New Service

In Railway dashboard:
1. Add New Service → Cron Job
2. Name: `weekly-bigquery-sync`
3. Source: Same repository as main app

### 2. Configure Environment

Copy all environment variables from main service:
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BIGQUERY_PROJECT_ID`
- `BIGQUERY_DATASET`

Optional configuration:
- `SYNC_BATCH_SIZE` (default: 5000)
- `SYNC_DAYS` (default: 60)

### 3. Set Cron Schedule

Choose one:
- `0 3 * * 1` - Every Monday at 3 AM UTC
- `0 3 * * 0` - Every Sunday at 3 AM UTC
- `0 3 * * 5` - Every Friday at 3 AM UTC

### 4. Deploy Command

```bash
node src/scripts/weekly-sync.js
```

## Script Features

### De-duplication Strategy
```sql
ROW_NUMBER() OVER (
  PARTITION BY Date, parent_asin, search_query 
  ORDER BY MAX(search_query_score) DESC
) as row_num
```

### Batch Processing
- Parent records: 100 per batch
- Search queries: 500 per batch
- Configurable via `SYNC_BATCH_SIZE`

### Comprehensive Logging
```javascript
sync_type: 'weekly-60-day'
metadata: {
  dateRange: { start, end },
  parentRecordsInserted,
  searchQueriesInserted,
  totalRowsProcessed,
  duration,
  errors
}
```

## Monitoring

### Railway Logs
Check cron service logs for:
- Execution start/end times
- Records processed
- Any errors

### Supabase Queries
```sql
-- Check recent syncs
SELECT * FROM sync_log 
WHERE sync_type = 'weekly-60-day'
ORDER BY started_at DESC
LIMIT 10;

-- Check sync health
SELECT 
  status,
  started_at,
  completed_at,
  rows_synced,
  metadata->>'parentRecordsInserted' as parent_records,
  metadata->>'searchQueriesInserted' as search_queries,
  metadata->>'errors' as errors
FROM sync_log 
WHERE sync_type = 'weekly-60-day'
  AND started_at >= NOW() - INTERVAL '7 days';
```

## Manual Testing

Before deploying to cron:

```bash
# Test locally
node src/scripts/weekly-sync.js

# Check results
psql $DATABASE_URL -c "SELECT * FROM sync_log ORDER BY started_at DESC LIMIT 1"
```

## Troubleshooting

### No Data Found
- Check BigQuery has data in date range
- Verify credentials are valid
- Check dataset name is correct

### Duplicate Key Errors
- Script handles these automatically
- Uses ON CONFLICT DO NOTHING
- Check sync_log for actual insert counts

### Memory Issues
- Reduce `SYNC_BATCH_SIZE`
- Check Railway service memory limits

### Authentication Errors
- Verify `GOOGLE_APPLICATION_CREDENTIALS_JSON`
- Check for proper escaping of quotes
- Ensure service account has BigQuery access

## Comparison with Daily Sync

| Feature | Daily Sync | Weekly Sync |
|---------|------------|-------------|
| Lookback | 7 days | 60 days |
| Schedule | Daily 2 AM | Weekly Monday 3 AM |
| Purpose | Recent data | Complete coverage |
| De-duplication | Basic | Advanced |
| Batch size | 5000 | Configurable |

## Best Practices

1. **Run Weekly First**: Ensures complete data coverage
2. **Keep Daily Active**: For quick updates of recent data
3. **Monitor Both**: Check sync_log regularly
4. **Adjust Window**: Modify SYNC_DAYS if needed
5. **Test Changes**: Always test sync scripts before deployment