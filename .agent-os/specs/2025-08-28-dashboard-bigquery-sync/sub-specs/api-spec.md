# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-08-28-dashboard-bigquery-sync/spec.md

## Endpoints

### GET /api/sync/trigger

**Purpose:** Manually trigger BigQuery to Supabase sync (protected endpoint)
**Parameters:** 
- `type` (query): Sync type - 'weekly', 'monthly', or 'quarterly' (default: 'weekly')
- `force` (query): Force sync even if data is current - boolean (default: false)
**Response:** 
```json
{
  "syncId": "sync_12345",
  "status": "started",
  "message": "Sync process initiated",
  "estimatedDuration": 300
}
```
**Errors:** 
- 401: Unauthorized - missing or invalid API key
- 409: Conflict - sync already in progress
- 500: Internal server error

### GET /api/sync/status

**Purpose:** Get current sync status and history
**Parameters:** 
- `limit` (query): Number of sync logs to return (default: 10, max: 50)
- `type` (query): Filter by sync type (optional)
**Response:** 
```json
{
  "current": {
    "isRunning": false,
    "lastSync": {
      "id": "sync_12345",
      "startedAt": "2025-08-28T02:00:00Z",
      "completedAt": "2025-08-28T02:05:00Z",
      "status": "completed",
      "recordsProcessed": 15000,
      "recordsInserted": 500,
      "recordsUpdated": 14500
    }
  },
  "history": [
    {
      "id": "sync_12345",
      "type": "weekly",
      "startedAt": "2025-08-28T02:00:00Z",
      "completedAt": "2025-08-28T02:05:00Z",
      "status": "completed",
      "recordsProcessed": 15000
    }
  ],
  "nextScheduledSync": "2025-08-29T02:00:00Z"
}
```
**Errors:** 
- 401: Unauthorized
- 500: Internal server error

### GET /api/monitoring/data-freshness

**Purpose:** Check data freshness across all tables
**Parameters:** None
**Response:** 
```json
{
  "freshness": {
    "weekly_summary": {
      "latestPeriod": "2025-08-21",
      "daysOld": 7,
      "isStale": false,
      "lastSynced": "2025-08-28T02:05:00Z"
    },
    "monthly_summary": {
      "latestPeriod": "2025-07-31",
      "daysOld": 28,
      "isStale": false,
      "lastSynced": "2025-08-28T02:06:00Z"
    }
  },
  "alerts": [],
  "overallHealth": "healthy"
}
```
**Errors:** 
- 500: Internal server error

### POST /api/sync/validate

**Purpose:** Validate data integrity between BigQuery and Supabase
**Parameters:** 
- Request body:
```json
{
  "periodStart": "2025-08-01",
  "periodEnd": "2025-08-21",
  "checks": ["row_count", "sum_validation", "null_check"]
}
```
**Response:** 
```json
{
  "validationId": "val_67890",
  "status": "completed",
  "results": {
    "row_count": {
      "status": "passed",
      "source": 15000,
      "target": 15000,
      "difference": 0
    },
    "sum_validation": {
      "status": "warning",
      "checks": {
        "total_impressions": {
          "source": 2500000,
          "target": 2499998,
          "difference": -2,
          "differencePct": -0.00008
        }
      }
    }
  },
  "overallStatus": "passed_with_warnings"
}
```
**Errors:** 
- 400: Bad request - invalid parameters
- 401: Unauthorized
- 500: Internal server error

## Scheduled Jobs

### Daily Sync Job

**Schedule:** Daily at 2:00 AM UTC
**Function:** `syncBigQueryToSupabase`
**Process:**
1. Check last sync status
2. Query BigQuery for new weekly periods
3. Transform and validate data
4. Insert/update Supabase tables
5. Refresh materialized views
6. Log sync results
7. Send alerts if failed

### Data Quality Check Job

**Schedule:** Daily at 3:00 AM UTC (after sync)
**Function:** `runDataQualityChecks`
**Process:**
1. Validate row counts between systems
2. Check for NULL values in required fields
3. Verify sum totals match
4. Alert on discrepancies > 1%

## Error Handling

All endpoints implement standard error responses:
```json
{
  "error": {
    "code": "SYNC_IN_PROGRESS",
    "message": "A sync operation is already in progress",
    "details": {
      "currentSyncId": "sync_12345",
      "startedAt": "2025-08-28T02:00:00Z"
    }
  }
}
```

## Authentication

All sync-related endpoints require service role authentication:
- Header: `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
- Only internal services should access these endpoints