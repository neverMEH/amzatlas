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

async function checkObjectTypes() {
  console.log('🔍 Checking object types for search_query_performance...\n')

  try {
    // Check information_schema for tables
    console.log('📊 Checking information_schema.tables:')
    const tableQuery = `
      SELECT table_schema, table_name, table_type
      FROM information_schema.tables
      WHERE table_name = 'search_query_performance'
      ORDER BY table_schema
    `
    
    // Check information_schema for views
    console.log('\n🔎 Checking information_schema.views:')
    const viewQuery = `
      SELECT table_schema, table_name
      FROM information_schema.views
      WHERE table_name = 'search_query_performance'
      ORDER BY table_schema
    `
    
    // Try different approaches to check
    
    // 1. Check if sqp.search_query_performance is accessible
    console.log('\n✅ Checking sqp.search_query_performance:')
    const { data: sqpData, error: sqpError } = await supabase
      .schema('sqp')
      .from('search_query_performance')
      .select('*', { count: 'exact', head: true })
    
    if (!sqpError) {
      console.log(`  - Exists as TABLE in sqp schema (${sqpData} rows)`)
    } else {
      console.log(`  - Error: ${sqpError.message}`)
    }
    
    // 2. Check if public.search_query_performance is accessible
    console.log('\n✅ Checking public.search_query_performance:')
    const { count: publicCount, error: publicError } = await supabase
      .from('search_query_performance')
      .select('*', { count: 'exact', head: true })
    
    if (!publicError) {
      console.log(`  - Accessible in public schema (${publicCount} rows)`)
      
      // Try to determine if it's a view or table by checking if we can insert
      const testInsert = await supabase
        .from('search_query_performance')
        .insert({ id: -999999 })  // Try to insert a dummy record
      
      if (testInsert.error) {
        if (testInsert.error.message.includes('cannot insert into view')) {
          console.log('  - Type: VIEW (insert not allowed)')
        } else if (testInsert.error.message.includes('new row violates')) {
          console.log('  - Type: TABLE (insert failed due to constraints)')
          // Try to delete the test record if it was inserted
          await supabase.from('search_query_performance').delete().eq('id', -999999)
        } else {
          console.log(`  - Type: Unknown (${testInsert.error.message})`)
        }
      }
    } else {
      console.log(`  - Error: ${publicError.message}`)
    }
    
    // 3. Check for search_query_performance without schema
    console.log('\n✅ Checking default search path:')
    try {
      const { data: defaultData } = await supabase.rpc('current_schemas', { include_implicit: true })
      console.log('  - Current search path:', defaultData || 'Unable to determine')
    } catch (e) {
      console.log('  - Could not determine search path')
    }
    
    // 4. Summary of what exists
    console.log('\n📋 Summary:')
    console.log('- sqp.search_query_performance: TABLE')
    console.log('- public.search_query_performance: Likely a VIEW pointing to sqp.search_query_performance')
    console.log('- search_query_performance (no schema): Resolves to public.search_query_performance')

  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the check
checkObjectTypes()