#!/usr/bin/env node

import { config } from 'dotenv';
import { NestedBigQueryToSupabaseSync } from '../lib/supabase/sync/nested-bigquery-to-supabase';
import { getBigQueryConfig, getTableNames } from '../config/bigquery.config';

// Load environment variables
config();

async function syncWeek(startDate: Date, endDate: Date, sync: NestedBigQueryToSupabaseSync) {
  console.log(`\nSyncing week: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
  
  try {
    const result = await sync.syncDateRange(startDate, endDate, {
      reportingPeriod: 'WEEK',
      dryRun: false
    });

    console.log(`Week sync completed:`, {
      success: result.success,
      recordsProcessed: result.recordsProcessed,
      errors: result.errors.length
    });
    
    return result;
  } catch (error) {
    console.error(`Failed to sync week:`, error);
    return { success: false, recordsProcessed: 0, errors: [error] };
  }
}

async function main() {
  console.log('Starting full data sync...');

  // Get configuration
  const bigqueryConfig = getBigQueryConfig();
  const tables = getTableNames();

  // Initialize sync
  const sync = new NestedBigQueryToSupabaseSync({
    projectId: bigqueryConfig.projectId,
    dataset: bigqueryConfig.dataset,
    table: tables.sqpRaw,
    batchSize: 500, // Smaller batch size for reliability
  });

  // Define date range
  const startDate = new Date('2024-08-18');
  const endDate = new Date('2025-08-10');
  
  let totalRecords = 0;
  let totalErrors = 0;
  let successfulWeeks = 0;
  let failedWeeks = 0;

  // Sync week by week
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const weekStart = new Date(currentDate);
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(weekEnd.getDate() + 6); // Add 6 days to get a full week
    
    // Don't go past the end date
    if (weekEnd > endDate) {
      weekEnd.setTime(endDate.getTime());
    }

    const result = await syncWeek(weekStart, weekEnd, sync);
    
    if (result.success) {
      successfulWeeks++;
    } else {
      failedWeeks++;
    }
    
    totalRecords += result.recordsProcessed;
    totalErrors += result.errors.length;

    // Move to next week
    currentDate.setDate(currentDate.getDate() + 7);
    
    // Small delay between weeks to avoid overloading
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n=== FULL SYNC COMPLETE ===');
  console.log(`Total records processed: ${totalRecords}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Successful weeks: ${successfulWeeks}`);
  console.log(`Failed weeks: ${failedWeeks}`);

  // Query final stats
  try {
    const { getSupabaseClient } = await import('../config/supabase.config');
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('asin_performance_data')
      .select('id', { count: 'exact', head: true });
      
    if (!error && data) {
      console.log(`\nTotal ASINs in database: ${data}`);
    }

    const { data: queryData, error: queryError } = await supabase
      .from('search_query_performance')
      .select('id', { count: 'exact', head: true });
      
    if (!queryError && queryData) {
      console.log(`Total search queries in database: ${queryData}`);
    }
  } catch (err) {
    console.error('Failed to get final stats:', err);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});