# Supabase Migrations

This directory contains SQL migrations for the Supabase database schema.

## Migration Files

- `001_create_sqp_tables.sql` - Creates base SQP schema and tables
- `002_create_sqp_views.sql` - Creates views for data access
- `003_create_public_views.sql` - Creates public views
- `004_fix_permissions.sql` - Sets up proper permissions
- `005_fix_trigger_permissions.sql` - Fixes trigger permissions
- `006_add_update_triggers.sql` - Adds update timestamp triggers
- `007_add_sync_tracking.sql` - Adds sync tracking tables and functions for BigQuery sync

## Running Migrations

### Option 1: Using Supabase CLI (Recommended)

```bash
# Run all migrations
supabase db push

# Or run a specific migration
supabase db push --file src/lib/supabase/migrations/007_add_sync_tracking.sql
```

### Option 2: Using the migration script

```bash
# Check migration status
npm run migrate:status

# Run all pending migrations
npm run migrate:up

# Run a specific migration
npm run migrate:run 007_add_sync_tracking
```

Note: The migration script requires either:
- An `exec_sql` RPC function in your Supabase database, or
- Direct SQL access via Supabase dashboard

### Option 3: Via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the migration SQL
4. Run the query

## Migration 007: Sync Tracking

The latest migration adds support for BigQuery to Supabase data synchronization:

### New Tables:
- `sqp.sync_log` - Tracks all sync operations
- `sqp.data_quality_checks` - Records data quality validation results

### New Columns on `sqp.weekly_summary`:
- `bigquery_sync_id` - BigQuery job ID for tracking
- `sync_log_id` - Reference to sync operation
- `last_synced_at` - Timestamp of last sync

### New Functions:
- `sqp.get_latest_sync_status()` - Returns latest sync status
- `sqp.check_data_freshness()` - Checks if data is stale
- `sqp.update_aggregate_summaries()` - Trigger function for monthly aggregation

### New Trigger:
- `update_summaries_on_weekly_insert` - Auto-updates monthly summaries

## Testing Migrations

Run the migration tests:

```bash
# Run migration tests (requires TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_KEY)
npm test src/lib/supabase/migrations/__tests__/

# Run database integration tests
npm test src/lib/supabase/sync/__tests__/database-integration.test.ts
```

## Rollback

To rollback migration 007:

```sql
-- Drop trigger
DROP TRIGGER IF EXISTS update_summaries_on_weekly_insert ON sqp.weekly_summary;

-- Drop functions
DROP FUNCTION IF EXISTS sqp.update_aggregate_summaries() CASCADE;
DROP FUNCTION IF EXISTS sqp.check_data_freshness() CASCADE;
DROP FUNCTION IF EXISTS sqp.get_latest_sync_status(VARCHAR) CASCADE;

-- Drop columns from weekly_summary
ALTER TABLE sqp.weekly_summary 
  DROP COLUMN IF EXISTS bigquery_sync_id,
  DROP COLUMN IF EXISTS sync_log_id,
  DROP COLUMN IF EXISTS last_synced_at;

-- Drop tables
DROP TABLE IF EXISTS sqp.data_quality_checks CASCADE;
DROP TABLE IF EXISTS sqp.sync_log CASCADE;
```