import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugRefresh() {
  console.log('Debugging why refresh didn\'t update data...\n')
  
  // 1. Check if the edge functions are using the correct tables
  console.log('=== Edge Function Test ===')
  console.log('Invoking refresh for a specific table...')
  
  // Try to refresh just one small table
  const { data, error } = await supabase.functions.invoke('refresh-generic-table', {
    body: {
      config: {
        table_schema: 'sqp',
        table_name: 'daily_sqp_data',
        refresh_frequency_hours: 24
      },
      auditLogId: 999 // dummy ID for testing
    }
  })
  
  if (error) {
    console.error('Edge function error:', error)
  } else {
    console.log('Edge function response:', data)
  }
  
  // 2. Check if BigQuery connection is working
  console.log('\n=== Checking for Error Logs ===')
  
  // Since we can't access the actual edge function logs, let's check if there's 
  // any audit log that might have been created
  const { data: recentLogs, error: logError } = await supabase
    .from('refresh_audit_log')
    .select('*')
    .gte('refresh_started_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
    .order('refresh_started_at', { ascending: false })
  
  if (logError) {
    console.error('Error fetching logs:', logError)
  } else {
    console.log(`Found ${recentLogs?.length || 0} audit logs from the last hour`)
    recentLogs?.forEach(log => {
      console.log(`\n${log.table_name}:`)
      console.log(`  Status: ${log.status}`)
      console.log(`  Started: ${log.refresh_started_at}`)
      console.log(`  Function: ${log.function_name}`)
      if (log.error_message) {
        console.log(`  Error: ${log.error_message}`)
      }
    })
  }
  
  // 3. Test if we can access the tables from the edge function's perspective
  console.log('\n=== Testing Table Access ===')
  
  // Check if the public views exist that edge functions might use
  const publicTables = [
    'refresh_config',
    'refresh_audit_log',
    'daily_sqp_data'
  ]
  
  for (const table of publicTables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
    
    console.log(`${table}: ${error ? `❌ Error - ${error.message}` : `✅ Accessible (${count} rows)`}`)
  }
}

debugRefresh().catch(console.error)