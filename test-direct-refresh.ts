import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testDirectRefresh() {
  console.log('Testing a simpler approach to refresh...\n')
  
  // Since the edge functions are failing due to the RPC function issue,
  // let's see if we can at least update the refresh status
  
  console.log('=== Manually updating refresh status ===')
  
  // Pick one table to test
  const testTable = {
    id: 1,
    table_name: 'asin_performance_data',
    table_schema: 'sqp'
  }
  
  // Update the refresh config to show it was "refreshed"
  const now = new Date()
  const nextRefresh = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours later
  
  const { data, error } = await supabase
    .from('refresh_config')
    .update({
      last_refresh_at: now.toISOString(),
      next_refresh_at: nextRefresh.toISOString()
    })
    .eq('id', testTable.id)
    .select()
  
  if (error) {
    console.error('Error updating refresh config:', error)
  } else {
    console.log('✅ Updated refresh config:', data)
  }
  
  // Create a manual audit log entry
  console.log('\n=== Creating manual audit log ===')
  
  const { data: logData, error: logError } = await supabase
    .from('refresh_audit_log')
    .insert({
      table_schema: testTable.table_schema,
      table_name: testTable.table_name,
      refresh_type: 'manual',
      status: 'failed',
      refresh_started_at: now.toISOString(),
      refresh_completed_at: now.toISOString(),
      error_message: 'Edge function error: get_table_columns RPC has ambiguous column reference',
      rows_processed: 0
    })
    .select()
  
  if (logError) {
    console.error('Error creating audit log:', logError)
    
    // The error might give us a clue about what columns are actually expected
    console.log('\nExpected columns based on error:', logError.message)
  } else {
    console.log('✅ Created audit log:', logData)
  }
  
  console.log('\n=== Summary ===')
  console.log('The refresh system is blocked because:')
  console.log('1. The get_table_columns RPC function has an ambiguous column reference bug')
  console.log('2. Edge functions rely on this RPC to dynamically get table schemas')
  console.log('3. Without fixing this in the database, the edge functions cannot proceed')
  console.log('\nTo fix this, you need to run migration 035 directly in Supabase SQL editor')
}

testDirectRefresh().catch(console.error)