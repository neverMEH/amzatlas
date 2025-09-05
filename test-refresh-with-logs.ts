import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testRefresh() {
  console.log('Testing refresh with real data...\n')
  
  // First, let's manually create an audit log entry to test
  console.log('1. Creating test audit log entry...')
  const { data: testLog, error: logError } = await supabase
    .from('refresh_audit_log')
    .insert({
      table_schema: 'sqp',
      table_name: 'test_table',
      refresh_type: 'manual',
      status: 'success',
      refresh_started_at: new Date().toISOString(),
      refresh_completed_at: new Date().toISOString(),
      duration_ms: 1234,
      rows_processed: 100,
      function_name: 'test-function'
    })
    .select()
    .single()
  
  if (logError) {
    console.error('Error creating test log:', logError)
  } else {
    console.log('Created test log:', testLog)
  }
  
  // Check if we can read it back
  console.log('\n2. Reading refresh logs...')
  const { data: logs, error: readError } = await supabase
    .from('refresh_audit_log')
    .select('*')
    .order('refresh_started_at', { ascending: false })
    .limit(5)
  
  if (readError) {
    console.error('Error reading logs:', readError)
  } else {
    console.log(`Found ${logs?.length || 0} logs:`)
    logs?.forEach(log => {
      console.log(`- ${log.table_name}: ${log.status} (${log.rows_processed} rows)`)
    })
  }
  
  // Test webhook delivery
  console.log('\n3. Testing webhook processor...')
  const { data: webhookResult, error: webhookError } = await supabase.functions.invoke('webhook-processor')
  
  if (webhookError) {
    console.error('Error invoking webhook processor:', webhookError)
  } else {
    console.log('Webhook processor result:', webhookResult)
  }
  
  // Check webhook deliveries
  console.log('\n4. Checking webhook deliveries...')
  const { data: deliveries, error: deliveryError } = await supabase
    .from('webhook_deliveries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)
  
  if (deliveryError) {
    console.error('Error reading deliveries:', deliveryError)
  } else {
    console.log(`Found ${deliveries?.length || 0} deliveries:`)
    deliveries?.forEach(delivery => {
      console.log(`- ${delivery.event_type}: ${delivery.status} to webhook ${delivery.webhook_config_id}`)
    })
  }
}

testRefresh().catch(console.error)