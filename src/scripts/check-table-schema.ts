#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkTableSchema() {
  console.log('🔍 Checking table schemas...\n')

  try {
    // Check asin_performance_data columns
    const { data: asinColumns, error: asinError } = await supabase
      .rpc('get_table_columns', { 
        schema_name: 'sqp', 
        table_name: 'asin_performance_data' 
      })

    if (!asinError && asinColumns) {
      console.log('📊 asin_performance_data columns:')
      asinColumns.forEach((col: any) => {
        console.log(`  - ${col.column_name} (${col.data_type})`)
      })
    }

    // Check search_query_performance columns
    const { data: sqpColumns, error: sqpError } = await supabase
      .rpc('get_table_columns', { 
        schema_name: 'sqp', 
        table_name: 'search_query_performance' 
      })

    if (!sqpError && sqpColumns) {
      console.log('\n📊 search_query_performance columns:')
      sqpColumns.forEach((col: any) => {
        console.log(`  - ${col.column_name} (${col.data_type})`)
      })
    }

    // If RPC doesn't exist, try a different approach
    if (asinError || sqpError) {
      console.log('\n💡 Using alternative method to check columns...')
      
      // Get a single row to see structure
      const { data: asinSample } = await supabase
        .from('asin_performance_data')
        .select('*')
        .limit(1)
      
      if (asinSample && asinSample.length > 0) {
        console.log('\n📊 asin_performance_data columns (from sample):')
        Object.keys(asinSample[0]).forEach(key => {
          console.log(`  - ${key}`)
        })
      }

      const { data: sqpSample } = await supabase
        .from('search_query_performance')
        .select('*')
        .limit(1)
      
      if (sqpSample && sqpSample.length > 0) {
        console.log('\n📊 search_query_performance columns (from sample):')
        Object.keys(sqpSample[0]).forEach(key => {
          console.log(`  - ${key}`)
        })
      }
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the check
checkTableSchema()