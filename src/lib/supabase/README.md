# Supabase Setup Guide

This guide explains how to set up Supabase for the SQP Intelligence project.

## Prerequisites

1. A Supabase account and project
2. Supabase CLI (optional but recommended)
3. Environment variables configured

## Environment Variables

Create a `.env` file with the following variables:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

You can find these in your Supabase project settings under "API".

## Running Migrations

### Option 1: Using Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run each migration file in order:
   - First: `000_setup_admin_functions.sql`
   - Then: `001_create_sqp_tables.sql`
   - Finally: `002_create_sqp_views.sql`

### Option 2: Using Supabase CLI (Recommended)

1. Install Supabase CLI:
   ```bash
   brew install supabase/tap/supabase
   ```

2. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. Run migrations:
   ```bash
   supabase db push
   ```

   Or run individual files:
   ```bash
   supabase db execute -f src/lib/supabase/migrations/000_setup_admin_functions.sql
   supabase db execute -f src/lib/supabase/migrations/001_create_sqp_tables.sql
   supabase db execute -f src/lib/supabase/migrations/002_create_sqp_views.sql
   ```

### Option 3: Using Migration Runner Script

1. First, apply the admin functions migration manually (via dashboard or CLI)
2. Then run:
   ```bash
   npx tsx src/lib/supabase/scripts/run-migrations.ts
   ```

## Testing the Connection

After setup, test the connection:

```typescript
import { SupabaseService } from '@/lib/supabase/client';

const service = new SupabaseService();
const isConnected = await service.testConnection();
console.log('Connected:', isConnected);
```

## Data Flow

1. **BigQuery → Supabase Sync**: Use the `BigQueryToSupabaseSync` class to sync aggregated data
2. **Supabase Tables**: Store weekly, monthly, quarterly, and yearly summaries
3. **Materialized Views**: Provide fast access to trends, market share, and performance metrics

## Table Structure

### Main Tables
- `sqp.weekly_summary` - Weekly aggregated metrics
- `sqp.monthly_summary` - Monthly aggregated metrics  
- `sqp.quarterly_summary` - Quarterly aggregated metrics
- `sqp.yearly_summary` - Yearly aggregated metrics
- `sqp.period_comparisons` - Period-over-period comparisons

### Materialized Views
- `sqp.weekly_trends` - Week-over-week trend analysis
- `sqp.monthly_trends` - Month-over-month trends
- `sqp.top_keywords_by_period` - Top performing keywords
- `sqp.market_share` - Market share by keyword and ASIN
- `sqp.year_over_year` - YoY comparisons
- `sqp.performance_scores` - Performance scoring and tiers

## Usage Example

```typescript
// Initialize the service
const supabase = new SupabaseService();

// Get weekly summaries
const { data, error } = await supabase.getWeeklySummaries({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  query: 'running shoes',
});

// Get market share
const marketShare = await supabase.getMarketShare(
  '2024-01-01',
  'running shoes'
);

// Refresh materialized views
await supabase.refreshMaterializedViews();
```

## Troubleshooting

1. **Connection Issues**: Check that all environment variables are set correctly
2. **Permission Errors**: Ensure you're using the service role key for admin operations
3. **Migration Failures**: Run migrations in order, starting with `000_setup_admin_functions.sql`