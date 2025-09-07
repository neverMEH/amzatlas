#!/usr/bin/env tsx
import { BigQuery } from '@google-cloud/bigquery'
import { getBigQueryConfig } from '../config/bigquery.config'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

async function checkBigQueryDates() {
  console.log('🔍 Checking date ranges in BigQuery...\n')

  try {
    const config = getBigQueryConfig()
    const bigquery = new BigQuery({
      projectId: config.projectId,
      credentials: config.credentials,
      location: config.location || 'US'
    })

    const dataset = config.datasets.production
    const tableName = 'seller-search_query_performance'
    
    // Get date range
    const query = `
      SELECT 
        MIN(Date) as earliest_date,
        MAX(Date) as latest_date,
        COUNT(*) as total_records
      FROM \`${config.projectId}.${dataset}.${tableName}\`
    `

    console.log('📊 Checking date range...')
    const [results] = await bigquery.query({ query })
    
    if (results.length > 0) {
      const row = results[0]
      console.log(`\nDate range:`)
      console.log(`- Earliest date: ${JSON.stringify(row.earliest_date)}`)
      console.log(`- Latest date: ${JSON.stringify(row.latest_date)}`)
      console.log(`- Total records: ${row.total_records}`)
      
      // Check for recent data
      const recentQuery = `
        SELECT 
          DATE(Date) as date,
          COUNT(*) as record_count
        FROM \`${config.projectId}.${dataset}.${tableName}\`
        WHERE DATE(Date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        GROUP BY date
        ORDER BY date DESC
        LIMIT 10
      `
      
      console.log('\n📅 Recent data availability:')
      const [recentData] = await bigquery.query({ recentQuery })
      
      if (recentData.length > 0) {
        recentData.forEach((row: any) => {
          const dateValue = row.date?.value || row.date
          console.log(`- ${dateValue}: ${row.record_count} records`)
        })
      } else {
        console.log('No data in the last 30 days')
      }
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the check
checkBigQueryDates()