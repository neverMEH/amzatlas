#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js'
import { BigQuery } from '@google-cloud/bigquery'
import { getBigQueryConfig } from '../config/bigquery.config'
import { getSupabaseConfig } from '../config/supabase.config'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

async function syncAsinDataFirst() {
  console.log('🔍 Syncing ASIN parent records first...\n')

  try {
    // Initialize clients
    const bigQueryConfig = getBigQueryConfig()
    const bigquery = new BigQuery({
      projectId: bigQueryConfig.projectId,
      credentials: bigQueryConfig.credentials,
      location: bigQueryConfig.location || 'US'
    })
    
    const supabaseConfig = getSupabaseConfig()
    const supabase = createClient(
      supabaseConfig.url,
      supabaseConfig.serviceRoleKey || supabaseConfig.anonKey
    )

    const dataset = bigQueryConfig.datasets.production
    const tableName = 'seller-search_query_performance'
    const dateStr = '2025-08-10'
    
    // First, get unique ASINs and dates from BigQuery
    const query = `
      SELECT DISTINCT
        COALESCE("Parent ASIN", "Child ASIN") as asin,
        DATE(Date) as date
      FROM \`${bigQueryConfig.projectId}.${dataset}.${tableName}\`
      WHERE DATE(Date) = '${dateStr}'
      AND "Parent ASIN" IS NOT NULL
    `

    console.log('📊 Fetching unique ASINs for date:', dateStr)
    const [rows] = await bigquery.query({ query })
    
    console.log(`Found ${rows.length} unique ASIN/date combinations`)
    
    // Transform to asin_performance_data records
    const asinRecords = rows.map((row: any) => {
      const date = row.date?.value || row.date
      const dateFormatted = date.split('T')[0]
      return {
        asin: row.asin,
        start_date: dateFormatted,
        end_date: dateFormatted
      }
    })
    
    console.log('\n📤 Inserting ASIN parent records...')
    
    // Insert in batches
    const batchSize = 100
    let totalInserted = 0
    
    for (let i = 0; i < asinRecords.length; i += batchSize) {
      const batch = asinRecords.slice(i, i + batchSize)
      
      const { error } = await supabase
        .from('asin_performance_data')
        .upsert(batch, {
          onConflict: 'asin,start_date,end_date'
        })
      
      if (error) {
        console.error(`Error inserting batch ${i / batchSize}:`, error)
      } else {
        totalInserted += batch.length
        console.log(`Inserted batch ${i / batchSize + 1}/${Math.ceil(asinRecords.length / batchSize)}`)
      }
    }
    
    console.log(`\n✅ Successfully inserted ${totalInserted} ASIN parent records`)
    
    // Now check if we have a valid parent record
    const sampleAsin = asinRecords[0]?.asin
    if (sampleAsin) {
      const { data: checkData, error: checkError } = await supabase
        .from('asin_performance_data')
        .select('*')
        .eq('asin', sampleAsin)
        .eq('start_date', dateStr)
        .single()
      
      if (checkData) {
        console.log('\n✅ Sample parent record verified:')
        console.log(`  ID: ${checkData.id}`)
        console.log(`  ASIN: ${checkData.asin}`)
        console.log(`  Date: ${checkData.start_date} to ${checkData.end_date}`)
      }
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the sync
syncAsinDataFirst()