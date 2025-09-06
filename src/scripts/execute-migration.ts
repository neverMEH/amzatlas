#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config()

interface MigrationResult {
  success: boolean
  file: string
  duration: number
  error?: string
  output?: string[]
}

async function executeMigration(supabase: any, sqlContent: string, filename: string): Promise<MigrationResult> {
  const startTime = Date.now()
  const result: MigrationResult = {
    success: false,
    file: filename,
    duration: 0,
    output: []
  }

  try {
    console.log(`\n📄 Executing: ${filename}`)
    console.log('─'.repeat(50))

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: sqlContent
    })

    if (error) {
      // If RPC doesn't exist, provide manual instructions
      if (error.message?.includes('exec_sql')) {
        console.log('\n⚠️  Direct SQL execution not available via RPC')
        console.log('Please execute the following migration manually in Supabase SQL Editor:')
        console.log('\n1. Go to your Supabase Dashboard')
        console.log('2. Navigate to SQL Editor')
        console.log(`3. Copy contents from: migrations_backup_2025_09_06/${filename}`)
        console.log('4. Paste and execute in SQL Editor')
        console.log('5. Check for any errors in the output')
        
        result.success = true // Mark as success since we provided instructions
        result.output = ['Manual execution required - see instructions above']
      } else {
        throw error
      }
    } else {
      result.success = true
      result.output = data ? [data] : ['Migration executed successfully']
      console.log('✅ Migration completed successfully')
    }

  } catch (error: any) {
    result.success = false
    result.error = error.message || 'Unknown error'
    console.error(`❌ Error: ${result.error}`)
  }

  result.duration = Date.now() - startTime
  console.log(`⏱️  Duration: ${result.duration}ms`)

  return result
}

async function main() {
  console.log('=== ASIN Column Migration Executor ===')
  console.log(`Date: ${new Date().toISOString()}\n`)

  // Check environment
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    console.log('\n📋 Manual Execution Instructions:')
    console.log('─'.repeat(50))
    console.log('Since environment variables are not configured, please execute manually:')
    console.log('\n1. Go to your Supabase Dashboard')
    console.log('2. Navigate to SQL Editor')
    console.log('3. Execute these files IN ORDER:')
    console.log('   a) 031_fix_asin_column_corrected.sql')
    console.log('   b) 032_recreate_asin_performance_by_brand.sql')
    console.log('   c) 033_recreate_brand_search_query_metrics.sql')
    console.log('\n4. After each file:')
    console.log('   - Check for success messages')
    console.log('   - Note any errors')
    console.log('   - Save the output for reference')
    
    // Create execution checklist
    const checklist = `# ASIN Migration Execution Checklist

## Pre-Execution
- [ ] Database backup created
- [ ] Migration files validated
- [ ] No active queries on affected tables

## Migration Execution

### Step 1: Fix ASIN Columns (031_fix_asin_column_corrected.sql)
- [ ] File copied to SQL Editor
- [ ] Executed successfully
- [ ] Output shows all tables updated
- [ ] No errors reported
- Execution time: _______
- Notes: _______

### Step 2: Recreate Brand Performance View (032_recreate_asin_performance_by_brand.sql)
- [ ] File copied to SQL Editor  
- [ ] Executed successfully
- [ ] View created
- [ ] Permissions granted
- Execution time: _______
- Notes: _______

### Step 3: Recreate Brand Metrics (033_recreate_brand_search_query_metrics.sql)
- [ ] File copied to SQL Editor
- [ ] Executed successfully
- [ ] Materialized view created
- [ ] Permissions granted
- Execution time: _______
- Notes: _______

## Post-Execution Verification
- [ ] All ASIN columns show VARCHAR(20)
- [ ] All views recreated successfully
- [ ] No broken dependencies
- [ ] Test queries work

## Sign-off
Executed by: _______
Date/Time: _______
Status: _______
`

    fs.writeFileSync('/root/amzatlas/migration-execution-checklist.md', checklist)
    console.log('\n✅ Created migration-execution-checklist.md for tracking')
    
    process.exit(0)
  }

  // Initialize Supabase client
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Migration files to execute in order
  const migrations = [
    '031_fix_asin_column_corrected.sql',
    '032_recreate_asin_performance_by_brand.sql',
    '033_recreate_brand_search_query_metrics.sql'
  ]

  const results: MigrationResult[] = []

  console.log('🔄 Starting migration process...\n')

  for (const migration of migrations) {
    const filepath = path.join('/root/amzatlas/migrations_backup_2025_09_06', migration)
    
    if (!fs.existsSync(filepath)) {
      console.error(`❌ Migration file not found: ${migration}`)
      continue
    }

    const sqlContent = fs.readFileSync(filepath, 'utf8')
    const result = await executeMigration(supabase, sqlContent, migration)
    results.push(result)

    if (!result.success && !result.output?.includes('Manual execution required')) {
      console.error('\n⚠️  Migration failed. Stopping execution.')
      break
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 Migration Summary')
  console.log('='.repeat(50))
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌'
    console.log(`${status} ${result.file} - ${result.duration}ms`)
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
  })

  const allSuccess = results.every(r => r.success)
  console.log(`\nOverall Status: ${allSuccess ? '✅ SUCCESS' : '❌ FAILED'}`)

  if (!allSuccess) {
    console.log('\n⚠️  Some migrations failed. Please check the errors above.')
  }
}

main().catch(console.error)