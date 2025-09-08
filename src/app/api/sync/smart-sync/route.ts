import { NextResponse } from 'next/server'
import { getFileBigQueryClient } from '@/config/bigquery-file-auth.config'
import { getBigQueryConfig } from '@/config/bigquery.config'
import { BigQuerySyncService } from '@/services/bigquery-sync/sync-service'

export async function POST(request: Request) {
  try {
    const { forceSync = false } = await request.json().catch(() => ({}))
    
    const client = getFileBigQueryClient()
    const config = getBigQueryConfig()
    const dataset = config.datasets.production
    const projectId = config.projectId
    
    // Step 1: Check data availability
    const dateRangeQuery = `
      SELECT 
        MIN(\`Date\`) as earliest_date,
        MAX(\`Date\`) as latest_date,
        COUNT(*) as total_rows
      FROM \`${projectId}.${dataset}.seller-search_query_performance\`
    `
    
    const [dateResult] = await client.query({ query: dateRangeQuery })
    const dateInfo = dateResult[0]
    
    if (!dateInfo.total_rows || dateInfo.total_rows === 0) {
      return NextResponse.json({
        error: 'No data found in BigQuery',
        details: dateInfo
      }, { status: 404 })
    }
    
    // Step 2: Find optimal sync range
    let syncDateRange = null
    let rowsInRange = 0
    
    // Check for recent data first
    const recentCheckQuery = `
      SELECT COUNT(*) as row_count
      FROM \`${projectId}.${dataset}.seller-search_query_performance\`
      WHERE DATE(\`Date\`) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    `
    
    const [recentResult] = await client.query({ query: recentCheckQuery })
    rowsInRange = recentResult[0].row_count
    
    if (rowsInRange === 0) {
      // No recent data, use the latest available data
      const latestDate = dateInfo.latest_date?.value || dateInfo.latest_date
      const latestDateStr = latestDate.split('T')[0]
      const startDate = new Date(latestDateStr)
      startDate.setDate(startDate.getDate() - 30) // Get 30 days of data
      
      syncDateRange = {
        start: startDate.toISOString().split('T')[0],
        end: latestDateStr
      }
      
      // Count rows in this range
      const rangeCheckQuery = `
        SELECT COUNT(*) as row_count
        FROM \`${projectId}.${dataset}.seller-search_query_performance\`
        WHERE DATE(\`Date\`) BETWEEN '${syncDateRange.start}' AND '${syncDateRange.end}'
      `
      const [rangeResult] = await client.query({ query: rangeCheckQuery })
      rowsInRange = rangeResult[0].row_count
    }
    
    // Step 3: Execute sync
    const syncService = new BigQuerySyncService()
    const results = {
      dataInfo: {
        earliestDate: dateInfo.earliest_date,
        latestDate: dateInfo.latest_date,
        totalRows: dateInfo.total_rows,
        syncDateRange,
        rowsToSync: rowsInRange
      },
      syncs: [] as any[]
    }
    
    // Sync asin_performance_data first (parent records)
    const asinSyncOptions = {
      batchSize: 1000,
      tableSchema: 'sqp' as const,
      ...(syncDateRange && { dateRange: syncDateRange })
    }
    
    const asinResult = await syncService.syncTable('asin_performance_data', asinSyncOptions)
    results.syncs.push({
      table: 'asin_performance_data',
      ...asinResult
    })
    
    // If parent sync successful, sync search_query_performance
    if (asinResult.success && (asinResult.rowsProcessed > 0 || forceSync)) {
      const searchResult = await syncService.syncTable('search_query_performance', asinSyncOptions)
      results.syncs.push({
        table: 'search_query_performance',
        ...searchResult
      })
    }
    
    // Calculate total stats
    const totalRows = results.syncs.reduce((sum, sync) => sum + sync.rowsProcessed, 0)
    const totalDuration = results.syncs.reduce((sum, sync) => sum + sync.duration, 0)
    const allSuccess = results.syncs.every(sync => sync.success)
    
    return NextResponse.json({
      success: allSuccess,
      summary: {
        totalRowsProcessed: totalRows,
        totalDuration: totalDuration,
        tablesSync: results.syncs.length
      },
      ...results
    })
    
  } catch (error: any) {
    console.error('Smart sync error:', error)
    return NextResponse.json({
      error: 'Sync failed',
      message: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}

// GET method to check sync status
export async function GET() {
  try {
    const client = getFileBigQueryClient()
    const config = getBigQueryConfig()
    const dataset = config.datasets.production
    const projectId = config.projectId
    
    // Check BigQuery data status
    const statusQuery = `
      SELECT 
        MIN(\`Date\`) as earliest_date,
        MAX(\`Date\`) as latest_date,
        COUNT(*) as total_rows,
        COUNT(DISTINCT \`ASIN\`) as unique_asins,
        COUNT(DISTINCT \`Search Query\`) as unique_queries
      FROM \`${projectId}.${dataset}.seller-search_query_performance\`
    `
    
    const [statusResult] = await client.query({ query: statusQuery })
    
    // Check recent data
    const recentQuery = `
      SELECT COUNT(*) as recent_rows
      FROM \`${projectId}.${dataset}.seller-search_query_performance\`
      WHERE DATE(\`Date\`) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    `
    
    const [recentResult] = await client.query({ query: recentQuery })
    
    return NextResponse.json({
      bigquery: {
        ...statusResult[0],
        recentRows: recentResult[0].recent_rows
      },
      readyToSync: statusResult[0].total_rows > 0
    })
    
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to check sync status',
      message: error.message
    }, { status: 500 })
  }
}