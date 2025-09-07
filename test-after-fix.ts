import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testAfterFix() {
  console.log('Testing refresh system after RPC fix...\n')
  
  // 1. Test if the RPC function works now
  console.log('=== Testing Fixed RPC Function ===')
  const { data: columns, error: rpcError } = await supabase
    .rpc('get_table_columns', {
      p_schema_name: 'sqp',
      p_table_name: 'webhook_configs'
    })
  
  if (rpcError) {
    console.error('❌ RPC still has error:', rpcError)
  } else {
    console.log('✅ RPC function works! Found columns:', columns?.map(c => c.column_name).join(', '))
  }
  
  // 2. Test refreshing a small table
  console.log('\n=== Testing Edge Function Refresh ===')
  console.log('Attempting to refresh webhook_configs table...')
  
  const testConfig = {
    id: 9,
    table_schema: 'sqp',
    table_name: 'webhook_configs',
    refresh_frequency_hours: 24,
    priority: 100
  }
  
  const { data: refreshResult, error: refreshError } = await supabase.functions.invoke('refresh-generic-table', {
    body: { 
      config: testConfig,
      auditLogId: null
    }
  })
  
  if (refreshError) {
    console.error('❌ Refresh error:', refreshError.context?.status)
    // Try to read error details
    if (refreshError.context?.body) {
      try {
        const reader = refreshError.context.body.getReader()
        const { value } = await reader.read()
        const text = new TextDecoder().decode(value)
        console.log('Error details:', text)
      } catch (e) {
        // Ignore
      }
    }
  } else {
    console.log('✅ Refresh succeeded!', refreshResult)
  }
  
  // 3. Run the full orchestrator
  console.log('\n=== Running Full Refresh Orchestrator ===')
  const { data: orchestratorResult, error: orchestratorError } = await supabase.functions.invoke('daily-refresh-orchestrator')
  
  if (orchestratorError) {
    console.error('❌ Orchestrator error:', orchestratorError)
  } else {
    console.log('✅ Orchestrator result:', orchestratorResult)
  }
  
  // 4. Check if any data was refreshed
  console.log('\n=== Checking Refresh Results ===')
  
  // Check audit logs
  const { data: recentLogs, error: logError } = await supabase
    .from('refresh_audit_log')
    .select('*')
    .gte('refresh_started_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Last 10 minutes
    .order('refresh_started_at', { ascending: false })
  
  if (logError) {
    console.error('Error fetching logs:', logError)
  } else {
    console.log(`\nFound ${recentLogs?.length || 0} recent refresh attempts:`)
    recentLogs?.forEach(log => {
      console.log(`- ${log.table_name}: ${log.status} (${log.rows_processed || 0} rows)`)
      if (log.error_message) {
        console.log(`  Error: ${log.error_message}`)
      }
    })
  }
  
  // Check if tables have new data
  console.log('\n=== Checking Table Data ===')
  const tablesToCheck = ['webhook_configs', 'asin_performance_data']
  
  for (const table of tablesToCheck) {
    const { data: sample, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: false })
      .order('created_at', { ascending: false })
      .limit(1)
    
    console.log(`\n${table}: ${count || 0} total rows`)
    if (sample && sample.length > 0) {
      const created = new Date(sample[0].created_at)
      const minutesAgo = Math.floor((Date.now() - created.getTime()) / (1000 * 60))
      console.log(`  Most recent: created ${minutesAgo} minutes ago`)
    }
  }
  
  // Check updated refresh configs
  const { data: updatedConfigs } = await supabase
    .from('refresh_config')
    .select('table_name, last_refresh_at')
    .not('last_refresh_at', 'is', null)
    .order('last_refresh_at', { ascending: false })
    .limit(5)
  
  console.log('\n=== Recently Refreshed Tables ===')
  updatedConfigs?.forEach(config => {
    if (config.last_refresh_at) {
      const lastRefresh = new Date(config.last_refresh_at)
      const minutesAgo = Math.floor((Date.now() - lastRefresh.getTime()) / (1000 * 60))
      console.log(`- ${config.table_name}: refreshed ${minutesAgo} minutes ago`)
    }
  })
}

testAfterFix().catch(console.error)