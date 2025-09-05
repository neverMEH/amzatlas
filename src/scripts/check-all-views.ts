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

async function checkAllViews() {
  console.log('🔍 Checking all views in the database...\n')

  try {
    // Query to list all views
    const viewQuery = `
      SELECT 
        n.nspname as schema_name,
        c.relname as view_name,
        CASE c.relkind 
          WHEN 'v' THEN 'VIEW'
          WHEN 'm' THEN 'MATERIALIZED VIEW'
        END as view_type,
        obj_description(c.oid) as comment
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('v', 'm')
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY n.nspname, c.relkind DESC, c.relname
    `

    // Query to check which views depend on ASIN columns
    const asinDepsQuery = `
      SELECT DISTINCT
        v.table_schema as view_schema,
        v.table_name as view_name,
        v.view_definition
      FROM information_schema.views v
      WHERE v.view_definition ILIKE '%asin%'
        AND v.table_schema IN ('public', 'sqp')
      ORDER BY v.table_schema, v.table_name
    `

    // Check if we can access views
    console.log('📋 Attempting to list all views...')
    
    // First, let's check what views we can see through information_schema
    const { data: viewList, error: viewError } = await supabase
      .from('pg_catalog.pg_views')
      .select('schemaname, viewname')
      .or('schemaname.eq.public,schemaname.eq.sqp')
      
    if (viewError) {
      console.log('Cannot access pg_views, trying alternative approach...')
      
      // Try to check specific views we know about
      const knownViews = [
        { schema: 'public', name: 'asin_performance_data' },
        { schema: 'public', name: 'asin_performance_by_brand' },
        { schema: 'public', name: 'search_performance_summary' },
        { schema: 'public', name: 'search_query_performance' },
        { schema: 'sqp', name: 'search_query_performance' },
        { schema: 'sqp', name: 'brand_search_query_metrics' }
      ]
      
      console.log('\n🔎 Checking known views:')
      
      for (const view of knownViews) {
        try {
          // Try to query the view
          const { count, error } = await supabase
            .from(`${view.name}`)
            .select('*', { count: 'exact', head: true })
          
          if (!error) {
            console.log(`✅ ${view.schema}.${view.name} exists (${count} rows)`)
          } else {
            console.log(`❌ ${view.schema}.${view.name} - ${error.message}`)
          }
        } catch (e) {
          console.log(`❌ ${view.schema}.${view.name} - Error accessing`)
        }
      }
      
      // Check table structure
      console.log('\n📊 Checking sqp.search_query_performance columns:')
      const { data: sqpData, error: sqpError } = await supabase
        .from('search_query_performance')
        .select('*')
        .limit(1)
      
      if (!sqpError && sqpData && sqpData.length > 0) {
        const columns = Object.keys(sqpData[0])
        console.log('Columns:', columns.join(', '))
        console.log('Has ASIN column:', columns.includes('asin'))
      }
      
    } else {
      console.log('\nFound views:')
      viewList?.forEach(v => {
        console.log(`- ${v.schemaname}.${v.viewname}`)
      })
    }

  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the check
checkAllViews()