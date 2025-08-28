#!/usr/bin/env tsx

import { DailySyncScheduler } from '@/lib/supabase/sync/daily-sync-scheduler';
import { config as dotenvConfig } from 'dotenv';
import { Command } from 'commander';

// Load environment variables
dotenvConfig();

const program = new Command();

program
  .name('sync-bigquery-to-supabase')
  .description('Sync SQP data from BigQuery to Supabase')
  .version('1.0.0');

program
  .command('run')
  .description('Run a manual sync')
  .option('-f, --force', 'Force sync even if data is current')
  .option('-d, --dry-run', 'Perform a dry run without writing data')
  .option('--start-date <date>', 'Start date for sync (YYYY-MM-DD)')
  .option('--end-date <date>', 'End date for sync (YYYY-MM-DD)')
  .action(async (options) => {
    console.log('🚀 Starting BigQuery to Supabase sync...\n');
    
    try {
      // Validate environment
      const requiredEnvVars = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'BIGQUERY_PROJECT_ID',
        'BIGQUERY_DATASET',
        'GOOGLE_APPLICATION_CREDENTIALS_JSON',
      ];
      
      const missingVars = requiredEnvVars.filter(v => !process.env[v]);
      if (missingVars.length > 0) {
        console.error('❌ Missing required environment variables:', missingVars);
        process.exit(1);
      }
      
      // Initialize scheduler
      const scheduler = new DailySyncScheduler({
        schedule: '0 2 * * *', // Not used for manual run
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        bigQueryProjectId: process.env.BIGQUERY_PROJECT_ID!,
        bigQueryDataset: process.env.BIGQUERY_DATASET!,
        retryAttempts: 3,
        retryDelayMs: 2000,
        batchSize: 1000,
      });
      
      console.log('📊 Configuration:');
      console.log(`  BigQuery Project: ${process.env.BIGQUERY_PROJECT_ID}`);
      console.log(`  BigQuery Dataset: ${process.env.BIGQUERY_DATASET}`);
      console.log(`  Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
      console.log(`  Dry Run: ${options.dryRun || false}`);
      console.log(`  Force: ${options.force || false}\n`);
      
      // Check for new data
      if (!options.force) {
        console.log('🔍 Checking for new data...');
        const hasNewData = await scheduler.checkForNewData();
        
        if (!hasNewData) {
          console.log('✅ Data is already up to date. Use --force to sync anyway.');
          process.exit(0);
        }
      }
      
      // Execute sync
      console.log('🔄 Executing sync...\n');
      const startTime = Date.now();
      const result = await scheduler.triggerManualSync({ force: options.force });
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      // Display results
      if (result.success) {
        console.log('\n✅ Sync completed successfully!');
        console.log(`  Records processed: ${result.recordsProcessed}`);
        console.log(`  Records inserted: ${result.recordsInserted || 0}`);
        console.log(`  Records failed: ${result.recordsFailed || 0}`);
        console.log(`  Duration: ${duration} seconds`);
        if (result.retryCount && result.retryCount > 0) {
          console.log(`  Retries: ${result.retryCount}`);
        }
      } else {
        console.error('\n❌ Sync failed!');
        console.error(`  Error: ${result.error}`);
        if (result.retryCount) {
          console.error(`  Retries attempted: ${result.retryCount}`);
        }
        process.exit(1);
      }
      
      // Cleanup
      await scheduler.cleanup();
      
    } catch (error) {
      console.error('\n❌ Unexpected error:', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check sync status')
  .action(async () => {
    try {
      const scheduler = new DailySyncScheduler({
        schedule: '0 2 * * *',
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        bigQueryProjectId: process.env.BIGQUERY_PROJECT_ID!,
        bigQueryDataset: process.env.BIGQUERY_DATASET!,
      });
      
      const status = await scheduler.getSyncStatus();
      
      console.log('📊 Sync Status\n');
      
      if (status.lastSync) {
        console.log('Last Sync:');
        console.log(`  Completed: ${status.lastSync.completedAt}`);
        console.log(`  Status: ${status.lastSync.status}`);
        console.log(`  Records: ${status.lastSync.recordsProcessed}`);
      } else {
        console.log('No sync history found.');
      }
      
      console.log(`\nNext Scheduled: ${status.nextScheduledSync}`);
      console.log(`Currently Running: ${status.isRunning ? 'Yes' : 'No'}`);
      
      if (status.currentSyncId) {
        console.log(`Current Sync ID: ${status.currentSyncId}`);
      }
      
      // Get metrics for last 7 days
      const metrics = await scheduler.getSyncMetrics({ days: 7 });
      
      console.log('\n📈 Last 7 Days:');
      console.log(`  Total Syncs: ${metrics.totalSyncs}`);
      console.log(`  Successful: ${metrics.successfulSyncs}`);
      console.log(`  Failed: ${metrics.failedSyncs}`);
      console.log(`  Avg Duration: ${metrics.averageDuration}s`);
      console.log(`  Total Records: ${metrics.totalRecordsProcessed.toLocaleString()}`);
      
      await scheduler.cleanup();
      
    } catch (error) {
      console.error('❌ Error getting status:', error);
      process.exit(1);
    }
  });

program
  .command('schedule')
  .description('Start the scheduled sync service')
  .action(async () => {
    console.log('🕒 Starting scheduled sync service...\n');
    
    try {
      const scheduler = new DailySyncScheduler({
        schedule: process.env.SYNC_SCHEDULE || '0 2 * * *',
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        bigQueryProjectId: process.env.BIGQUERY_PROJECT_ID!,
        bigQueryDataset: process.env.BIGQUERY_DATASET!,
        retryAttempts: 3,
        retryDelayMs: 2000,
      });
      
      scheduler.start();
      console.log(`✅ Scheduler started with cron: ${process.env.SYNC_SCHEDULE || '0 2 * * *'}`);
      console.log('Press Ctrl+C to stop...\n');
      
      // Keep the process running
      process.on('SIGINT', async () => {
        console.log('\n\n🛑 Stopping scheduler...');
        scheduler.stop();
        await scheduler.cleanup();
        process.exit(0);
      });
      
      // Prevent the process from exiting
      setInterval(() => {}, 1000);
      
    } catch (error) {
      console.error('❌ Error starting scheduler:', error);
      process.exit(1);
    }
  });

program.parse();