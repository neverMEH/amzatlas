import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

console.log('Testing BigQuery Refresh System with Real Data\n')
console.log('Supabase URL:', supabaseUrl)
console.log('Service Key available:', !!supabaseServiceKey)

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testRefreshSystem() {
  try {
    console.log('\n=== 1. Checking Refresh Configuration ===')
    const { data: configs, error: configError } = await supabase
      .from('refresh_config')
      .select('*')
      .order('priority', { ascending: false })
    
    if (configError) {
      console.error('Error fetching configs:', configError)
      return
    }
    
    console.log(`Found ${configs?.length || 0} refresh configurations:`)
    configs?.forEach(config => {
      console.log(`- ${config.table_schema}.${config.table_name}: ${config.is_enabled ? 'ENABLED' : 'DISABLED'}, Next refresh: ${config.next_refresh_at}`)
    })
    
    console.log('\n=== 2. Checking Recent Refresh History ===')
    const { data: recentHistory, error: historyError } = await supabase
      .from('refresh_audit_log')
      .select('*')
      .order('refresh_started_at', { ascending: false })
      .limit(10)
    
    if (historyError) {
      console.error('Error fetching history:', historyError)
      return
    }
    
    console.log(`\nLast 10 refresh attempts:`)
    recentHistory?.forEach(log => {
      const duration = log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : 'N/A'
      console.log(`- [${log.status}] ${log.table_name} at ${log.refresh_started_at} (${duration})`)
      if (log.error_message) {
        console.log(`  Error: ${log.error_message}`)
      }
    })
    
    console.log('\n=== 3. Checking Webhook Configurations ===')
    const { data: webhooks, error: webhookError } = await supabase
      .from('webhook_configs')
      .select('*')
    
    if (webhookError) {
      console.error('Error fetching webhooks:', webhookError)
      return
    }
    
    console.log(`\nFound ${webhooks?.length || 0} webhook configurations:`)
    webhooks?.forEach(webhook => {
      console.log(`- ${webhook.name}: ${webhook.url} (${webhook.is_enabled ? 'ENABLED' : 'DISABLED'})`)
      console.log(`  Events: ${webhook.events.join(', ')}`)
    })
    
    console.log('\n=== 4. Testing Edge Function Connectivity ===')
    console.log('Attempting to invoke edge functions...')
    
    // Test the daily refresh orchestrator
    try {
      const { data, error } = await supabase.functions.invoke('daily-refresh-orchestrator')
      if (error) {
        console.error('Error invoking orchestrator:', error)
      } else {
        console.log('Orchestrator response:', data)
      }
    } catch (e) {
      console.error('Failed to invoke orchestrator:', e)
    }
    
    console.log('\n=== 5. Checking Tables That Need Refresh ===')
    const now = new Date().toISOString()
    const { data: tablesNeedingRefresh } = await supabase
      .from('refresh_config')
      .select('*')
      .eq('is_enabled', true)
      .lte('next_refresh_at', now)
    
    console.log(`\nTables that need refresh now (${tablesNeedingRefresh?.length || 0}):`)
    tablesNeedingRefresh?.forEach(config => {
      console.log(`- ${config.table_schema}.${config.table_name} (Last: ${config.last_refresh_at || 'Never'})`)
    })
    
  } catch (error) {
    console.error('Test failed:', error)
  }
}

// Run the test
testRefreshSystem().then(() => {
  console.log('\n✅ Test completed')
}).catch(error => {
  console.error('\n❌ Test failed:', error)
})