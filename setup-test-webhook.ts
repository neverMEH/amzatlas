import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupTestWebhook() {
  console.log('Setting up test webhook...\n')
  
  // Create a test webhook
  const { data: webhook, error } = await supabase
    .from('webhook_configs')
    .insert({
      name: 'Test Webhook',
      url: 'https://webhook.site/test', // This is a free webhook testing service
      events: ['refresh.failed', 'refresh.completed'],
      is_enabled: true,
      headers: { 'X-Test': 'true' },
      retry_config: {
        max_attempts: 3,
        backoff_seconds: [5, 30, 300]
      }
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating webhook:', error)
    return
  }
  
  console.log('Created webhook:', webhook)
  console.log('\nYou can view webhook deliveries at: https://webhook.site/#!/test')
  
  // Now trigger a manual refresh
  console.log('\n\nTriggering manual refresh...')
  
  const { data: triggerResult, error: triggerError } = await supabase.functions.invoke('manual-refresh-trigger', {
    body: {
      table_schema: 'sqp',
      table_name: 'webhook_configs'
    }
  })
  
  if (triggerError) {
    console.error('Error triggering refresh:', triggerError)
  } else {
    console.log('Trigger result:', triggerResult)
  }
}

setupTestWebhook().catch(console.error)