#!/usr/bin/env node

const http = require('http');
const https = require('https');

// Check if running in production (Railway) or local
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;
const HOST = isProduction ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${PORT}`;

console.log('🔄 Starting BigQuery to Supabase sync...');
console.log(`Environment: ${isProduction ? 'Production' : 'Development'}`);
console.log(`API Host: ${HOST}`);

async function checkSyncStatus() {
  return new Promise((resolve, reject) => {
    const url = `${HOST}/api/sync/smart-sync`;
    const protocol = url.startsWith('https') ? https : http;
    
    console.log('\n1. Checking data availability...');
    
    protocol.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('   BigQuery data status:');
          console.log(`   - Total rows: ${result.bigquery?.total_rows || 0}`);
          console.log(`   - Date range: ${result.bigquery?.earliest_date} to ${result.bigquery?.latest_date}`);
          console.log(`   - Recent rows (30d): ${result.bigquery?.recentRows || 0}`);
          console.log(`   - Unique ASINs: ${result.bigquery?.unique_asins || 0}`);
          console.log(`   - Unique queries: ${result.bigquery?.unique_queries || 0}`);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function executeSyncPost() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${HOST}/api/sync/smart-sync`);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    console.log('\n2. Executing sync...');
    
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          if (result.error) {
            console.error(`   ❌ Error: ${result.error}`);
            console.error(`   Message: ${result.message}`);
            reject(new Error(result.error));
            return;
          }
          
          console.log('\n   Data sync info:');
          console.log(`   - Date range: ${result.dataInfo?.syncDateRange?.start || 'Recent'} to ${result.dataInfo?.syncDateRange?.end || 'Recent'}`);
          console.log(`   - Rows to sync: ${result.dataInfo?.rowsToSync || 0}`);
          
          if (result.syncs) {
            console.log('\n   Sync results:');
            result.syncs.forEach(sync => {
              console.log(`\n   Table: ${sync.table}`);
              console.log(`   - Status: ${sync.success ? '✅ Success' : '❌ Failed'}`);
              console.log(`   - Rows processed: ${sync.rowsProcessed}`);
              console.log(`   - Duration: ${sync.duration}ms`);
              if (sync.error) {
                console.log(`   - Error: ${sync.error}`);
              }
            });
          }
          
          if (result.summary) {
            console.log('\n   Summary:');
            console.log(`   - Total rows: ${result.summary.totalRowsProcessed}`);
            console.log(`   - Total time: ${result.summary.totalDuration}ms`);
            console.log(`   - Tables synced: ${result.summary.tablesSync}`);
          }
          
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', reject);
    req.write(JSON.stringify({ forceSync: false }));
    req.end();
  });
}

async function runSync() {
  try {
    // First check status
    const status = await checkSyncStatus();
    
    if (!status.readyToSync) {
      console.log('\n❌ No data available to sync!');
      return;
    }
    
    // Execute sync
    const result = await executeSyncPost();
    
    console.log('\n✅ Sync completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  }
}

// If we're in development and the server might not be running, start it first
if (!isProduction) {
  console.log('\nNote: Make sure your development server is running (npm run dev)');
  console.log('Attempting to connect to local server...\n');
}

runSync().catch(console.error);