#!/usr/bin/env node
import { BigQuery } from '@google-cloud/bigquery'
import * as dotenv from 'dotenv'

dotenv.config()

async function findLongAsinsByDate() {
  console.log('=== Search for Long ASINs by Date Range ===')
  
  const bigquery = new BigQuery({
    projectId: process.env.BIGQUERY_PROJECT_ID,
    credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}'),
    location: 'US'
  })

  const dataset = process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85'
  
  try {
    // Check different date ranges
    const dateRanges = [
      { start: '2025-08-01', end: '2025-08-31', label: 'August 2025' },
      { start: '2025-09-01', end: '2025-09-06', label: 'September 2025' },
      { start: '2025-07-01', end: '2025-07-31', label: 'July 2025' },
      { start: '2025-01-01', end: '2025-09-06', label: 'All of 2025' }
    ]
    
    for (const range of dateRanges) {
      console.log(`\n📊 Checking ${range.label} (${range.start} to ${range.end})...`)
      
      const query = {
        query: `
          SELECT 
            \`Child ASIN\` as asin,
            LENGTH(\`Child ASIN\`) as asin_length,
            COUNT(*) as records,
            MIN(\`End Date\`) as first_date,
            MAX(\`End Date\`) as last_date
          FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.seller-search_query_performance\`
          WHERE DATE(\`End Date\`) BETWEEN '${range.start}' AND '${range.end}'
            AND LENGTH(\`Child ASIN\`) > 10
          GROUP BY \`Child ASIN\`
          ORDER BY asin_length DESC, records DESC
          LIMIT 5
        `,
        useLegacySql: false
      }
      
      const [rows] = await bigquery.query(query)
      
      if (rows.length === 0) {
        console.log('  No ASINs longer than 10 characters found')
      } else {
        console.log(`  Found ${rows.length} long ASINs:`)
        rows.forEach((row: any) => {
          console.log(`    ${row.asin} (${row.asin_length} chars) - ${row.records} records`)
        })
      }
      
      // Also check total records in this range
      const countQuery = {
        query: `
          SELECT COUNT(*) as total
          FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.seller-search_query_performance\`
          WHERE DATE(\`End Date\`) BETWEEN '${range.start}' AND '${range.end}'
        `,
        useLegacySql: false
      }
      
      const [countRows] = await bigquery.query(countQuery)
      console.log(`  Total records in range: ${countRows[0].total}`)
    }
    
    // Check for any non-standard ASIN patterns
    console.log('\n📊 Checking for non-standard ASIN patterns...')
    const patternQuery = {
      query: `
        SELECT 
          \`Child ASIN\` as asin,
          LENGTH(\`Child ASIN\`) as len,
          COUNT(*) as count
        FROM \`${process.env.BIGQUERY_PROJECT_ID}.${dataset}.seller-search_query_performance\`
        WHERE \`Child ASIN\` NOT REGEXP '^B0[A-Z0-9]{8}$'
          AND \`Child ASIN\` IS NOT NULL
          AND \`Child ASIN\` != ''
        GROUP BY \`Child ASIN\`
        ORDER BY count DESC
        LIMIT 10
      `,
      useLegacySql: false
    }
    
    const [patternRows] = await bigquery.query(patternQuery)
    if (patternRows.length > 0) {
      console.log('Found non-standard ASINs:')
      patternRows.forEach((row: any) => {
        console.log(`  "${row.asin}" (${row.len} chars) - ${row.count} records`)
      })
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
  }
}

findLongAsinsByDate()
  .then(() => {
    console.log('\n✅ Analysis completed')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n❌ Failed:', err)
    process.exit(1)
  })