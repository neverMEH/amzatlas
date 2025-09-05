#!/usr/bin/env tsx
import dotenv from 'dotenv'
import { BigQuerySyncService } from '../services/bigquery-sync/sync-service'

// Load environment variables
dotenv.config()

async function testSmallBatchSync() {
  console.log('🔍 Testing sync with small batch...\n')

  try {
    const syncService = new BigQuerySyncService()
    
    // Test sync with the latest available data (August 10, 2025)
    const latestDate = '2025-08-10'
    
    console.log(`📊 Syncing search_query_performance for date: ${latestDate}`)
    
    const result = await syncService.syncTable('search_query_performance', {
      batchSize: 100,
      dateRange: {
        start: latestDate,
        end: latestDate
      },
      truncate: false,
      tableSchema: 'sqp'
    })
    
    console.log('\n✅ Sync result:')
    console.log(`- Success: ${result.success}`)
    console.log(`- Rows processed: ${result.rowsProcessed}`)
    console.log(`- Duration: ${result.duration}ms`)
    if (result.error) {
      console.log(`- Error: ${result.error}`)
    }

  } catch (error) {
    console.error('❌ Error during sync:', error)
  }
}

// Run the test
testSmallBatchSync()