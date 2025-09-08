import { NextResponse } from 'next/server'
import { getFileBigQueryClient } from '@/config/bigquery-file-auth.config'
import { getBigQueryConfig } from '@/config/bigquery.config'

export async function GET() {
  try {
    const client = getFileBigQueryClient()
    const config = getBigQueryConfig()
    const dataset = config.datasets.production
    const projectId = config.projectId
    const tableName = 'seller-search_query_performance'
    
    const results: any = {
      timestamp: new Date().toISOString(),
      table: `${projectId}.${dataset}.${tableName}`,
      checks: []
    }
    
    // Check 1: Total row count
    try {
      const countQuery = `
        SELECT COUNT(*) as total_rows
        FROM \`${projectId}.${dataset}.${tableName}\`
      `
      const [countResult] = await client.query({ query: countQuery })
      results.checks.push({
        name: 'Total Row Count',
        success: true,
        result: countResult[0]
      })
    } catch (error: any) {
      results.checks.push({
        name: 'Total Row Count',
        success: false,
        error: error.message
      })
    }
    
    // Check 2: Date range
    try {
      const dateRangeQuery = `
        SELECT 
          MIN(\`Date\`) as earliest_date,
          MAX(\`Date\`) as latest_date,
          COUNT(DISTINCT DATE(\`Date\`)) as unique_dates
        FROM \`${projectId}.${dataset}.${tableName}\`
      `
      const [dateResult] = await client.query({ query: dateRangeQuery })
      results.checks.push({
        name: 'Date Range',
        success: true,
        result: dateResult[0]
      })
    } catch (error: any) {
      results.checks.push({
        name: 'Date Range',
        success: false,
        error: error.message
      })
    }
    
    // Check 3: Recent data availability
    const recentQueries = [
      { days: 7, name: 'Last 7 days' },
      { days: 14, name: 'Last 14 days' },
      { days: 30, name: 'Last 30 days' },
      { days: 60, name: 'Last 60 days' },
      { days: 90, name: 'Last 90 days' }
    ]
    
    for (const check of recentQueries) {
      try {
        const recentQuery = `
          SELECT COUNT(*) as row_count
          FROM \`${projectId}.${dataset}.${tableName}\`
          WHERE DATE(\`Date\`) >= DATE_SUB(CURRENT_DATE(), INTERVAL ${check.days} DAY)
        `
        const [recentResult] = await client.query({ query: recentQuery })
        results.checks.push({
          name: check.name,
          success: true,
          row_count: recentResult[0].row_count
        })
      } catch (error: any) {
        results.checks.push({
          name: check.name,
          success: false,
          error: error.message
        })
      }
    }
    
    // Check 4: Sample recent data
    try {
      const sampleQuery = `
        SELECT 
          \`Date\`,
          \`ASIN\`,
          \`Parent ASIN\`,
          \`Search Query\`
        FROM \`${projectId}.${dataset}.${tableName}\`
        ORDER BY \`Date\` DESC
        LIMIT 5
      `
      const [sampleResult] = await client.query({ query: sampleQuery })
      results.checks.push({
        name: 'Recent Data Sample',
        success: true,
        count: sampleResult.length,
        samples: sampleResult
      })
    } catch (error: any) {
      results.checks.push({
        name: 'Recent Data Sample',
        success: false,
        error: error.message
      })
    }
    
    // Check 5: Data by month
    try {
      const monthlyQuery = `
        SELECT 
          FORMAT_DATE('%Y-%m', DATE(\`Date\`)) as month,
          COUNT(*) as row_count
        FROM \`${projectId}.${dataset}.${tableName}\`
        WHERE DATE(\`Date\`) >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
        GROUP BY month
        ORDER BY month DESC
      `
      const [monthlyResult] = await client.query({ query: monthlyQuery })
      results.checks.push({
        name: 'Monthly Data Distribution',
        success: true,
        months: monthlyResult
      })
    } catch (error: any) {
      results.checks.push({
        name: 'Monthly Data Distribution',
        success: false,
        error: error.message
      })
    }
    
    return NextResponse.json(results)
    
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to check data availability',
      message: error.message
    }, { status: 500 })
  }
}