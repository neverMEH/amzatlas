#!/usr/bin/env npx tsx
import { BigQuery } from '@google-cloud/bigquery'

async function testDirectBigQuery() {
  console.log('🔍 Testing BigQuery connection directly...\n')
  
  try {
    // Get configuration
    const projectId = process.env.BIGQUERY_PROJECT_ID || 'amazon-sp-report-loader'
    const dataset = (process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85').replace(/\.$/, '')
    
    console.log('Configuration:')
    console.log(`  Project ID: ${projectId}`)
    console.log(`  Dataset: ${dataset}`)
    
    // Parse credentials
    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    if (!credsJson) {
      throw new Error('No credentials found in GOOGLE_APPLICATION_CREDENTIALS_JSON')
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
    
    console.log('\nTesting BigQuery access...\n')
    
    // Test 1: List datasets
    console.log('1. Listing datasets...')
    try {
      const [datasets] = await client.getDatasets({ maxResults: 5 })
      console.log(`   ✅ Found ${datasets.length} datasets:`)
      datasets.forEach(ds => console.log(`      - ${ds.id}`))
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`)
    }
    
    // Test 2: List tables in our dataset
    console.log('\n2. Listing tables in dataset...')
    try {
      const [tables] = await client.dataset(dataset).getTables()
      console.log(`   ✅ Found ${tables.length} tables:`)
      tables.slice(0, 10).forEach(table => console.log(`      - ${table.id}`))
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`)
    }
    
    // Test 3: Check if our table exists
    console.log('\n3. Checking for seller-search_query_performance table...')
    try {
      const [exists] = await client
        .dataset(dataset)
        .table('seller-search_query_performance')
        .exists()
      
      console.log(`   ${exists ? '✅' : '❌'} Table ${exists ? 'exists' : 'does not exist'}`)
    } catch (error: any) {
      console.log(`   ❌ Error checking table: ${error.message}`)
    }
    
    // Test 4: Get table metadata
    console.log('\n4. Getting table metadata...')
    try {
      const table = client.dataset(dataset).table('seller-search_query_performance')
      const [metadata] = await table.getMetadata()
      
      console.log('   ✅ Table metadata:')
      console.log(`      - Type: ${metadata.type}`)
      console.log(`      - Created: ${new Date(parseInt(metadata.creationTime)).toISOString()}`)
      console.log(`      - Rows: ${metadata.numRows || 'Unknown'}`)
      console.log(`      - Schema fields: ${metadata.schema?.fields?.length || 0}`)
      
      if (metadata.schema?.fields) {
        console.log('\n   First 10 columns:')
        metadata.schema.fields.slice(0, 10).forEach((field: any) => {
          console.log(`      - ${field.name} (${field.type})`)
        })
      }
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}`)
    }
    
    // Test 5: Run a simple query
    console.log('\n5. Running test queries...')
    
    const queries = [
      {
        name: 'Count with Date column',
        sql: `SELECT COUNT(*) as count FROM \`${projectId}.${dataset}.seller-search_query_performance\` WHERE \`Date\` >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)`
      },
      {
        name: 'Get column names',
        sql: `SELECT * FROM \`${projectId}.${dataset}.seller-search_query_performance\` LIMIT 1`
      },
      {
        name: 'Check specific columns',
        sql: `SELECT 
          \`Date\`,
          \`ASIN\`,
          \`Parent ASIN\`,
          \`Search Query\`,
          \`Impressions\`
        FROM \`${projectId}.${dataset}.seller-search_query_performance\` 
        LIMIT 5`
      }
    ]
    
    for (const queryDef of queries) {
      console.log(`\n   Testing: ${queryDef.name}`)
      console.log(`   Query: ${queryDef.sql}`)
      
      try {
        const [rows] = await client.query({ query: queryDef.sql })
        console.log(`   ✅ Success! Got ${rows.length} rows`)
        
        if (rows.length > 0) {
          if (queryDef.name === 'Get column names') {
            console.log('   Column names:')
            Object.keys(rows[0]).forEach(col => console.log(`      - ${col}`))
          } else {
            console.log('   Result:', JSON.stringify(rows[0], null, 2))
          }
        }
      } catch (error: any) {
        console.log(`   ❌ Failed: ${error.message}`)
        if (error.errors) {
          console.log('   Error details:', JSON.stringify(error.errors, null, 2))
        }
      }
    }
    
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message)
    console.error(error.stack)
  }
}

testDirectBigQuery().catch(console.error)