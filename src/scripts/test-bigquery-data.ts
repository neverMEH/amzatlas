#!/usr/bin/env tsx
import { BigQuery } from '@google-cloud/bigquery'
import { getBigQueryConfig } from '../config/bigquery.config'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

async function testBigQueryData() {
  console.log('🔍 Testing BigQuery data structure...\n')

  try {
    const config = getBigQueryConfig()
    const bigquery = new BigQuery({
      projectId: config.projectId,
      credentials: config.credentials,
      location: config.location || 'US'
    })

    const dataset = config.datasets.production
    const tableName = 'seller-search_query_performance'
    
    // Get a sample of data to see the actual structure
    const query = `
      SELECT *
      FROM \`${config.projectId}.${dataset}.${tableName}\`
      LIMIT 5
    `

    console.log('📊 Fetching sample data from BigQuery...')
    console.log(`Table: ${dataset}.${tableName}\n`)

    const [rows] = await bigquery.query({ query })

    console.log(`Found ${rows.length} rows. Structure:`)
    
    if (rows.length > 0) {
      // Show the first row's structure
      const firstRow = rows[0]
      console.log('\nFirst row keys:')
      Object.keys(firstRow).forEach(key => {
        const value = firstRow[key]
        const valueType = typeof value
        const preview = value ? String(value).substring(0, 50) : 'null'
        console.log(`  "${key}": ${valueType} - ${preview}${String(value).length > 50 ? '...' : ''}`)
      })
      
      console.log('\nSample data:')
      rows.forEach((row, index) => {
        console.log(`\nRow ${index + 1}:`)
        console.log(`  ASIN: ${row.ASIN || row.asin || 'NOT FOUND'}`)
        console.log(`  Search Query: ${row['Search Query'] || row.search_query || 'NOT FOUND'}`)
        console.log(`  Start Date: ${row['Start Date'] || row.start_date || 'NOT FOUND'}`)
        console.log(`  End Date: ${row['End Date'] || row.end_date || 'NOT FOUND'}`)
        console.log(`  Impressions: ${row.Impressions || row.impressions || 'NOT FOUND'}`)
      })
    }

    // Test the transformation for asin_performance_data_id
    console.log('\n🔄 Testing transformation:')
    if (rows.length > 0) {
      const row = rows[0]
      const asinField = row.ASIN || row.asin || row.Asin || 'MISSING'
      const startDate = row['Start Date'] || row.start_date || 'MISSING'
      const endDate = row['End Date'] || row.end_date || 'MISSING'
      
      const transformedId = `${asinField}_${startDate}_${endDate}`
      console.log(`  ASIN field value: "${asinField}"`)
      console.log(`  Start Date: "${startDate}"`)
      console.log(`  End Date: "${endDate}"`)
      console.log(`  Transformed ID: "${transformedId}"`)
      
      // Check for date object vs string
      if (startDate && typeof startDate === 'object') {
        console.log('\n⚠️  Dates are objects, not strings!')
        console.log(`  Start Date object:`, startDate)
        if (startDate.value) {
          console.log(`  Start Date value: ${startDate.value}`)
        }
      }
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the test
testBigQueryData()