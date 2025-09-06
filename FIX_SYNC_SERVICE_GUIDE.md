# Fix Sync Service Guide

## Problem
The BigQuery sync service is failing with:
1. "Table configuration not found" - Missing `refresh_config` table
2. Query syntax errors - Using quotes instead of backticks for BigQuery column names
3. Column mapping issues - BigQuery uses space-separated column names

## Solution

### Step 1: Create Sync Infrastructure
Execute the following migration in Supabase SQL Editor:

```sql
-- Copy and run: /src/lib/supabase/migrations/033_create_sync_infrastructure.sql
```

This creates:
- `sqp.refresh_config` - Table configuration for sync
- `sqp.refresh_audit_log` - Sync operation logging
- Default configurations for our tables
- Public views for Supabase client access

### Step 2: Use Fixed Sync Service

The fixed sync service (`sync-service-fixed.ts`) addresses:
- ✅ Correct BigQuery column names with backticks
- ✅ Proper date handling
- ✅ Parent record creation before child records
- ✅ Batch processing
- ✅ Error handling

Key fixes:
```typescript
// Correct: Using backticks for columns with spaces
`\`Parent ASIN\`` instead of "Parent ASIN"
`\`Date\`` instead of "Date"

// Correct: Handling date objects
DATE(\`Date\`) to extract date from timestamp
```

### Step 3: Test the Fix

Run the test script:
```bash
npx tsx src/scripts/test-fixed-sync.ts
```

This will:
1. Check if sync infrastructure exists
2. Sync ASIN performance data
3. Sync search query performance data
4. Verify data was synced correctly

## Expected Results

After running the migration and test:
- ✅ Sync infrastructure tables exist
- ✅ Sync completes without errors
- ✅ Data flows from BigQuery to Supabase
- ✅ Long ASINs (up to 20 chars) are supported

## Manual Sync Commands

To sync specific date ranges:

```typescript
const syncService = new BigQuerySyncServiceFixed()

// Sync ASIN data
await syncService.syncTable('asin_performance_data', {
  dateRange: {
    start: '2025-08-01',
    end: '2025-08-10'
  },
  batchSize: 1000
})

// Sync search queries
await syncService.syncTable('search_query_performance', {
  dateRange: {
    start: '2025-08-01',
    end: '2025-08-10'
  },
  batchSize: 500
})
```

## Monitoring

Check sync status:
```sql
-- Recent sync attempts
SELECT * FROM refresh_audit_log 
ORDER BY refresh_started_at DESC 
LIMIT 10;

-- Configuration
SELECT * FROM refresh_config;
```

## Next Steps

1. Apply the migration to create sync infrastructure
2. Test with the fixed sync service
3. Set up automated sync schedule if needed
4. Monitor for any long ASINs in future data