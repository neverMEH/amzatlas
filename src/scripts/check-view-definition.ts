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

async function checkViewDefinition() {
  console.log('🔍 Checking view definitions...\n')

  try {
    // Query to get view definition
    const query = `
      SELECT 
        n.nspname as schema_name,
        c.relname as view_name,
        pg_get_viewdef(c.oid, true) as definition
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'v'
        AND c.relname IN ('asin_performance_by_brand', 'asin_performance_data')
        AND n.nspname = 'public'
      ORDER BY c.relname;
    `

    // Try to execute the query
    const { data, error } = await supabase.rpc('execute_sql', {
      query: query
    })

    if (error) {
      console.log('Could not execute SQL query via RPC')
      
      // Let's try a different approach - check what columns the view has
      console.log('\nChecking view columns instead:')
      
      const { data: viewData, error: viewError } = await supabase
        .from('asin_performance_by_brand')
        .select('*')
        .limit(1)
      
      if (viewError) {
        console.error('Error accessing asin_performance_by_brand:', viewError)
        console.log('\nThe view might not exist or we lack permissions.')
      } else if (viewData && viewData.length > 0) {
        console.log('\nasin_performance_by_brand columns:')
        Object.keys(viewData[0]).forEach(col => {
          console.log(`  - ${col}`)
        })
        
        console.log('\nSample data:')
        console.log(JSON.stringify(viewData[0], null, 2))
      } else {
        console.log('View exists but has no data')
      }
      
      // Also check for brand-related tables
      console.log('\n📊 Checking for brand-related tables:')
      
      // Check brands table
      const { data: brandData, error: brandError } = await supabase
        .from('brands')
        .select('*')
        .limit(1)
      
      if (!brandError && brandData) {
        console.log('\nbrands table exists with columns:')
        if (brandData.length > 0) {
          Object.keys(brandData[0]).forEach(col => {
            console.log(`  - ${col}`)
          })
        }
      } else {
        console.log('No brands table found in public schema')
      }
      
    } else if (data) {
      console.log('View definitions:')
      data.forEach((row: any) => {
        console.log(`\n=== ${row.schema_name}.${row.view_name} ===`)
        console.log(row.definition)
      })
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the check
checkViewDefinition()