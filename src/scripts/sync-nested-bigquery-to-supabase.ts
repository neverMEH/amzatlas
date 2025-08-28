#!/usr/bin/env node

import { config } from 'dotenv';
import { NestedBigQueryToSupabaseSync } from '../lib/supabase/sync/nested-bigquery-to-supabase';
import { getBigQueryConfig, getTableNames } from '../config/bigquery.config';

// Load environment variables
config();

async function main() {
  console.log('Starting nested BigQuery to Supabase sync...');

  // Get configuration
  const bigqueryConfig = getBigQueryConfig();
  const tables = getTableNames();

  // Initialize sync
  const sync = new NestedBigQueryToSupabaseSync({
    projectId: bigqueryConfig.projectId,
    dataset: bigqueryConfig.dataset,
    table: tables.sqpRaw, // seller-search_query_performance
    batchSize: 1000,
  });

  // Parse command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const startDateArg = args.find(arg => arg.startsWith('--start-date='));
  const endDateArg = args.find(arg => arg.startsWith('--end-date='));
  const asinsArg = args.find(arg => arg.startsWith('--asins='));
  const periodArg = args.find(arg => arg.startsWith('--period='));

  // Default to last week if no dates provided
  const endDate = endDateArg 
    ? new Date(endDateArg.split('=')[1])
    : new Date();
    
  const startDate = startDateArg
    ? new Date(startDateArg.split('=')[1])
    : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

  const asins = asinsArg 
    ? asinsArg.split('=')[1].split(',')
    : undefined;

  const reportingPeriod = periodArg
    ? periodArg.split('=')[1] as 'WEEK' | 'MONTH' | 'QUARTER'
    : 'WEEK';

  console.log('Sync parameters:', {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    asins: asins || 'All ASINs',
    reportingPeriod,
    dryRun,
  });

  try {
    const result = await sync.syncDateRange(startDate, endDate, {
      asins,
      reportingPeriod,
      dryRun,
    });

    console.log('Sync completed:', {
      success: result.success,
      recordsProcessed: result.recordsProcessed,
      syncLogId: result.syncLogId,
      errors: result.errors.length,
    });

    if (result.errors.length > 0) {
      console.error('Errors encountered:');
      result.errors.forEach((error, index) => {
        console.error(`${index + 1}.`, error);
      });
    }

    // Get sync status
    if (result.syncLogId) {
      const status = await sync.getSyncStatus(result.syncLogId);
      if (status) {
        console.log('\nSync summary:', {
          duration: status.completed_at 
            ? `${(new Date(status.completed_at).getTime() - new Date(status.started_at!).getTime()) / 1000}s`
            : 'In progress',
          recordsInserted: status.records_inserted,
          recordsFailed: status.records_failed,
          status: status.sync_status,
        });
      }
    }

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('Fatal error during sync:', error);
    process.exit(1);
  }
}

// Show usage
if (process.argv.includes('--help')) {
  console.log(`
Usage: npm run sync:nested-bigquery [options]

Options:
  --start-date=YYYY-MM-DD   Start date for sync (default: 7 days ago)
  --end-date=YYYY-MM-DD     End date for sync (default: today)
  --asins=ASIN1,ASIN2       Comma-separated list of ASINs to sync (default: all)
  --period=WEEK|MONTH|QUARTER  Reporting period (default: WEEK)
  --dry-run                 Show what would be synced without making changes
  --help                    Show this help message

Examples:
  npm run sync:nested-bigquery --start-date=2024-01-01 --end-date=2024-01-07
  npm run sync:nested-bigquery --asins=B08N5WRWNW,B07X5F81L8 --period=WEEK
  npm run sync:nested-bigquery --dry-run
  `);
  process.exit(0);
}

// Run main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});