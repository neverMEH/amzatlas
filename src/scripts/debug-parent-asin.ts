#!/usr/bin/env node
import { BigQuery } from '@google-cloud/bigquery'
import * as dotenv from 'dotenv'

dotenv.config()

async function debugParentAsin() {
  console.log('=== Debug Parent ASIN Issue ===')
  
  const bigquery = new BigQuery({
    projectId: process.env.BIGQUERY_PROJECT_ID,
    credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}'),
    location: 'US'
  })

  const dataset = process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85'
  const tableName = 'seller-search_query_performance'
  
  try {
    // Get exact Parent ASIN value for the problematic ASIN
    console.log('\n📊 Checking exact Parent ASIN values...')
    const query = {
      query: `
        SELECT DISTINCT
          \`Parent ASIN\` as parent_asin,
          \`Child ASIN\` as child_asin,
          CAST(\`Parent ASIN\` AS STRING) as parent_str,
          LENGTH(\`Parent ASIN\`) as parent_len,
          LENGTH(CAST(\`Parent ASIN\` AS STRING)) as parent_str_len
        FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.${tableName}\`
        WHERE \`Child ASIN\` = 'B0FC18MGC7'
        LIMIT 5
      `,
      useLegacySql: false
    }
    
    const [rows] = await bigquery.query(query)
    console.log('Results:')
    rows.forEach((row: any) => {
      console.log(`Parent ASIN: "${row.parent_asin}"`)
      console.log(`  Type: ${typeof row.parent_asin}`)
      console.log(`  Length: ${row.parent_len}`)
      console.log(`  String Length: ${row.parent_str_len}`)
      console.log(`  Child ASIN: ${row.child_asin}`)
      console.log(`  Actual JS Length: ${row.parent_asin ? row.parent_asin.length : 'null'}`)
      
      // Check each character
      if (row.parent_asin) {
        console.log('  Character analysis:')
        for (let i = 0; i < row.parent_asin.length; i++) {
          console.log(`    [${i}]: "${row.parent_asin[i]}" (code: ${row.parent_asin.charCodeAt(i)})`)
        }
      }
    })
    
    // Also check what the sync service would see
    console.log('\n📊 Simulating sync service behavior...')
    const syncQuery = {
      query: `
        SELECT 
          COALESCE(\`Parent ASIN\`, \`Child ASIN\`) as asin,
          \`Parent ASIN\`,
          \`Child ASIN\`,
          Date
        FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.${tableName}\`
        WHERE \`Child ASIN\` = 'B0FC18MGC7'
        LIMIT 1
      `,
      useLegacySql: false
    }
    
    const [syncRows] = await bigquery.query(syncQuery)
    if (syncRows.length > 0) {
      const row = syncRows[0]
      console.log('\nSync would use:')
      console.log(`  ASIN (COALESCE result): "${row.asin}" (length: ${row.asin ? row.asin.length : 'null'})`)
      console.log(`  Parent ASIN: "${row['Parent ASIN']}" (length: ${row['Parent ASIN'] ? row['Parent ASIN'].length : 'null'})`)
      console.log(`  Child ASIN: "${row['Child ASIN']}" (length: ${row['Child ASIN'] ? row['Child ASIN'].length : 'null'})`)
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error('Stack:', error.stack)
  }
}

debugParentAsin()
  .then(() => {
    console.log('\n✅ Debug completed')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n❌ Failed:', err)
    process.exit(1)
  })