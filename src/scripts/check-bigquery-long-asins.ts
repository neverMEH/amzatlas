#!/usr/bin/env node
import { BigQuery } from '@google-cloud/bigquery'
import * as dotenv from 'dotenv'

dotenv.config()

async function checkLongASINsInBigQuery() {
  console.log('=== Checking for Long ASINs in BigQuery ===\n')

  try {
    // Initialize BigQuery client
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}')
    const bigquery = new BigQuery({
      projectId: process.env.BIGQUERY_PROJECT_ID,
      credentials,
      location: process.env.BIGQUERY_LOCATION || 'US'
    })

    const dataset = process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85'
    
    // Query to check ASIN lengths in the main table
    const tableName = 'seller-search_query_performance'
    const query = `
      WITH asin_lengths AS (
        SELECT 
          \`Child ASIN\` as asin,
          LENGTH(\`Child ASIN\`) as asin_length,
          \`Product Name\` as product_name,
          COUNT(*) as record_count
        FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.${tableName}\`
        WHERE \`Child ASIN\` IS NOT NULL
        GROUP BY \`Child ASIN\`, \`Product Name\`
      )
      SELECT 
        asin_length,
        COUNT(DISTINCT asin) as unique_asins,
        SUM(record_count) as total_records,
        ARRAY_AGG(
          STRUCT(asin, product_name, record_count) 
          ORDER BY record_count DESC 
          LIMIT 5
        ) as example_asins
      FROM asin_lengths
      GROUP BY asin_length
      ORDER BY asin_length DESC
    `

    console.log('Running BigQuery analysis...\n')
    const [rows] = await bigquery.query({ query })

    // Display results
    console.log('ASIN Length Distribution in BigQuery:')
    console.log('=====================================')
    
    let totalLongASINs = 0
    let totalLongRecords = 0

    rows.forEach((row: any) => {
      console.log(`\nLength ${row.asin_length}: ${row.unique_asins} unique ASINs (${row.total_records} records)`)
      
      if (row.asin_length > 10) {
        totalLongASINs += row.unique_asins
        totalLongRecords += row.total_records
        
        console.log('  Examples:')
        row.example_asins.forEach((example: any) => {
          const truncatedTitle = example.product_name?.substring(0, 50) || 'No title'
          console.log(`    - ${example.asin}: "${truncatedTitle}..." (${example.record_count} records)`)
        })
      }
    })

    console.log('\n=== Summary ===')
    console.log(`Total ASINs longer than 10 characters: ${totalLongASINs}`)
    console.log(`Total records with long ASINs: ${totalLongRecords}`)

    // Additional query to check specific problem ASINs
    if (totalLongASINs > 0) {
      console.log('\n=== Checking Specific Long ASINs ===')
      
      const problemASINQuery = `
        SELECT DISTINCT
          \`Child ASIN\` as asin,
          \`Product Name\` as product_name,
          \`Brand Name\` as brand_name,
          COUNT(*) as occurrences
        FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.${tableName}\`
        WHERE LENGTH(\`Child ASIN\`) > 10
        GROUP BY \`Child ASIN\`, \`Product Name\`, \`Brand Name\`
        ORDER BY occurrences DESC
        LIMIT 10
      `

      const [problemRows] = await bigquery.query({ query: problemASINQuery })
      
      console.log('\nTop 10 Long ASINs by occurrence:')
      problemRows.forEach((row: any, idx: number) => {
        console.log(`${idx + 1}. ${row.asin} - ${row.brand_name || 'Unknown'} - "${row.product_name?.substring(0, 40)}..." (${row.occurrences} times)`)
      })
    }

    // Check date range of data with long ASINs
    const dateRangeQuery = `
      SELECT 
        MIN(\`Week Start Date\`) as earliest_date,
        MAX(\`Week Start Date\`) as latest_date,
        COUNT(DISTINCT \`Week Start Date\`) as unique_weeks
      FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.sqp_data\`
      WHERE LENGTH(\`Child ASIN\`) > 10
    `

    const [dateRows] = await bigquery.query({ query: dateRangeQuery })
    if (dateRows.length > 0) {
      console.log('\n=== Date Range for Long ASINs ===')
      console.log(`Earliest: ${dateRows[0].earliest_date}`)
      console.log(`Latest: ${dateRows[0].latest_date}`)
      console.log(`Unique weeks: ${dateRows[0].unique_weeks}`)
    }

  } catch (error) {
    console.error('Error querying BigQuery:', error)
    process.exit(1)
  }
}

checkLongASINsInBigQuery()
  .then(() => {
    console.log('\n=== Analysis Complete ===')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })