const { BigQuerySyncService } = require('./src/services/bigquery-sync/sync-service');

// Load environment variables
require('dotenv').config();

async function testSync() {
  console.log('Testing BigQuery sync service directly...\n');
  
  try {
    const syncService = new BigQuerySyncService();
    
    console.log('Starting sync for search_query_performance table...');
    const result = await syncService.syncTable('search_query_performance', {
      batchSize: 10,
      tableSchema: 'sqp'
    });
    
    console.log('\nSync result:', result);
    
  } catch (error) {
    console.error('\nSync failed with error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  }
}

testSync();