# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-05-daily-bigquery-refresh/spec.md

> Created: 2025-09-05
> Version: 1.0.0

## Endpoints

### GET /api/refresh/status

**Purpose:** Get current refresh system status and health metrics
**Parameters:** 
- `hours` (optional): Number of hours to look back for recent refreshes (default: 24)

**Response:**
```json
{
  "status": "healthy" | "degraded" | "failing",
  "summary": {
    "tables_configured": 15,
    "tables_enabled": 14,
    "last_refresh_cycle": "2025-09-05T02:00:00Z",
    "next_refresh_cycle": "2025-09-06T02:00:00Z",
    "recent_failures": 0,
    "average_refresh_time_ms": 4523
  },
  "recent_refreshes": [
    {
      "table_name": "asin_performance_data",
      "status": "success",
      "started_at": "2025-09-05T02:00:00Z",
      "completed_at": "2025-09-05T02:01:15Z",
      "rows_processed": 15420,
      "execution_time_ms": 75000
    }
  ]
}
```
**Errors:** 
- 500: Database connection error

### POST /api/refresh/trigger

**Purpose:** Manually trigger refresh for specific tables
**Parameters:**
```json
{
  "tables": ["asin_performance_data", "search_query_performance"],
  "force": false  // Skip schedule and run immediately
}
```

**Response:**
```json
{
  "job_id": "refresh_2025-09-05_12-34-56",
  "tables_queued": 2,
  "estimated_completion_time": "2025-09-05T12:45:00Z",
  "message": "Refresh job queued successfully"
}
```
**Errors:**
- 400: Invalid table names
- 403: Refresh already in progress
- 500: Failed to queue refresh job

### GET /api/refresh/history/:table_name

**Purpose:** Get refresh history for a specific table
**Parameters:**
- `limit` (optional): Number of records to return (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "table_name": "asin_performance_data",
  "refresh_config": {
    "is_enabled": true,
    "frequency_hours": 24,
    "priority": 90,
    "last_refresh_at": "2025-09-05T02:00:00Z"
  },
  "history": [
    {
      "id": 123,
      "started_at": "2025-09-05T02:00:00Z",
      "completed_at": "2025-09-05T02:01:15Z",
      "status": "success",
      "rows_processed": 15420,
      "execution_time_ms": 75000
    }
  ],
  "total_count": 365
}
```
**Errors:**
- 404: Table not found in refresh configuration
- 500: Database query error

### PUT /api/refresh/config/:table_name

**Purpose:** Update refresh configuration for a table
**Parameters:**
```json
{
  "is_enabled": true,
  "refresh_frequency_hours": 12,
  "priority": 95,
  "custom_sync_params": {
    "batch_size": 10000,
    "date_range_days": 7
  }
}
```

**Response:**
```json
{
  "table_name": "asin_performance_data",
  "updated_config": {
    "is_enabled": true,
    "refresh_frequency_hours": 12,
    "priority": 95,
    "next_refresh_at": "2025-09-05T14:00:00Z"
  },
  "message": "Configuration updated successfully"
}
```
**Errors:**
- 400: Invalid configuration parameters
- 404: Table not found
- 500: Failed to update configuration

### GET /api/refresh/metrics

**Purpose:** Get detailed performance metrics and data quality indicators
**Parameters:**
- `start_date` (optional): Start date for metrics (default: 7 days ago)
- `end_date` (optional): End date for metrics (default: now)

**Response:**
```json
{
  "performance": {
    "total_refreshes": 245,
    "successful_refreshes": 243,
    "failed_refreshes": 2,
    "average_duration_ms": 45230,
    "total_rows_processed": 3456789
  },
  "data_quality": {
    "tables_monitored": 8,
    "quality_checks_passed": 1920,
    "quality_checks_failed": 5,
    "common_issues": [
      {
        "issue": "row_count_mismatch",
        "occurrences": 3,
        "affected_tables": ["weekly_summary"]
      }
    ]
  },
  "system_health": {
    "memory_usage_avg_mb": 256.5,
    "cpu_usage_avg_percent": 15.2,
    "bigquery_api_calls": 1245,
    "error_rate_percent": 0.8
  }
}
```
**Errors:**
- 400: Invalid date range
- 500: Metrics calculation error

### POST /api/refresh/webhook

**Purpose:** Register webhook for refresh event notifications
**Parameters:**
```json
{
  "url": "https://example.com/webhook/refresh",
  "events": ["refresh_failed", "refresh_completed", "quality_check_failed"],
  "secret": "webhook_secret_key"
}
```

**Response:**
```json
{
  "webhook_id": "wh_123456",
  "url": "https://example.com/webhook/refresh",
  "events": ["refresh_failed", "refresh_completed", "quality_check_failed"],
  "created_at": "2025-09-05T10:00:00Z",
  "status": "active"
}
```
**Errors:**
- 400: Invalid webhook URL or events
- 409: Webhook already registered
- 500: Failed to register webhook

## Internal Functions

### RefreshController.executeRefresh()
**Purpose:** Core refresh execution logic
**Business Logic:**
1. Query refresh configuration for tables due for refresh
2. Sort tables by priority and dependency order
3. Execute refresh for each table in sequence
4. Update audit logs and metrics
5. Trigger dependent refreshes
6. Send notifications on completion/failure

### RefreshController.validateDataQuality()
**Purpose:** Post-refresh data quality validation
**Business Logic:**
1. Compare source vs destination row counts
2. Validate key metrics within expected thresholds
3. Check for null/invalid values in critical columns
4. Verify referential integrity
5. Log quality metrics to database

### RefreshController.handleRefreshError()
**Purpose:** Centralized error handling and recovery
**Business Logic:**
1. Log detailed error information
2. Determine if retry is appropriate
3. Send alert notifications
4. Update table status to prevent cascading failures
5. Implement exponential backoff for retries

## Integration Points

### Supabase Edge Function Integration
- **Scheduler**: Native Supabase cron expression `0 2 * * *` (2 AM UTC daily)
- **Function Names**: 
  - `daily-refresh-orchestrator` (main scheduler)
  - `refresh-asin-performance`, `refresh-search-queries`, `refresh-summary-tables` (workers)
- **Invocation**: Direct function-to-function calls within Supabase
- **Monitoring**: Built-in function logs accessible via Supabase dashboard

### BigQuery Integration
- Lightweight client initialization for edge function environment
- Connection reuse within function execution context
- Implement streaming for large result sets
- Track BigQuery job IDs in audit logs

### Supabase Integration  
- Direct database access from edge functions (no auth required)
- Use RPC functions for complex operations
- Leverage connection pooling within edge runtime
- Transaction support for atomic operations

### Monitoring Integration
- **Function Logs**: Automatic capture in Supabase dashboard
- **Metrics Storage**: Write to `sqp.refresh_metrics` table
- **Alerts**: Webhook notifications via edge function HTTP calls
- **Dashboard**: Create Supabase dashboard views for refresh monitoring