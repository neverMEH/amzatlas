import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testRefreshMonitor() {
  console.log('Testing Refresh Monitor Data...\n')
  
  // 1. Get table structure
  console.log('=== Checking Table Structure ===')
  const { data: columns, error: columnError } = await supabase
    .rpc('get_table_columns', { 
      schema_name: 'sqp', 
      table_name: 'refresh_audit_log' 
    })
  
  if (columnError) {
    console.error('Error getting columns:', columnError)
  } else {
    console.log('Refresh audit log columns:', columns)
  }
  
  // 2. Try simpler insert without duration_ms
  console.log('\n=== Creating Simple Test Log ===')
  const { data: simpleLog, error: simpleError } = await supabase
    .from('refresh_audit_log')
    .insert({
      table_schema: 'sqp',
      table_name: 'test_manual_refresh',
      refresh_type: 'manual',
      status: 'success',
      refresh_started_at: new Date().toISOString(),
      refresh_completed_at: new Date().toISOString(),
      rows_processed: 1000
    })
    .select()
  
  if (simpleError) {
    console.error('Error creating simple log:', simpleError)
  } else {
    console.log('Created log:', simpleLog)
  }
  
  // 3. Check refresh config status
  console.log('\n=== Refresh Configuration Status ===')
  const { data: configs, error: configError } = await supabase
    .from('refresh_config')
    .select('table_name, is_enabled, last_refresh_at, next_refresh_at')
    .eq('table_schema', 'sqp')
    .order('priority', { ascending: false })
  
  if (configError) {
    console.error('Error getting configs:', configError)
  } else {
    configs?.forEach(config => {
      const needsRefresh = !config.next_refresh_at || new Date(config.next_refresh_at) < new Date()
      console.log(`${config.table_name}: ${config.is_enabled ? 'ENABLED' : 'DISABLED'} ${needsRefresh ? '⚠️ NEEDS REFRESH' : '✓'}`)
      console.log(`  Last: ${config.last_refresh_at || 'Never'}`)
      console.log(`  Next: ${config.next_refresh_at || 'Not scheduled'}`)
    })
  }
  
  // 4. Test the monitoring views
  console.log('\n=== Testing Monitoring Views ===')
  
  // Get daily stats
  const today = new Date().toISOString().split('T')[0]
  const { data: dailyStats, error: statsError } = await supabase
    .from('refresh_audit_log')
    .select('status, count')
    .gte('refresh_started_at', today)
  
  if (statsError) {
    console.error('Error getting daily stats:', statsError)
  } else {
    console.log('Today\'s refresh attempts:', dailyStats?.length || 0)
  }
}

testRefreshMonitor().catch(console.error)