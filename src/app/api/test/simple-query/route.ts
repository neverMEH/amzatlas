import { NextResponse } from 'next/server'
import { BigQuery } from '@google-cloud/bigquery'

export async function GET() {
  try {
    // Get configuration
    const projectId = process.env.BIGQUERY_PROJECT_ID || 'amazon-sp-report-loader'
    const dataset = (process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85').replace(/\.$/, '')
    
    // Parse credentials
    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    if (!credsJson) {
      return NextResponse.json({ error: 'No credentials found' }, { status: 500 })
    }
    
    const credentials = JSON.parse(credsJson)
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n')
    
    // Create client
    const client = new BigQuery({
      projectId,
      credentials: {
        type: credentials.type,
        project_id: credentials.project_id,
        private_key_id: credentials.private_key_id,
        private_key: credentials.private_key,
        client_email: credentials.client_email,
        client_id: credentials.client_id
      }
    })
    
    const results: any = {
      config: { projectId, dataset },
      queries: []
    }
    
    // Test 1: List tables
    try {
      const [tables] = await client.dataset(dataset).getTables()
      results.queries.push({
        name: 'List Tables',
        success: true,
        count: tables.length,
        tables: tables.slice(0, 5).map(t => t.id)
      })
    } catch (error: any) {
      results.queries.push({
        name: 'List Tables',
        success: false,
        error: error.message
      })
    }
    
    // Test 2: Simple query on seller-search_query_performance
    const queries = [
      {
        name: 'Query with backticks on table',
        sql: `SELECT COUNT(*) as count FROM \`${projectId}.${dataset}.\`seller-search_query_performance\`\` WHERE DATE(\`Date\`) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)`
      },
      {
        name: 'Query without backticks on table',
        sql: `SELECT COUNT(*) as count FROM \`${projectId}.${dataset}.seller-search_query_performance\` WHERE DATE(\`Date\`) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)`
      },
      {
        name: 'Query first row',
        sql: `SELECT * FROM \`${projectId}.${dataset}.seller-search_query_performance\` LIMIT 1`
      }
    ]
    
    for (const queryDef of queries) {
      try {
        console.log(`Executing: ${queryDef.sql}`)
        const [rows] = await client.query({ query: queryDef.sql })
        
        results.queries.push({
          name: queryDef.name,
          success: true,
          result: rows[0],
          rowCount: rows.length,
          columns: rows.length > 0 ? Object.keys(rows[0]).slice(0, 10) : []
        })
      } catch (error: any) {
        results.queries.push({
          name: queryDef.name,
          success: false,
          error: error.message,
          sql: queryDef.sql
        })
      }
    }
    
    return NextResponse.json(results)
    
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to run simple query test',
      message: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}