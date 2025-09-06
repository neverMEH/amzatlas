#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

interface MigrationStatus {
  step: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  details?: any
  error?: string
}

async function checkMigrationStatus(): Promise<MigrationStatus[]> {
  const statuses: MigrationStatus[] = []
  
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('⚠️  Cannot connect to Supabase - please check migration status manually')
    console.log('\nManual Verification Steps:')
    console.log('1. Check if migrations are running: Look for active queries in Supabase Dashboard > Database > Query Performance')
    console.log('2. Monitor resource usage: Check Database > Health for CPU/Memory spikes')
    console.log('3. Watch for errors: SQL Editor will show any errors in red')
    return statuses
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Check 1: ASIN column sizes
  console.log('\n📊 Checking ASIN column sizes...')
  try {
    const { data: columns, error } = await supabase.rpc('sql', {
      query: `
        SELECT 
          table_schema,
          table_name,
          column_name,
          character_maximum_length
        FROM information_schema.columns
        WHERE column_name = 'asin'
          AND table_schema IN ('sqp', 'public')
        ORDER BY table_schema, table_name
      `
    }).single()

    if (!error && columns) {
      const allUpdated = columns.every((col: any) => col.character_maximum_length === 20)
      statuses.push({
        step: 'ASIN Column Update',
        status: allUpdated ? 'completed' : 'pending',
        details: columns
      })
    }
  } catch (e) {
    // Try direct table query as fallback
    const { data, error } = await supabase
      .from('asin_performance_data')
      .select('asin')
      .limit(1)
    
    if (!error) {
      console.log('✅ Can connect to database')
      console.log('⚠️  Cannot check column sizes via RPC - verify manually in SQL Editor')
    }
  }

  // Check 2: View existence
  console.log('\n🔍 Checking views...')
  const viewsToCheck = [
    'public.asin_performance_data',
    'public.asin_performance_by_brand',
    'public.search_performance_summary'
  ]

  for (const viewName of viewsToCheck) {
    const [schema, view] = viewName.split('.')
    try {
      const { count, error } = await supabase
        .from(view)
        .select('*', { count: 'exact', head: true })
      
      statuses.push({
        step: `View: ${viewName}`,
        status: error ? 'failed' : 'completed',
        error: error?.message
      })
    } catch (e) {
      statuses.push({
        step: `View: ${viewName}`,
        status: 'pending',
        error: 'Cannot verify - check manually'
      })
    }
  }

  return statuses
}

async function generateMigrationReport() {
  console.log('=== Migration Progress Monitor ===')
  console.log(`Time: ${new Date().toLocaleString()}\n`)

  const statuses = await checkMigrationStatus()

  if (statuses.length === 0) {
    console.log('📋 Migration Progress Tracking Sheet')
    console.log('─'.repeat(50))
    console.log('\n⏱️  Timing Guide:')
    console.log('- Step 1 (ASIN columns): 30-60 seconds')
    console.log('- Step 2 (Brand view): 5-10 seconds')
    console.log('- Step 3 (Metrics view): 10-20 seconds')
    console.log('- Total expected time: 1-2 minutes')
    
    console.log('\n📊 What to Monitor:')
    console.log('1. SQL Editor output - Look for NOTICE messages')
    console.log('2. Database health - CPU should spike briefly')
    console.log('3. Active queries - Should see your migration running')
    
    console.log('\n🚨 Warning Signs:')
    console.log('- Execution taking > 5 minutes')
    console.log('- Error messages in red')
    console.log('- Database becoming unresponsive')
    console.log('- Locks on tables')
    
    console.log('\n✅ Success Indicators:')
    console.log('- "Migration Complete" message')
    console.log('- "CREATE VIEW" success messages')
    console.log('- Quick execution times')
    console.log('- No error messages')
    
    return
  }

  // Display status summary
  console.log('\n📊 Migration Status Summary:')
  console.log('─'.repeat(50))
  
  statuses.forEach(status => {
    const icon = status.status === 'completed' ? '✅' : 
                 status.status === 'failed' ? '❌' : 
                 status.status === 'running' ? '🔄' : '⏳'
    
    console.log(`${icon} ${status.step}: ${status.status}`)
    if (status.error) {
      console.log(`   └─ Error: ${status.error}`)
    }
  })

  // Overall assessment
  const completed = statuses.filter(s => s.status === 'completed').length
  const failed = statuses.filter(s => s.status === 'failed').length
  const pending = statuses.filter(s => s.status === 'pending').length

  console.log('\n📈 Progress Overview:')
  console.log(`Completed: ${completed}/${statuses.length}`)
  console.log(`Failed: ${failed}/${statuses.length}`)
  console.log(`Pending: ${pending}/${statuses.length}`)

  if (completed === statuses.length) {
    console.log('\n🎉 Migration appears to be complete!')
  } else if (failed > 0) {
    console.log('\n⚠️  Some steps have failed - check errors above')
  } else {
    console.log('\n🔄 Migration in progress or pending manual execution')
  }
}

generateMigrationReport()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })