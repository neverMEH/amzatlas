# Deployment Guide for Daily BigQuery Refresh

This guide details the deployment process for the automated refresh system described in @.agent-os/specs/2025-09-05-daily-bigquery-refresh/spec.md

> Created: 2025-09-05
> Version: 1.0.0

## Prerequisites

- Supabase CLI installed (`npm install -g supabase`)
- Access to Supabase project dashboard
- BigQuery service account credentials
- Database migrations applied

## Step 1: Apply Database Migrations

Create and run the migration file for the refresh infrastructure:

```bash
# Create migration file
supabase migration new add_refresh_infrastructure

# Copy the schema from database-schema.md to the migration file
# Located at: supabase/migrations/[timestamp]_add_refresh_infrastructure.sql

# Apply migration locally
supabase db reset

# Push to production
supabase db push
```

## Step 2: Configure Environment Variables

In your Supabase project dashboard, navigate to Settings > Edge Functions and add:

```env
# BigQuery Configuration
BIGQUERY_PROJECT_ID=your-project-id
BIGQUERY_DATASET=dataclient_amzatlas_agency_85
GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'

# Refresh Configuration
REFRESH_BATCH_SIZE=5000
REFRESH_TIMEOUT_WARNING_MS=240000  # 4 minutes
```

## Step 3: Deploy Edge Functions

### Deploy the Orchestrator Function

```bash
# Create the orchestrator function
supabase functions new daily-refresh-orchestrator

# Copy the code from edge-function-examples.md
# to supabase/functions/daily-refresh-orchestrator/index.ts

# Deploy with schedule
supabase functions deploy daily-refresh-orchestrator --schedule "0 2 * * *"
```

### Deploy Worker Functions

```bash
# Create and deploy each worker function
supabase functions new refresh-asin-performance
supabase functions deploy refresh-asin-performance

supabase functions new refresh-search-queries
supabase functions deploy refresh-search-queries

supabase functions new refresh-summary-tables
supabase functions deploy refresh-summary-tables
```

### Deploy Shared Utilities

```bash
# Create shared directory
mkdir -p supabase/functions/_shared

# Add shared utilities (error-handler.ts, cron-config.ts, etc.)
# These will be automatically included in function deployments
```

## Step 4: Configure Function Permissions

In the Supabase dashboard:

1. Navigate to Authentication > Policies
2. Ensure service role has access to:
   - `sqp.refresh_config`
   - `sqp.refresh_audit_log`
   - `sqp.refresh_checkpoints`
   - `sqp.refresh_data_quality`
   - All data tables in `sqp` schema

## Step 5: Initialize Refresh Configuration

Run this SQL to populate initial refresh configurations:

```sql
-- Set up refresh configuration for all tables
INSERT INTO sqp.refresh_config (
    table_schema, 
    table_name, 
    priority, 
    next_refresh_at
) VALUES 
    ('sqp', 'asin_performance_data', 100, NOW() + INTERVAL '1 hour'),
    ('sqp', 'search_query_performance', 95, NOW() + INTERVAL '1 hour'),
    ('sqp', 'search_performance_summary', 90, NOW() + INTERVAL '2 hours'),
    ('sqp', 'daily_sqp_data', 85, NOW() + INTERVAL '2 hours'),
    ('sqp', 'weekly_summary', 80, NOW() + INTERVAL '3 hours'),
    ('sqp', 'monthly_summary', 75, NOW() + INTERVAL '3 hours'),
    ('sqp', 'quarterly_summary', 70, NOW() + INTERVAL '4 hours'),
    ('sqp', 'yearly_summary', 65, NOW() + INTERVAL '4 hours')
ON CONFLICT (table_schema, table_name) 
DO UPDATE SET 
    priority = EXCLUDED.priority,
    next_refresh_at = EXCLUDED.next_refresh_at;

-- Set up dependencies
WITH config_ids AS (
    SELECT 
        id,
        table_name
    FROM sqp.refresh_config
    WHERE table_schema = 'sqp'
)
INSERT INTO sqp.refresh_dependencies (parent_config_id, dependent_config_id)
SELECT 
    p.id,
    d.id
FROM config_ids p
JOIN config_ids d ON 
    (p.table_name = 'asin_performance_data' AND d.table_name LIKE '%summary%')
    OR (p.table_name = 'search_query_performance' AND d.table_name = 'search_performance_summary')
ON CONFLICT DO NOTHING;
```

## Step 6: Test the Deployment

### Manual Function Test

```bash
# Test the orchestrator
supabase functions invoke daily-refresh-orchestrator

# Check logs
supabase functions logs daily-refresh-orchestrator

# Test individual workers
supabase functions invoke refresh-asin-performance \
  --body '{"config": {"table_name": "asin_performance_data", "table_schema": "sqp"}}'
```

### Verify Audit Logs

```sql
-- Check recent refresh attempts
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

-- Check active checkpoints
SELECT * FROM sqp.refresh_checkpoints WHERE status = 'active';
```

## Step 7: Set Up Monitoring

### Create Monitoring Dashboard

In Supabase SQL Editor, create views for monitoring:

```sql
-- Refresh success rate view
CREATE OR REPLACE VIEW sqp.refresh_success_rate AS
SELECT 
    table_name,
    COUNT(*) FILTER (WHERE status = 'success') * 100.0 / COUNT(*) as success_rate,
    AVG(execution_time_ms) as avg_execution_time_ms,
    MAX(refresh_completed_at) as last_successful_refresh
FROM sqp.refresh_audit_log
WHERE refresh_started_at > NOW() - INTERVAL '7 days'
GROUP BY table_name;

-- Data quality overview
CREATE OR REPLACE VIEW sqp.data_quality_overview AS
SELECT 
    dq.metric_name,
    COUNT(*) FILTER (WHERE is_within_threshold) * 100.0 / COUNT(*) as pass_rate,
    COUNT(*) as total_checks
FROM sqp.refresh_data_quality dq
JOIN sqp.refresh_audit_log al ON dq.audit_log_id = al.id
WHERE al.refresh_started_at > NOW() - INTERVAL '7 days'
GROUP BY dq.metric_name;
```

### Configure Alerts

Set up webhook notifications in your monitoring service:

```typescript
// Example webhook endpoint for failures
app.post('/webhooks/refresh-failure', async (req, res) => {
    const { table_name, error_message, audit_log_id } = req.body
    
    // Send notification (Slack, email, etc.)
    await notificationService.send({
        type: 'refresh_failure',
        message: `Refresh failed for ${table_name}: ${error_message}`,
        severity: 'high',
        details: { audit_log_id }
    })
    
    res.status(200).json({ received: true })
})
```

## Step 8: Enable Automatic Scheduling

Once testing is complete, the cron schedule will automatically activate. The orchestrator will run daily at 2 AM UTC.

To modify the schedule:

```bash
# Update schedule
supabase functions deploy daily-refresh-orchestrator --schedule "0 3 * * *"  # 3 AM UTC
```

## Rollback Procedure

If issues arise:

1. **Disable Functions**:
   ```sql
   UPDATE sqp.refresh_config SET is_enabled = false;
   ```

2. **Stop Active Refreshes**:
   ```sql
   UPDATE sqp.refresh_checkpoints 
   SET status = 'expired' 
   WHERE status = 'active';
   ```

3. **Revert Edge Functions**:
   ```bash
   supabase functions delete daily-refresh-orchestrator
   supabase functions delete refresh-asin-performance
   supabase functions delete refresh-search-queries
   supabase functions delete refresh-summary-tables
   ```

## Maintenance

### Regular Tasks

1. **Monitor Checkpoint Table**: Clean up old checkpoints weekly
2. **Review Audit Logs**: Archive logs older than 90 days
3. **Update Priorities**: Adjust table refresh priorities based on usage
4. **Performance Tuning**: Adjust batch sizes based on execution times

### Troubleshooting

Common issues and solutions:

1. **Function Timeout**:
   - Reduce batch size in configuration
   - Check for inefficient queries
   - Review checkpoint resumption logic

2. **BigQuery Rate Limits**:
   - Implement exponential backoff
   - Reduce concurrent executions
   - Cache frequently accessed data

3. **Data Quality Failures**:
   - Review threshold configurations
   - Check for BigQuery schema changes
   - Validate transformation logic

## Success Criteria

The deployment is successful when:

- [ ] All functions deployed without errors
- [ ] Orchestrator runs on schedule
- [ ] Audit logs show successful refreshes
- [ ] Data quality checks pass
- [ ] Monitoring dashboard displays metrics
- [ ] No manual intervention required for 7 consecutive days