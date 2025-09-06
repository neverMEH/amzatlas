#!/usr/bin/env node
import { BigQuery } from '@google-cloud/bigquery'
import * as dotenv from 'dotenv'

dotenv.config()

async function checkBigQuerySchema() {
  console.log('=== BigQuery Schema Check ===')
  
  const bigquery = new BigQuery({
    projectId: process.env.BIGQUERY_PROJECT_ID,
    credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}'),
    location: 'US'
  })

  const dataset = process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85'
  const tableName = 'seller-search_query_performance'
  
  try {
    // Get table metadata
    console.log(`\n📊 Checking table: ${dataset}.${tableName}`)
    
    const [table] = await bigquery
      .dataset(dataset)
      .table(tableName)
      .get()
    
    const schema = table.metadata.schema
    
    console.log('\nTable Schema:')
    console.log('=============')
    
    schema.fields.forEach((field: any) => {
      console.log(`${field.name} (${field.type})`)
    })
    
    // Try a simple query with LIMIT 1 to see actual data
    console.log('\n📊 Sample data (first row):')
    const query = {
      query: `SELECT * FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.${tableName}\` LIMIT 1`,
      useLegacySql: false
    }
    
    const [rows] = await bigquery.query(query)
    if (rows.length > 0) {
      const sampleRow = rows[0]
      console.log('\nColumn values:')
      Object.keys(sampleRow).forEach(key => {
        const value = sampleRow[key]
        const displayValue = value?.toString().substring(0, 50) || 'null'
        console.log(`  ${key}: ${displayValue}`)
      })
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error('Details:', error)
  }
}

checkBigQuerySchema()
  .then(() => {
    console.log('\n✅ Schema check completed')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n❌ Failed:', err)
    process.exit(1)
  })