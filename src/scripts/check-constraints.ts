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

async function checkConstraints() {
  console.log('🔍 Checking table constraints...\n')

  try {
    // Check constraints on sqp.search_query_performance
    const constraintQuery = `
      SELECT 
        tc.table_schema,
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema IN ('sqp', 'public')
        AND tc.table_name IN ('search_query_performance', 'asin_performance_data')
        AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      GROUP BY tc.table_schema, tc.table_name, tc.constraint_name, tc.constraint_type
      ORDER BY tc.table_schema, tc.table_name, tc.constraint_type
    `

    const { data: constraints, error } = await supabase.rpc('run_query', {
      query_text: constraintQuery
    })

    if (error) {
      // Try a simpler approach
      console.log('Using alternative method...')
      
      // Try to insert duplicate records to see what constraint is violated
      console.log('\n🧪 Testing sqp.asin_performance_data constraints:')
      const testRecord = {
        asin: 'TEST123',
        start_date: '2025-08-10',
        end_date: '2025-08-10'
      }
      
      // First insert
      const { error: firstInsert } = await supabase
        .from('asin_performance_data')
        .insert(testRecord)
      
      if (firstInsert) {
        console.log('First insert error:', firstInsert)
      } else {
        console.log('First insert successful')
        
        // Try duplicate
        const { error: dupInsert } = await supabase
          .from('asin_performance_data')
          .insert(testRecord)
        
        if (dupInsert) {
          console.log('Duplicate insert error (reveals constraint):', dupInsert.message)
        }
        
        // Clean up
        await supabase
          .from('asin_performance_data')
          .delete()
          .eq('asin', 'TEST123')
      }
      
      // Test search_query_performance
      console.log('\n🧪 Testing sqp.search_query_performance columns:')
      const { data: sqpTest, error: sqpError } = await supabase
        .from('search_query_performance')
        .select('id, asin_performance_id')
        .limit(1)
      
      if (sqpError) {
        console.log('Query error:', sqpError)
      } else if (sqpTest && sqpTest.length > 0) {
        console.log('Sample record:', sqpTest[0])
      }
      
    } else if (constraints) {
      console.log('📋 Table constraints:')
      constraints.forEach((row: any) => {
        console.log(`\n${row.table_schema}.${row.table_name}:`)
        console.log(`  ${row.constraint_name} (${row.constraint_type})`)
        console.log(`  Columns: ${row.columns}`)
      })
    }

    // Check if we're using the right schema
    console.log('\n📂 Checking which schema to use:')
    
    // Check sqp schema
    const { count: sqpCount } = await supabase
      .from('asin_performance_data')
      .select('*', { count: 'exact', head: true })
    
    console.log(`sqp.asin_performance_data count: ${sqpCount}`)
    
    // Check if there's a public version
    const { data: publicCheck, error: publicError } = await supabase
      .schema('public')
      .from('asin_performance_data')
      .select('*')
      .limit(1)
    
    if (publicError) {
      console.log('No public.asin_performance_data table')
    } else {
      console.log('public.asin_performance_data exists!')
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the check
checkConstraints()