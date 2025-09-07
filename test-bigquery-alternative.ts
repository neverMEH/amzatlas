import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testBigQueryAlternative() {
  console.log('Testing BigQuery alternative approach...\n')
  
  console.log('=== Issue Identified ===')
  console.log('The BigQuery npm client (@google-cloud/bigquery) is incompatible with Supabase Edge Functions')
  console.log('Error: google-logging-utils TypeError - Cannot convert object to primitive value')
  console.log('This is a known issue with Google Cloud libraries in Deno runtime')
  
  console.log('\n=== Alternative Solutions ===')
  console.log('1. Use BigQuery REST API directly instead of the npm client')
  console.log('2. Create a Node.js backend service to handle BigQuery operations')
  console.log('3. Use a scheduled GitHub Action or external service for data sync')
  console.log('4. Use Supabase Database Functions with pg_cron for scheduling')
  
  console.log('\n=== Recommended Approach ===')
  console.log('Since Edge Functions cannot use the BigQuery client library:')
  console.log('1. Create a Node.js API endpoint in your Next.js app (/api/sync/bigquery)')
  console.log('2. This endpoint can use the BigQuery client properly')
  console.log('3. Edge Functions can call this API to trigger refreshes')
  console.log('4. Or use cron jobs to call the API directly')
  
  // Let's check if we can at least update the tables to show the issue
  console.log('\n=== Updating Refresh Status ===')
  
  const { data: configs } = await supabase
    .from('refresh_config')
    .select('*')
    .eq('is_enabled', true)
    .lte('next_refresh_at', new Date().toISOString())
  
  if (configs && configs.length > 0) {
    for (const config of configs.slice(0, 1)) { // Just update one for testing
      const { error } = await supabase
        .from('refresh_config')
        .update({
          last_refresh_at: new Date().toISOString(),
          next_refresh_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('id', config.id)
      
      if (!error) {
        console.log(`✅ Updated ${config.table_name} refresh status`)
      }
      
      // Create audit log
      await supabase
        .from('refresh_audit_log')
        .insert({
          table_schema: config.table_schema,
          table_name: config.table_name,
          status: 'failed',
          refresh_started_at: new Date().toISOString(),
          refresh_completed_at: new Date().toISOString(),
          error_message: 'BigQuery client incompatible with Edge Functions - google-logging-utils TypeError',
          rows_processed: 0
        })
    }
  }
  
  console.log('\n=== Next Steps ===')
  console.log('To get data refreshing working:')
  console.log('1. Create /api/sync/run-bigquery route in your Next.js app')
  console.log('2. Move BigQuery sync logic there (it will work in Node.js)')
  console.log('3. Set up a cron job to call this API endpoint')
  console.log('4. Or modify Edge Functions to call your API instead of using BigQuery directly')
}

testBigQueryAlternative().catch(console.error)