#!/usr/bin/env npx tsx
import { getFileBigQueryClient } from '../config/bigquery-file-auth.config'
import { getBigQueryConfig } from '../config/bigquery.config'

async function checkBigQuerySchema() {
  console.log('🔍 Checking BigQuery table schema...\n')
  
  try {
    const client = getFileBigQueryClient()
    const config = getBigQueryConfig()
    const dataset = config.datasets.production
    const projectId = config.projectId
    
    console.log(`Project: ${projectId}`)
    console.log(`Dataset: ${dataset}\n`)
    
    // Query to get table schema
    const schemaQuery = `
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable
      FROM \`${projectId}.${dataset}.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = 'seller-search_query_performance'
      ORDER BY ordinal_position
      LIMIT 50
    `
    
    console.log('Querying table schema...')
    const [columns] = await client.query({ query: schemaQuery })
    
    if (columns.length === 0) {
      console.log('❌ No columns found. Table might not exist or might have a different name.')
      
      // Try to list all tables
      const tablesQuery = `
        SELECT table_name 
        FROM \`${projectId}.${dataset}.INFORMATION_SCHEMA.TABLES\`
        ORDER BY table_name
      `
      
      console.log('\nListing all tables in dataset:')
      const [tables] = await client.query({ query: tablesQuery })
      
      tables.forEach(table => {
        console.log(`  - ${table.table_name}`)
      })
    } else {
      console.log(`✅ Found ${columns.length} columns in seller-search_query_performance:\n`)
      
      // Group by table and display
      const tableColumns: Record<string, any[]> = {}
      columns.forEach(col => {
        if (!tableColumns[col.table_name]) {
          tableColumns[col.table_name] = []
        }
        tableColumns[col.table_name].push(col)
      })
      
      Object.entries(tableColumns).forEach(([tableName, cols]) => {
        console.log(`Table: ${tableName}`)
        console.log('-'.repeat(60))
        cols.forEach(col => {
          console.log(`  ${col.column_name.padEnd(40)} ${col.data_type.padEnd(20)} ${col.is_nullable}`)
        })
        console.log()
      })
    }
    
    // Try a sample query with proper column names
    console.log('\nTesting sample query...')
    const sampleQuery = `
      SELECT *
      FROM \`${projectId}.${dataset}.\`seller-search_query_performance\`\`
      LIMIT 1
    `
    
    try {
      const [sample] = await client.query({ query: sampleQuery })
      if (sample.length > 0) {
        console.log('✅ Sample row column names:')
        Object.keys(sample[0]).forEach(key => {
          console.log(`  - ${key}`)
        })
      }
    } catch (error: any) {
      console.error('❌ Sample query failed:', error.message)
      
      // Try with backticks around table name
      console.log('\nTrying with backticks...')
      const backtickQuery = `
        SELECT *
        FROM \`${projectId}.${dataset}.\`seller-search_query_performance\`\`
        LIMIT 1
      `
      
      try {
        const [sample] = await client.query({ query: backtickQuery })
        if (sample.length > 0) {
          console.log('✅ Sample row column names (with backticks):')
          Object.keys(sample[0]).forEach(key => {
            console.log(`  - ${key}`)
          })
        }
      } catch (error2: any) {
        console.error('❌ Backtick query also failed:', error2.message)
      }
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    if (error.errors) {
      console.error('Details:', JSON.stringify(error.errors, null, 2))
    }
  }
}

checkBigQuerySchema().catch(console.error)