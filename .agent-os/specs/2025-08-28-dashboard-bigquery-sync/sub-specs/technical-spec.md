# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-28-dashboard-bigquery-sync/spec.md

## Technical Requirements

### Data Pipeline Architecture
- **Scheduled Function**: Implement using Railway cron jobs or Supabase Edge Functions with daily execution at 2 AM UTC
- **BigQuery Client**: Use existing @google-cloud/bigquery client with service account authentication
- **Supabase Client**: Utilize service role key for admin access to bypass RLS
- **Error Handling**: Implement retry logic with exponential backoff for transient failures
- **Batch Processing**: Process data in chunks of 1000 records to avoid memory issues

### Data Transformation Requirements
- **Date Handling**: Convert BigQuery DATE types to PostgreSQL DATE format (YYYY-MM-DD)
- **Decimal Precision**: Maintain 6 decimal places for CTR, CVR, and share calculations
- **ASIN Validation**: Ensure all ASINs match 10-character alphanumeric pattern
- **Query Normalization**: Lowercase and trim search queries for consistency
- **NULL Handling**: Convert BigQuery NULLs to appropriate defaults (0 for metrics, empty string for text)

### Incremental Update Strategy
- **Period Detection**: Query max(period_end) from sqp.weekly_summary to find last synced week
- **New Data Check**: Compare against BigQuery's latest available week
- **Duplicate Prevention**: Use ON CONFLICT (period_start, query, asin) DO UPDATE
- **Audit Trail**: Maintain sync_log table with timestamp, records processed, and status

### Performance Optimization
- **Materialized View Refresh**: Trigger REFRESH MATERIALIZED VIEW CONCURRENTLY after sync
- **Index Strategy**: Ensure indexes on (period_start, query), (asin), and (created_at)
- **Connection Pooling**: Reuse database connections across batch operations
- **Query Optimization**: Use prepared statements and parameterized queries

### Monitoring Integration
- **Health Check Endpoint**: GET /api/monitoring/sync-status returning last run details
- **Metrics Collection**: Track sync duration, record count, error rate in monitoring table
- **Alert Thresholds**: Notify if sync fails 2 consecutive times or takes >15 minutes
- **Data Quality Checks**: Validate row counts match between source and destination

### Dashboard Implementation Requirements
- **Report Components**: Create 13 new report components using Next.js App Router
- **Data Fetching**: Use React Server Components for initial data load
- **State Management**: Implement Zustand for client-side filtering and interactions
- **Chart Library**: Leverage existing Recharts setup for all visualizations
- **Export Functionality**: Generate CSV/PDF exports using react-to-pdf and papaparse
- **Caching Strategy**: Implement SWR for client-side caching with 5-minute revalidation
- **Loading States**: Use Suspense boundaries with skeleton loaders
- **Error Boundaries**: Implement error boundaries for each report component

### Report Query Patterns
- **Aggregation Queries**: Use Supabase RPC functions for complex calculations
- **Time Series Data**: Implement sliding window queries for trend analysis
- **Percentile Calculations**: Use PostgreSQL window functions for ranking
- **Correlation Analysis**: Implement Pearson correlation in SQL functions
- **Anomaly Detection**: Z-score calculations using stddev window functions

## External Dependencies

**@google-cloud/bigquery** - Required for BigQuery data extraction
**Justification:** Official Google Cloud client library needed to query SQP data from BigQuery data warehouse

**node-cron** - Cron job scheduling for Railway deployment
**Justification:** Lightweight scheduler for triggering daily sync process when not using Supabase Edge Functions

**p-retry** - Retry failed operations with exponential backoff
**Justification:** Production-grade retry logic for handling transient network and API failures