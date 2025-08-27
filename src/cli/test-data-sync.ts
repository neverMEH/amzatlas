#!/usr/bin/env node
import { Command } from 'commander';
import { config } from 'dotenv';
import { BigQueryConnectionPool } from '@/lib/bigquery/connection-pool';
import { BigQueryDataInspector } from '@/lib/bigquery/data-inspector';
import { BigQueryToSupabaseSync, ASINFilterStrategy } from '@/lib/supabase/sync/bigquery-to-supabase';
import { DataValidator } from '@/lib/validation/data-validator';
import { DataComparator } from '@/lib/comparison/data-comparator';
import { InspectionReportGenerator } from '@/lib/reports/inspection-report-generator';
import { errorTracker, ErrorCategory, ErrorSeverity } from '@/lib/errors/error-tracker';
import { getConfig, getPoolConfig } from '@/config/bigquery.config';
import { getSupabaseClient } from '@/config/supabase.config';
import { format } from 'date-fns';

// Load environment variables
config();

const program = new Command();

program
  .name('test-data-sync')
  .description('Test BigQuery to Supabase data synchronization')
  .version('1.0.0');

// Inspect command
program
  .command('inspect')
  .description('Inspect BigQuery data and generate ASIN distribution report')
  .requiredOption('-q, --query <query>', 'Search query to analyze')
  .option('-s, --start <date>', 'Start date (YYYY-MM-DD)', format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
  .option('-e, --end <date>', 'End date (YYYY-MM-DD)', format(new Date(), 'yyyy-MM-dd'))
  .option('-t, --tables <tables...>', 'Tables to inspect', ['sqpRaw'])
  .option('-o, --output <format>', 'Output format (markdown|html|json)', 'markdown')
  .action(async (options: any) => {
    console.log('🔍 Starting data inspection...\n');
    
    try {
      // Initialize BigQuery connection
      const bqConfig = getConfig();
      const poolConfig = getPoolConfig();
      const pool = new BigQueryConnectionPool(poolConfig);
      const inspector = new BigQueryDataInspector(pool);
      
      // Perform inspection
      const report = await inspector.generateInspectionReport({
        tables: options.tables.map((t: string) => `${bqConfig.bigquery.projectId}.${bqConfig.bigquery.dataset}.${t}`),
        queries: [options.query],
        dateRange: {
          start: new Date(options.start),
          end: new Date(options.end),
        },
      });
      
      // Generate report
      const reportGenerator = new InspectionReportGenerator();
      const output = reportGenerator.generateReport(
        { inspection: report },
        { format: options.output, includeSamples: true }
      );
      
      console.log(output);
      
      // Cleanup
      await pool.close();
    } catch (error: any) {
      errorTracker.trackAutoError(error, { command: 'inspect', options });
      console.error('❌ Inspection failed:', error.message);
      process.exit(1);
    }
  });

// Sync command
program
  .command('sync')
  .description('Sync data from BigQuery to Supabase with ASIN filtering')
  .requiredOption('-p, --period <period>', 'Period type (weekly|monthly|quarterly|yearly)')
  .option('-s, --start <date>', 'Start date (YYYY-MM-DD)', format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
  .option('-e, --end <date>', 'End date (YYYY-MM-DD)', format(new Date(), 'yyyy-MM-dd'))
  .option('-f, --filter <strategy>', 'ASIN filter strategy (all|top|specific|representative)', 'all')
  .option('-n, --count <number>', 'Number of ASINs for top/representative strategies', '10')
  .option('-a, --asins <asins...>', 'Specific ASINs to sync')
  .option('--dry-run', 'Perform dry run without writing to Supabase')
  .option('--validate', 'Validate data during sync')
  .option('--inspect', 'Include detailed inspection in results')
  .action(async (options: any) => {
    console.log('🚀 Starting data sync...\n');
    
    try {
      // Initialize connections
      const bqConfig = getConfig();
      const supabaseUrl = process.env.SUPABASE_URL!;
      const supabaseKey = process.env.SUPABASE_ANON_KEY!;
      const poolConfig = getPoolConfig();
      const pool = new BigQueryConnectionPool(poolConfig);
      
      // Configure sync
      const sync = new BigQueryToSupabaseSync({
        supabaseUrl,
        supabaseKey,
        bigqueryPool: pool,
        batchSize: 100,
      });
      
      // Set ASIN filter
      const filterStrategy: ASINFilterStrategy = {
        type: options.filter as any,
        count: parseInt(options.count),
        asins: options.asins,
      };
      sync.setASINFilter(filterStrategy);
      
      console.log(`📋 Filter Strategy: ${options.filter}`);
      if (filterStrategy.count) console.log(`   Count: ${filterStrategy.count}`);
      if (filterStrategy.asins) console.log(`   ASINs: ${filterStrategy.asins.join(', ')}`);
      console.log();
      
      // Perform sync
      const result = await sync.syncPeriodData(
        options.period,
        new Date(options.start),
        new Date(options.end),
        {
          dryRun: options.dryRun,
          validateData: options.validate,
          inspect: options.inspect,
        }
      );
      
      // Display results
      console.log('\n📊 Sync Results:');
      console.log(`   Success: ${result.success ? '✅' : '❌'}`);
      console.log(`   Records Synced: ${result.recordsSynced}`);
      
      if (result.dryRun) {
        console.log(`   Would Sync: ${result.wouldSync} records`);
      }
      
      if (result.validation) {
        console.log('\n📈 Validation Results:');
        console.log(`   Total Records: ${result.validation.totalRecords}`);
        console.log(`   Successful: ${result.validation.successfulRecords}`);
        console.log(`   Failed: ${result.validation.failedRecords}`);
        console.log(`   Distinct Queries: ${result.validation.distinctQueries}`);
        console.log(`   Distinct ASINs: ${result.validation.distinctASINs}`);
        console.log(`   Data Quality Score: ${result.validation.dataQualityScore.toFixed(2)}%`);
      }
      
      if (result.inspection) {
        console.log('\n🔍 Inspection Details:');
        console.log(`   Source Records: ${result.inspection.sourceRecords}`);
        console.log(`   Synced Records: ${result.inspection.syncedRecords}`);
        console.log(`   Total ASINs: ${result.inspection.asinDistribution.total}`);
        console.log(`   Avg CTR: ${result.inspection.metrics.avgCTR.toFixed(2)}%`);
      }
      
      if (result.errors.length > 0) {
        console.log('\n⚠️  Errors:');
        result.errors.slice(0, 5).forEach(error => {
          console.log(`   - ${error.error}`);
        });
      }
      
      // Cleanup
      await pool.close();
    } catch (error: any) {
      errorTracker.trackAutoError(error, { command: 'sync', options });
      console.error('❌ Sync failed:', error.message);
      process.exit(1);
    }
  });

// Compare command
program
  .command('compare')
  .description('Compare data between BigQuery and Supabase')
  .requiredOption('-p, --period <period>', 'Period type (weekly|monthly|quarterly|yearly)')
  .requiredOption('-q, --query <query>', 'Search query to compare')
  .option('-s, --start <date>', 'Start date (YYYY-MM-DD)', format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
  .option('-e, --end <date>', 'End date (YYYY-MM-DD)', format(new Date(), 'yyyy-MM-dd'))
  .action(async (options: any) => {
    console.log('🔄 Starting data comparison...\n');
    
    try {
      // Initialize connections
      const bqConfig = getConfig();
      const supabaseUrl = process.env.SUPABASE_URL!;
      const supabaseKey = process.env.SUPABASE_ANON_KEY!;
      const poolConfig = getPoolConfig();
      const pool = new BigQueryConnectionPool(poolConfig);
      
      const sync = new BigQueryToSupabaseSync({
        supabaseUrl,
        supabaseKey,
        bigqueryPool: pool,
      });
      
      // Perform comparison
      const result = await sync.comparePeriodData({
        query: options.query,
        sourcePeriod: 'weekly',
        targetPeriod: options.period,
        dateRange: {
          start: new Date(options.start),
          end: new Date(options.end),
        },
      });
      
      console.log('📊 Comparison Results:');
      console.log(`   Source: ${result.sourcePeriod}`);
      console.log(`   Target: ${result.targetPeriod}`);
      console.log(`   Matches: ${result.matches ? '✅' : '❌'}`);
      console.log(`   Discrepancies: ${result.discrepancies.length}`);
      
      if (result.discrepancies.length > 0) {
        console.log('\n⚠️  Sample Discrepancies:');
        result.discrepancies.slice(0, 10).forEach(disc => {
          console.log(`   - ${disc.query}/${disc.asin}: ${disc.field} (${disc.sourceValue} → ${disc.targetValue})`);
        });
      }
      
      // Cleanup
      await pool.close();
    } catch (error: any) {
      errorTracker.trackAutoError(error, { command: 'compare', options });
      console.error('❌ Comparison failed:', error.message);
      process.exit(1);
    }
  });

// Test command - comprehensive test suite
program
  .command('test')
  .description('Run comprehensive test of data sync with different ASIN strategies')
  .requiredOption('-q, --query <query>', 'Search query to test')
  .option('-s, --start <date>', 'Start date (YYYY-MM-DD)', format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
  .option('-e, --end <date>', 'End date (YYYY-MM-DD)', format(new Date(), 'yyyy-MM-dd'))
  .action(async (options: any) => {
    console.log('🧪 Running comprehensive sync test...\n');
    
    try {
      // Initialize connections
      const bqConfig = getConfig();
      const supabaseUrl = process.env.SUPABASE_URL!;
      const supabaseKey = process.env.SUPABASE_ANON_KEY!;
      const poolConfig = getPoolConfig();
      const pool = new BigQueryConnectionPool(poolConfig);
      const inspector = new BigQueryDataInspector(pool);
      const validator = new DataValidator();
      
      // First, inspect the data
      console.log('1️⃣ Inspecting BigQuery data...');
      const tableName = `${bqConfig.bigquery.projectId}.${bqConfig.bigquery.dataset}.${bqConfig.tables.sqpRaw}`;
      
      const distribution = await inspector.analyzeASINDistribution(
        tableName,
        options.query,
        new Date(options.start),
        new Date(options.end)
      );
      
      console.log(`   Total ASINs: ${distribution.totalASINs}`);
      console.log(`   Total Impressions: ${distribution.metrics.totalImpressions.toLocaleString()}`);
      console.log(`   Top 5 ASINs:`);
      distribution.topASINs.slice(0, 5).forEach(asin => {
        console.log(`     - ${asin.asin}: ${asin.impressions.toLocaleString()} impressions`);
      });
      
      // Generate sampling strategies
      const strategies = inspector.generateSamplingStrategies(distribution);
      
      console.log('\n2️⃣ Testing different sampling strategies...');
      
      const sync = new BigQueryToSupabaseSync({
        supabaseUrl,
        supabaseKey,
        bigqueryPool: pool,
        batchSize: 100,
      });
      
      const testResults: any[] = [];
      
      // Test each strategy
      for (const [strategyName, strategy] of Object.entries(strategies)) {
        console.log(`\n   Testing: ${strategy.name}`);
        console.log(`   Estimated rows: ${strategy.estimatedRows.toLocaleString()}`);
        
        // Configure filter
        if (strategyName === 'all') {
          sync.setASINFilter({ type: 'all' });
        } else if (strategyName === 'top1') {
          sync.setASINFilter({ type: 'specific', asins: strategy.asins || [] });
        } else if (strategyName === 'top5' || strategyName === 'top10') {
          sync.setASINFilter({ type: 'top', count: strategy.asins?.length || 5 });
        } else if (strategyName === 'representative') {
          sync.setASINFilter({ type: 'specific', asins: strategy.asins || [] });
        }
        
        // Perform dry run
        const result = await sync.syncPeriodData(
          'weekly',
          new Date(options.start),
          new Date(options.end),
          {
            dryRun: true,
            validateData: true,
            inspect: true,
          }
        );
        
        testResults.push({
          strategy: strategy.name,
          wouldSync: result.wouldSync,
          estimatedRows: strategy.estimatedRows,
          accuracy: result.wouldSync ? (result.wouldSync / strategy.estimatedRows * 100).toFixed(2) : '0',
        });
        
        console.log(`   Would sync: ${result.wouldSync} records`);
        console.log(`   Estimation accuracy: ${testResults[testResults.length - 1].accuracy}%`);
      }
      
      // Summary
      console.log('\n3️⃣ Test Summary:');
      console.log('┌─────────────────────────┬──────────────┬──────────────┬──────────────┐');
      console.log('│ Strategy                │ Would Sync   │ Estimated    │ Accuracy %   │');
      console.log('├─────────────────────────┼──────────────┼──────────────┼──────────────┤');
      
      testResults.forEach(result => {
        console.log(
          `│ ${result.strategy.padEnd(23)} │ ${String(result.wouldSync).padStart(12)} │ ${String(result.estimatedRows).padStart(12)} │ ${String(result.accuracy).padStart(11)}% │`
        );
      });
      
      console.log('└─────────────────────────┴──────────────┴──────────────┴──────────────┘');
      
      // Recommendations
      console.log('\n📋 Recommendations:');
      if (distribution.totalASINs > 100) {
        console.log('   - Consider using "top10" or "representative" strategy for efficient testing');
      } else if (distribution.totalASINs > 50) {
        console.log('   - "top5" strategy provides good coverage with reasonable data volume');
      } else {
        console.log('   - With low ASIN count, "all" strategy is feasible for complete testing');
      }
      
      // Cleanup
      await pool.close();
    } catch (error: any) {
      errorTracker.trackAutoError(error, { command: 'test', options });
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    }
  });

// Error report command
program
  .command('errors')
  .description('View error tracking report')
  .option('-c, --category <category>', 'Filter by error category')
  .option('-s, --severity <severity>', 'Filter by severity')
  .option('--export <format>', 'Export errors (json|csv)')
  .action(async (options: any) => {
    console.log('📊 Error Report\n');
    
    const summary = errorTracker.getErrorSummary();
    
    console.log('Summary:');
    console.log(`   Total Errors: ${summary.totalErrors}`);
    console.log(`   Resolved: ${summary.resolvedCount}`);
    console.log(`   Unresolved: ${summary.unresolvedCount}`);
    
    console.log('\nBy Category:');
    Object.entries(summary.errorsByCategory).forEach(([category, count]) => {
      console.log(`   ${category}: ${count}`);
    });
    
    console.log('\nBy Severity:');
    Object.entries(summary.errorsBySeverity).forEach(([severity, count]) => {
      console.log(`   ${severity}: ${count}`);
    });
    
    if (summary.criticalErrors.length > 0) {
      console.log('\n⚠️  Critical Errors:');
      summary.criticalErrors.forEach(error => {
        console.log(`   - [${format(error.timestamp, 'yyyy-MM-dd HH:mm')}] ${error.message}`);
      });
    }
    
    if (options.export) {
      const exported = errorTracker.exportErrors(options.export);
      const filename = `errors_${format(new Date(), 'yyyyMMdd_HHmmss')}.${options.export}`;
      console.log(`\nExported to: ${filename}`);
      console.log(exported);
    }
  });

// Set up error tracking
errorTracker.setThresholds([
  {
    category: ErrorCategory.BIGQUERY,
    severity: ErrorSeverity.HIGH,
    maxCount: 5,
    timeWindowMinutes: 60,
  },
  {
    category: ErrorCategory.SUPABASE,
    severity: ErrorSeverity.CRITICAL,
    maxCount: 1,
    timeWindowMinutes: 60,
  },
]);

errorTracker.setAlertCallback((summary) => {
  console.error('\n🚨 ERROR THRESHOLD EXCEEDED!');
  console.error(`Critical errors: ${summary.criticalErrors.length}`);
  console.error(`Recent errors: ${summary.recentErrors.length}`);
});

// Parse and execute
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}