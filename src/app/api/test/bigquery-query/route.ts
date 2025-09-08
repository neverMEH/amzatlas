import { NextResponse } from 'next/server'
import { getFileBigQueryClient } from '@/config/bigquery-file-auth.config'
import { getBigQueryConfig } from '@/config/bigquery.config'

export async function GET() {
  try {
    const client = getFileBigQueryClient()
    const config = getBigQueryConfig()
    const dataset = config.datasets.production
    const projectId = config.projectId
    
    const results: any = {
      timestamp: new Date().toISOString(),
      config: {
        projectId,
        dataset,
        location: config.location
      },
      queries: []
    }
    
    // Test 1: Simple query without table
    try {
      const simpleQuery = `SELECT 1 as test_value, CURRENT_TIMESTAMP() as query_time`
      const [rows] = await client.query({ query: simpleQuery })
      results.queries.push({
        name: 'Simple Test Query',
        success: true,
        result: rows[0]
      })
    } catch (error: any) {
      results.queries.push({
        name: 'Simple Test Query',
        success: false,
        error: error.message
      })
    }
    
    // Test 2: List tables in dataset
    try {
      const tablesQuery = `
        SELECT table_name, table_type, creation_time
        FROM \`${projectId}.${dataset}.INFORMATION_SCHEMA.TABLES\`
        ORDER BY table_name
        LIMIT 10
      `
      const [tables] = await client.query({ query: tablesQuery })
      results.queries.push({
        name: 'List Tables',
        success: true,
        count: tables.length,
        tables: tables.map((t: any) => ({
          name: t.table_name,
          type: t.table_type,
          created: t.creation_time
        }))
      })
    } catch (error: any) {
      results.queries.push({
        name: 'List Tables',
        success: false,
        error: error.message,
        details: error.errors || error.response?.body
      })
    }
    
    // Test 3: Get columns from seller-search_query_performance
    try {
      const columnsQuery = `
        SELECT column_name, data_type, is_nullable
        FROM \`${projectId}.${dataset}.INFORMATION_SCHEMA.COLUMNS\`
        WHERE table_name = 'seller-search_query_performance'
        ORDER BY ordinal_position
        LIMIT 20
      `
      const [columns] = await client.query({ query: columnsQuery })
      results.queries.push({
        name: 'Get Table Columns',
        success: true,
        count: columns.length,
        columns: columns.map((c: any) => ({
          name: c.column_name,
          type: c.data_type,
          nullable: c.is_nullable
        }))
      })
    } catch (error: any) {
      results.queries.push({
        name: 'Get Table Columns',
        success: false,
        error: error.message
      })
    }
    
    // Test 4: Simple data query with proper escaping
    try {
      // First, let's try different table name formats
      const tableNames = [
        `\`${projectId}.${dataset}.seller-search_query_performance\``,
        `\`${projectId}.${dataset}.\`seller-search_query_performance\`\``,
        `${projectId}.${dataset}.\`seller-search_query_performance\``,
      ]
      
      for (const tableName of tableNames) {
        try {
          const dataQuery = `SELECT * FROM ${tableName} LIMIT 1`
          const [data] = await client.query({ query: dataQuery })
          
          results.queries.push({
            name: `Data Query (${tableName})`,
            success: true,
            rowCount: data.length,
            columns: data.length > 0 ? Object.keys(data[0]) : []
          })
          
          // If successful, break
          break
        } catch (err: any) {
          results.queries.push({
            name: `Data Query (${tableName})`,
            success: false,
            error: err.message,
            query: `SELECT * FROM ${tableName} LIMIT 1`
          })
        }
      }
    } catch (error: any) {
      results.queries.push({
        name: 'Data Query Tests',
        success: false,
        error: error.message
      })
    }
    
    // Test 5: Test column name formats
    try {
      const columnTests = [
        { query: `SELECT \`ASIN\` FROM \`${projectId}.${dataset}.seller-search_query_performance\` LIMIT 1`, name: 'Backtick ASIN' },
        { query: `SELECT ASIN FROM \`${projectId}.${dataset}.seller-search_query_performance\` LIMIT 1`, name: 'Unquoted ASIN' },
        { query: `SELECT * FROM \`${projectId}.${dataset}.seller-search_query_performance\` WHERE \`Date\` >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY) LIMIT 1`, name: 'With Date Filter' },
      ]
      
      for (const test of columnTests) {
        try {
          const [data] = await client.query({ query: test.query })
          results.queries.push({
            name: test.name,
            success: true,
            rowCount: data.length
          })
        } catch (err: any) {
          results.queries.push({
            name: test.name,
            success: false,
            error: err.message,
            query: test.query
          })
        }
      }
    } catch (error: any) {
      results.queries.push({
        name: 'Column Test Queries',
        success: false,
        error: error.message
      })
    }
    
    // Summary
    results.summary = {
      total: results.queries.length,
      successful: results.queries.filter((q: any) => q.success).length,
      failed: results.queries.filter((q: any) => !q.success).length
    }
    
    return NextResponse.json(results)
    
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to test BigQuery queries',
      message: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}