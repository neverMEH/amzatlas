#!/usr/bin/env node
import { BigQuery } from '@google-cloud/bigquery'
import * as dotenv from 'dotenv'

dotenv.config()

async function checkBigQueryDates() {
  console.log('=== BigQuery Date Range Check ===\n')

  const bigquery = new BigQuery({
    projectId: process.env.BIGQUERY_PROJECT_ID,
    credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}'),
    location: 'US'
  })

  const dataset = process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85'
  
  try {
    // Check the date range of data in BigQuery
    console.log('📊 Checking date ranges in BigQuery...')
    const query = `
      SELECT 
        MIN(Date) as oldest_date,
        MAX(Date) as newest_date,
        COUNT(*) as total_rows,
        COUNT(DISTINCT \`Child ASIN\`) as unique_asins
      FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.seller-search_query_performance\`
    `
    
    const [result] = await bigquery.query({ query })
    if (result.length > 0) {
      const row = result[0]
      console.log(`Oldest data: ${row.oldest_date?.value || 'N/A'}`)
      console.log(`Newest data: ${row.newest_date?.value || 'N/A'}`)
      console.log(`Total rows: ${row.total_rows}`)
      console.log(`Unique ASINs: ${row.unique_asins}`)
      
      // Get recent dates with data
      console.log('\n📊 Recent dates with data:')
      const recentQuery = `
        SELECT 
          DATE(Date) as data_date,
          COUNT(*) as row_count,
          COUNT(DISTINCT \`Child ASIN\`) as asin_count
        FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.seller-search_query_performance\`
        WHERE DATE(Date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        GROUP BY data_date
        ORDER BY data_date DESC
        LIMIT 10
      `
      
      const [recentDates] = await bigquery.query({ recentQuery })
      recentDates.forEach((dateRow: any) => {
        const date = dateRow.data_date?.value?.split('T')[0] || dateRow.data_date
        console.log(`  ${date}: ${dateRow.row_count} rows, ${dateRow.asin_count} ASINs`)
      })
      
      // Check for any ASINs longer than 10 chars
      console.log('\n📊 Checking for long ASINs...')
      const longAsinQuery = `
        SELECT 
          LENGTH(\`Child ASIN\`) as child_len,
          LENGTH(\`Parent ASIN\`) as parent_len,
          COUNT(*) as count
        FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.seller-search_query_performance\`
        GROUP BY child_len, parent_len
        HAVING child_len > 10 OR parent_len > 10
        ORDER BY child_len DESC, parent_len DESC
      `
      
      const [longAsins] = await bigquery.query({ longAsinQuery })
      if (longAsins.length > 0) {
        console.log('Found ASINs longer than 10 characters:')
        longAsins.forEach((row: any) => {
          console.log(`  Child: ${row.child_len} chars, Parent: ${row.parent_len} chars - ${row.count} rows`)
        })
      } else {
        console.log('No ASINs longer than 10 characters found')
      }
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
  }
}

checkBigQueryDates()
  .then(() => {
    console.log('\n✅ Check completed')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n❌ Check failed:', err)
    process.exit(1)
  })