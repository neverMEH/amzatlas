#!/usr/bin/env tsx

import { config } from 'dotenv';
config();

import { NestedBigQueryToSupabaseSync } from '../lib/supabase/sync/nested-bigquery-to-supabase';
import { getBigQueryConfig, getTableNames } from '../config/bigquery.config';

async function syncSingleDay() {
  console.log('=== Syncing Single Day with Product Data ===\n');
  
  try {
    const bigqueryConfig = getBigQueryConfig();
    const tables = getTableNames();
    
    const sync = new NestedBigQueryToSupabaseSync({
      projectId: bigqueryConfig.projectId,
      dataset: bigqueryConfig.dataset,
      table: tables.sqpRaw,
      batchSize: 50,
    });
    
    // Sync data for August 3, 2025 (we know this date has product data)
    const syncDate = new Date('2025-08-03');
    
    console.log(`Syncing data for: ${syncDate.toISOString().split('T')[0]}`);
    console.log('This will include Product Name and Client Name fields...\n');
    
    // First, disable the sync logger to avoid schema issues
    const originalStartSync = sync['logger'].startSync;
    sync['logger'].startSync = async () => 1; // Mock sync log ID
    sync['logger'].completeSync = async () => {};
    sync['logger'].failSync = async () => {};
    sync['logger'].logDataQualityCheck = async () => {};
    
    const result = await sync.syncDateRange(syncDate, syncDate, {
      dryRun: false,
      asins: ['B0BTTXVQRQ'] // Work Sharp Professional Precision Adjust Knife Sharpener
    });
    
    console.log('\nSync Result:', {
      success: result.success,
      recordsProcessed: result.recordsProcessed,
      errors: result.errors
    });
    
    if (result.success) {
      console.log('\n✓ Sync completed successfully!');
      console.log('\nNext: Run brand extraction script to extract brands from product titles');
    }
    
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

syncSingleDay().catch(console.error);