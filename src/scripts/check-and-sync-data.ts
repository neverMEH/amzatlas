#!/usr/bin/env npx tsx
import { getFileBigQueryClient } from '../config/bigquery-file-auth.config'
import { getBigQueryConfig } from '../config/bigquery.config'
import { BigQuerySyncService } from '../services/bigquery-sync/sync-service'

async function checkAndSyncData() {
  console.log('🔍 Checking BigQuery data availability...\n')
  
  try {
    const client = getFileBigQueryClient()
    const config = getBigQueryConfig()
    const dataset = config.datasets.production
    const projectId = config.projectId
    const tableName = 'seller-search_query_performance'
    
    // Check date range
    console.log('1. Checking date range of available data...')
    const dateRangeQuery = `
      SELECT 
        MIN(\`Date\`) as earliest_date,
        MAX(\`Date\`) as latest_date,
        COUNT(DISTINCT DATE(\`Date\`)) as unique_dates,
        COUNT(*) as total_rows
      FROM \`${projectId}.${dataset}.${tableName}\`
    `
    
    const [dateResult] = await client.query({ query: dateRangeQuery })
    const dateInfo = dateResult[0]
    
    console.log('Date range results:')
    console.log(`  Earliest date: ${dateInfo.earliest_date}`)
    console.log(`  Latest date: ${dateInfo.latest_date}`)
    console.log(`  Unique dates: ${dateInfo.unique_dates}`)
    console.log(`  Total rows: ${dateInfo.total_rows}\n`)
    
    if (dateInfo.total_rows === 0) {
      console.log('❌ No data found in BigQuery table!')
      return
    }
    
    // Check recent data
    console.log('2. Checking data availability by time period...')
    const periods = [7, 14, 30, 60, 90, 180, 365]
    let optimalPeriod = 7
    
    for (const days of periods) {
      const recentQuery = `
        SELECT COUNT(*) as row_count
        FROM \`${projectId}.${dataset}.${tableName}\`
        WHERE DATE(\`Date\`) >= DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)
      `
      const [recentResult] = await client.query({ query: recentQuery })
      const rowCount = recentResult[0].row_count
      
      console.log(`  Last ${days} days: ${rowCount} rows`)
      
      if (rowCount > 0 && optimalPeriod === 7) {
        optimalPeriod = days
      }
    }
    
    // Get a sample of recent data
    console.log('\n3. Sample of most recent data:')
    const sampleQuery = `
      SELECT 
        \`Date\`,
        \`ASIN\`,
        \`Parent ASIN\`,
        \`Search Query\`,
        \`Impressions\`,
        \`Clicks\`,
        \`Purchases\`
      FROM \`${projectId}.${dataset}.${tableName}\`
      ORDER BY \`Date\` DESC
      LIMIT 5
    `
    const [sampleResult] = await client.query({ query: sampleQuery })
    
    sampleResult.forEach((row: any, index: number) => {
      console.log(`  ${index + 1}. Date: ${row.Date}, ASIN: ${row.ASIN}, Query: "${row['Search Query']}"`)
    })
    
    // Determine sync strategy
    console.log('\n4. Determining sync strategy...')
    
    // If we have recent data, sync it
    if (optimalPeriod <= 90) {
      console.log(`  ✅ Found data in the last ${optimalPeriod} days`)
      console.log('  Starting sync process...\n')
      
      const syncService = new BigQuerySyncService()
      
      // First sync asin_performance_data to create parent records
      console.log('5. Syncing asin_performance_data (parent records)...')
      const asinResult = await syncService.syncTable('asin_performance_data', {
        batchSize: 1000,
        tableSchema: 'sqp'
      })
      
      console.log(`  Result: ${asinResult.success ? '✅ Success' : '❌ Failed'}`)
      console.log(`  Rows processed: ${asinResult.rowsProcessed}`)
      console.log(`  Duration: ${asinResult.duration}ms`)
      
      if (asinResult.error) {
        console.log(`  Error: ${asinResult.error}`)
      }
      
      // Then sync search_query_performance
      if (asinResult.success && asinResult.rowsProcessed > 0) {
        console.log('\n6. Syncing search_query_performance (child records)...')
        const searchResult = await syncService.syncTable('search_query_performance', {
          batchSize: 1000,
          tableSchema: 'sqp'
        })
        
        console.log(`  Result: ${searchResult.success ? '✅ Success' : '❌ Failed'}`)
        console.log(`  Rows processed: ${searchResult.rowsProcessed}`)
        console.log(`  Duration: ${searchResult.duration}ms`)
        
        if (searchResult.error) {
          console.log(`  Error: ${searchResult.error}`)
        }
      }
      
    } else {
      // If data is too old, we need a specific date range
      console.log(`  ⚠️  Data is older than ${optimalPeriod} days`)
      console.log('  Syncing with specific date range...\n')
      
      // Calculate a reasonable date range (last 30 days of available data)
      const endDate = dateInfo.latest_date.value || dateInfo.latest_date
      const endDateStr = endDate.split('T')[0]
      const startDate = new Date(endDateStr)
      startDate.setDate(startDate.getDate() - 30)
      const startDateStr = startDate.toISOString().split('T')[0]
      
      console.log(`  Date range: ${startDateStr} to ${endDateStr}`)
      
      const syncService = new BigQuerySyncService()
      
      // Sync with specific date range
      console.log('\n5. Syncing asin_performance_data with date range...')
      const asinResult = await syncService.syncTable('asin_performance_data', {
        batchSize: 1000,
        dateRange: { start: startDateStr, end: endDateStr },
        tableSchema: 'sqp'
      })
      
      console.log(`  Result: ${asinResult.success ? '✅ Success' : '❌ Failed'}`)
      console.log(`  Rows processed: ${asinResult.rowsProcessed}`)
      
      if (asinResult.success && asinResult.rowsProcessed > 0) {
        console.log('\n6. Syncing search_query_performance with date range...')
        const searchResult = await syncService.syncTable('search_query_performance', {
          batchSize: 1000,
          dateRange: { start: startDateStr, end: endDateStr },
          tableSchema: 'sqp'
        })
        
        console.log(`  Result: ${searchResult.success ? '✅ Success' : '❌ Failed'}`)
        console.log(`  Rows processed: ${searchResult.rowsProcessed}`)
      }
    }
    
    console.log('\n✅ Sync process complete!')
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
  }
}

// Run the check and sync
checkAndSyncData().catch(console.error)