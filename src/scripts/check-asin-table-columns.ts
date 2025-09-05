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

async function checkColumns() {
  console.log('🔍 Checking asin_performance_data columns...\n')

  try {
    // Get columns from asin_performance_data
    const { data: asinData, error: asinError } = await supabase
      .from('asin_performance_data')
      .select('*')
      .limit(1)
    
    if (!asinError && asinData && asinData.length > 0) {
      console.log('sqp.asin_performance_data columns:')
      Object.keys(asinData[0]).forEach(col => {
        const value = asinData[0][col]
        const type = value === null ? 'null' : typeof value
        console.log(`  - ${col} (${type})`)
      })
      
      console.log('\nChecking if brand_id exists:', 'brand_id' in asinData[0])
      
      // If brand_id doesn't exist, let's check how brands are linked
      if (!('brand_id' in asinData[0])) {
        console.log('\n⚠️  No brand_id column found in asin_performance_data')
        console.log('Checking for brand mapping table...')
        
        // Check for asin_brands table
        const { data: asinBrandData, error: asinBrandError } = await supabase
          .from('asin_brands')
          .select('*')
          .limit(1)
        
        if (!asinBrandError && asinBrandData) {
          console.log('\nFound asin_brands mapping table with columns:')
          if (asinBrandData.length > 0) {
            Object.keys(asinBrandData[0]).forEach(col => {
              console.log(`  - ${col}`)
            })
          }
        } else {
          console.log('No asin_brands mapping table found')
        }
      }
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the check
checkColumns()