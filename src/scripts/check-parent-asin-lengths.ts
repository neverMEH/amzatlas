#!/usr/bin/env node
import { BigQuery } from '@google-cloud/bigquery'
import * as dotenv from 'dotenv'

dotenv.config()

async function checkParentAsinLengths() {
  console.log('=== Parent ASIN Length Analysis ===')
  
  const bigquery = new BigQuery({
    projectId: process.env.BIGQUERY_PROJECT_ID,
    credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}'),
    location: 'US'
  })

  const dataset = process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85'
  const tableName = 'seller-search_query_performance'
  
  try {
    // Check Parent ASIN lengths
    console.log('\n📊 Checking Parent ASIN lengths...')
    const parentQuery = {
      query: `
        SELECT 
          LENGTH(\`Parent ASIN\`) as asin_length,
          COUNT(DISTINCT \`Parent ASIN\`) as unique_asins,
          COUNT(*) as total_records
        FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.${tableName}\`
        WHERE \`Parent ASIN\` IS NOT NULL
        GROUP BY asin_length
        ORDER BY asin_length DESC
      `,
      useLegacySql: false
    }
    
    const [parentRows] = await bigquery.query(parentQuery)
    console.log('\nParent ASIN Length Distribution:')
    console.log('================================')
    parentRows.forEach((row: any) => {
      console.log(`Length ${row.asin_length}: ${row.unique_asins} unique ASINs (${row.total_records} records)`)
    })
    
    // Check for long Parent ASINs
    console.log('\n📊 Long Parent ASINs (> 10 chars):')
    const longParentQuery = {
      query: `
        SELECT 
          \`Parent ASIN\` as asin,
          LENGTH(\`Parent ASIN\`) as asin_length,
          MIN(Date) as first_date,
          MAX(Date) as last_date,
          COUNT(*) as records
        FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.${tableName}\`
        WHERE LENGTH(\`Parent ASIN\`) > 10
        GROUP BY \`Parent ASIN\`
        ORDER BY asin_length DESC, records DESC
        LIMIT 10
      `,
      useLegacySql: false
    }
    
    const [longParents] = await bigquery.query(longParentQuery)
    if (longParents.length > 0) {
      console.log('Found long Parent ASINs:')
      longParents.forEach((row: any) => {
        const firstDate = row.first_date?.value?.split('T')[0] || 'unknown'
        const lastDate = row.last_date?.value?.split('T')[0] || 'unknown'
        console.log(`  ${row.asin} (${row.asin_length} chars) - ${row.records} records [${firstDate} to ${lastDate}]`)
      })
    }
    
    // Check Child ASIN lengths for comparison
    console.log('\n📊 Child ASIN Length Distribution:')
    const childQuery = {
      query: `
        SELECT 
          LENGTH(\`Child ASIN\`) as asin_length,
          COUNT(DISTINCT \`Child ASIN\`) as unique_asins,
          COUNT(*) as total_records
        FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.${tableName}\`
        WHERE \`Child ASIN\` IS NOT NULL
        GROUP BY asin_length
        ORDER BY asin_length DESC
      `,
      useLegacySql: false
    }
    
    const [childRows] = await bigquery.query(childQuery)
    console.log('================================')
    childRows.forEach((row: any) => {
      console.log(`Length ${row.asin_length}: ${row.unique_asins} unique ASINs (${row.total_records} records)`)
    })
    
    // Check for the specific ASIN that was causing issues
    console.log('\n📊 Checking specific ASIN B0FM1J8DXM:')
    const specificQuery = {
      query: `
        SELECT 
          \`Parent ASIN\`,
          \`Child ASIN\`,
          COUNT(*) as records,
          MIN(Date) as first_date,
          MAX(Date) as last_date
        FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.${tableName}\`
        WHERE \`Parent ASIN\` = 'B0FM1J8DXM' OR \`Child ASIN\` = 'B0FM1J8DXM'
        GROUP BY \`Parent ASIN\`, \`Child ASIN\`
        ORDER BY records DESC
        LIMIT 5
      `,
      useLegacySql: false
    }
    
    const [specificRows] = await bigquery.query(specificQuery)
    if (specificRows.length > 0) {
      console.log('Found records with B0FM1J8DXM:')
      specificRows.forEach((row: any) => {
        const firstDate = row.first_date?.value?.split('T')[0] || 'unknown'
        const lastDate = row.last_date?.value?.split('T')[0] || 'unknown'
        console.log(`  Parent: ${row['Parent ASIN']}, Child: ${row['Child ASIN']} - ${row.records} records [${firstDate} to ${lastDate}]`)
      })
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
  }
}

checkParentAsinLengths()
  .then(() => {
    console.log('\n✅ Analysis completed')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n❌ Failed:', err)
    process.exit(1)
  })