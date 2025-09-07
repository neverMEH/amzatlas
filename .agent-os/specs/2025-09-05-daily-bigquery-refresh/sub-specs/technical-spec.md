# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-05-daily-bigquery-refresh/spec.md

> Created: 2025-09-05
> Version: 1.0.0

## Technical Requirements

### Scheduling Infrastructure
- **Supabase Edge Functions**: Leverage Supabase's native scheduled functions for clean, integrated execution
- **Execution Time**: Daily at 2:00 AM UTC to avoid peak usage hours
- **Function Architecture**: Orchestrator pattern - main function triggers individual table refresh functions
- **Timezone Handling**: UTC-based scheduling with proper date boundary handling for weekly data
- **Retry Logic**: Built-in edge function retry with exponential backoff (3 attempts max)

### Data Synchronization Engine  
- **Incremental Sync Strategy**: Query BigQuery for data modified since last successful sync timestamp
- **Batch Processing**: Process data in configurable batch sizes (default 5000 rows) to handle large datasets
- **Upsert Operations**: Use ON CONFLICT clauses for efficient insert/update operations
- **Transaction Management**: Wrap sync operations in database transactions for atomicity
- **Function Timeout Handling**: Design for 5-minute edge function execution limit with checkpoint resumption

### Table Registry System
- **Configuration Table**: Create `sqp.refresh_config` table to store refresh metadata
- **Table Metadata**: Track table name, schema, last refresh timestamp, refresh frequency, and custom sync parameters
- **Dynamic Discovery**: Automatically detect new tables in sqp schema and add to registry
- **Refresh Dependencies**: Define and respect table dependencies for ordered refresh execution

### Monitoring and Observability
- **Audit Log Table**: Create `sqp.refresh_audit_log` with detailed execution metrics
- **Performance Metrics**: Track sync duration, row counts, memory usage, and query performance
- **Error Handling**: Comprehensive error catching with detailed stack traces and context
- **Alerting Integration**: Webhook notifications for failures via Railway environment variables
- **Health Check Endpoint**: API endpoint to monitor refresh system status

### Data Integrity Validation
- **Row Count Verification**: Compare source and destination row counts post-sync
- **Checksum Validation**: Calculate and compare data checksums for critical fields
- **Schema Drift Detection**: Alert on BigQuery schema changes that may affect sync
- **Referential Integrity**: Validate foreign key relationships remain intact post-refresh

### View and Materialized View Management
- **Dependency Tracking**: Map view dependencies to ensure correct refresh order
- **Materialized View Refresh**: Trigger REFRESH MATERIALIZED VIEW after base table updates
- **View Validation**: Test critical views post-refresh to ensure they remain queryable
- **Performance Optimization**: Disable/enable indexes during bulk operations when beneficial

### Supabase Edge Function Architecture
- **Orchestrator Function**: `daily-refresh-orchestrator` - Scheduled to run daily at 2 AM UTC
  - Queries tables due for refresh from `sqp.refresh_config`
  - Invokes individual table refresh functions asynchronously
  - Monitors progress and handles coordination
- **Table Refresh Functions**: Individual functions per table type
  - `refresh-asin-performance` - Handles ASIN performance data sync
  - `refresh-search-queries` - Handles search query performance sync
  - `refresh-summary-tables` - Handles summary table refreshes
- **Checkpoint System**: State persistence between function invocations
  - Store progress in `sqp.refresh_checkpoints` table
  - Resume from last checkpoint if timeout occurs
  - Clean up completed checkpoints after successful run
- **Function Limits Handling**:
  - 5-minute execution limit per function
  - 50MB payload limit - use streaming for large datasets
  - Design for idempotent operations to handle retries safely

## Approach

The implementation will follow a modular approach with clear separation of concerns:

1. **Scheduler Module**: Handles cron job execution and retry logic
2. **Sync Engine**: Core synchronization logic with BigQuery integration
3. **Registry Manager**: Manages table metadata and refresh configuration
4. **Monitor**: Audit logging, metrics collection, and health checks
5. **Validator**: Data integrity and schema validation utilities

## External Dependencies

**Supabase Functions SDK** - Native edge function support (already included with Supabase)
- **Built-in Features**: Scheduled execution, automatic retries, integrated logging
- **Justification:** Native Supabase integration provides the cleanest architecture

**@google-cloud/bigquery** - Already in use, optimized for edge function constraints
- **Enhancement**: Implement lightweight connection handling for edge function environment
- **Justification:** Edge functions require efficient resource usage within execution limits

**Edge Function Monitoring** - Leverage Supabase's built-in function logs
- **Integration**: Direct access through Supabase dashboard
- **Justification:** Native monitoring eliminates need for external logging libraries