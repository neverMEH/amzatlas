#!/usr/bin/env node

// Direct sync script that doesn't require the dev server
require('dotenv').config();

async function runDirectSync() {
  console.log('🔄 Direct BigQuery to Supabase sync\n');
  
  try {
    // Import the necessary modules using dynamic imports to handle TS files
    const { register } = require('node:module');
    const { pathToFileURL } = require('node:url');
    const path = require('path');
    
    // Register TypeScript handling
    if (register) {
      register('ts-node/esm', pathToFileURL(__filename));
    }
    
    // Load the sync service
    const { BigQuerySyncService } = await import('./src/services/bigquery-sync/sync-service.ts');
    const { getFileBigQueryClient } = await import('./src/config/bigquery-file-auth.config.ts');
    const { getBigQueryConfig } = await import('./src/config/bigquery.config.ts');
    
    // Initialize
    const syncService = new BigQuerySyncService();
    const client = getFileBigQueryClient();
    const config = getBigQueryConfig();
    const dataset = config.datasets.production;
    const projectId = config.projectId;
    
    console.log('Configuration:');
    console.log(`  Project: ${projectId}`);
    console.log(`  Dataset: ${dataset}\n`);
    
    // Check data availability first
    console.log('1. Checking BigQuery data availability...');
    const dateRangeQuery = `
      SELECT 
        MIN(\`Date\`) as earliest_date,
        MAX(\`Date\`) as latest_date,
        COUNT(*) as total_rows,
        COUNT(DISTINCT \`ASIN\`) as unique_asins
      FROM \`${projectId}.${dataset}.seller-search_query_performance\`
    `;
    
    const [dateResult] = await client.query({ query: dateRangeQuery });
    const dataInfo = dateResult[0];
    
    console.log('  Data found:');
    console.log(`  - Total rows: ${dataInfo.total_rows}`);
    console.log(`  - Date range: ${dataInfo.earliest_date} to ${dataInfo.latest_date}`);
    console.log(`  - Unique ASINs: ${dataInfo.unique_asins}\n`);
    
    if (dataInfo.total_rows === 0) {
      console.log('❌ No data found in BigQuery!');
      return;
    }
    
    // Check recent data
    const recentQuery = `
      SELECT COUNT(*) as recent_rows
      FROM \`${projectId}.${dataset}.seller-search_query_performance\`
      WHERE DATE(\`Date\`) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    `;
    
    const [recentResult] = await client.query({ query: recentQuery });
    const recentRows = recentResult[0].recent_rows;
    
    console.log(`2. Recent data (last 30 days): ${recentRows} rows\n`);
    
    // Determine sync range
    let dateRange = null;
    if (recentRows === 0) {
      // No recent data, use latest available
      const latestDate = dataInfo.latest_date?.value || dataInfo.latest_date;
      const latestDateStr = latestDate.split('T')[0];
      const startDate = new Date(latestDateStr);
      startDate.setDate(startDate.getDate() - 30);
      
      dateRange = {
        start: startDate.toISOString().split('T')[0],
        end: latestDateStr
      };
      
      console.log(`  Using date range: ${dateRange.start} to ${dateRange.end}\n`);
    }
    
    // Sync asin_performance_data first
    console.log('3. Syncing asin_performance_data (parent records)...');
    const asinResult = await syncService.syncTable('asin_performance_data', {
      batchSize: 1000,
      tableSchema: 'sqp',
      ...(dateRange && { dateRange })
    });
    
    console.log(`  Status: ${asinResult.success ? '✅ Success' : '❌ Failed'}`);
    console.log(`  Rows processed: ${asinResult.rowsProcessed}`);
    console.log(`  Duration: ${asinResult.duration}ms`);
    
    if (asinResult.error) {
      console.log(`  Error: ${asinResult.error}`);
    }
    
    // Then sync search_query_performance
    if (asinResult.success && asinResult.rowsProcessed > 0) {
      console.log('\n4. Syncing search_query_performance (child records)...');
      const searchResult = await syncService.syncTable('search_query_performance', {
        batchSize: 1000,
        tableSchema: 'sqp',
        ...(dateRange && { dateRange })
      });
      
      console.log(`  Status: ${searchResult.success ? '✅ Success' : '❌ Failed'}`);
      console.log(`  Rows processed: ${searchResult.rowsProcessed}`);
      console.log(`  Duration: ${searchResult.duration}ms`);
      
      if (searchResult.error) {
        console.log(`  Error: ${searchResult.error}`);
      }
    }
    
    console.log('\n✅ Sync process complete!');
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Check if we have required environment variables
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  console.error('❌ Missing GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable');
  process.exit(1);
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

runDirectSync().catch(console.error);