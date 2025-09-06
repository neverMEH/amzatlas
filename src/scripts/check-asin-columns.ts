#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

async function checkASINColumns() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    db: { schema: 'public' }
  })

  console.log('=== Checking ASIN Column Constraints ===\n')

  // Query to check all ASIN columns across all schemas
  const { data, error } = await supabase.rpc('sql', {
    query: `
      SELECT 
        table_schema,
        table_name,
        column_name,
        data_type,
        character_maximum_length,
        is_nullable
      FROM information_schema.columns
      WHERE column_name IN ('asin', 'child_asin')
        AND table_schema IN ('sqp', 'public')
      ORDER BY table_schema, table_name, column_name;
    `
  })

  if (error) {
    // Try a direct query if the SQL RPC doesn't exist
    const query = `
      SELECT 
        table_schema,
        table_name,
        column_name,
        data_type,
        character_maximum_length,
        is_nullable
      FROM information_schema.columns
      WHERE column_name IN ('asin', 'child_asin')
        AND table_schema IN ('sqp', 'public')
      ORDER BY table_schema, table_name, column_name;
    `
    
    // Use a different approach - query a known table to test connection
    const testQuery = await supabase.from('asin_performance_data').select('asin').limit(1)
    
    if (testQuery.error) {
      console.error('Error connecting to database:', testQuery.error)
      console.log('\nPlease run this query manually in Supabase SQL Editor:')
      console.log(query)
    } else {
      console.log('Connected to database. Please run this query in Supabase SQL Editor to check ASIN columns:')
      console.log(query)
    }
    return
  }

  if (!data || data.length === 0) {
    console.log('No ASIN columns found.')
    return
  }

  // Group by table
  const tables: Record<string, any[]> = {}
  data.forEach((col: any) => {
    const key = `${col.table_schema}.${col.table_name}`
    if (!tables[key]) tables[key] = []
    tables[key].push(col)
  })

  // Display results
  Object.entries(tables).forEach(([table, columns]) => {
    console.log(`\nTable: ${table}`)
    columns.forEach((col: any) => {
      const length = col.character_maximum_length || 'unlimited'
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'
      console.log(`  - ${col.column_name}: ${col.data_type}(${length}) ${nullable}`)
      
      if (col.character_maximum_length === 10) {
        console.log(`    ⚠️  WARNING: This column is limited to 10 characters!`)
      }
    })
  })

  // Check for any 11+ character ASINs currently in the database
  console.log('\n=== Checking for long ASINs in existing data ===\n')
  
  const checkTables = [
    'sqp.asin_performance_data',
    'sqp.search_query_performance',
    'sqp.daily_sqp_data'
  ]

  for (const tableName of checkTables) {
    const [schema, table] = tableName.split('.')
    try {
      const longASINQuery = await supabase
        .from(table)
        .select('asin')
        .gte('length(asin)', 11)
        .limit(5)

      if (longASINQuery.data && longASINQuery.data.length > 0) {
        console.log(`\nFound ${longASINQuery.data.length} long ASINs in ${tableName}:`)
        longASINQuery.data.forEach((row: any) => {
          console.log(`  - ${row.asin} (${row.asin.length} characters)`)
        })
      } else {
        console.log(`No long ASINs found in ${tableName}`)
      }
    } catch (e) {
      console.log(`Could not check ${tableName}`)
    }
  }
}

checkASINColumns()
  .then(() => {
    console.log('\n=== Check Complete ===')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })