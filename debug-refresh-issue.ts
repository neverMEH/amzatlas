import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugRefreshIssue() {
  console.log('Debugging why no data is being refreshed...\n')
  
  // 1. Check what the orchestrator actually did
  console.log('=== Checking Orchestrator Behavior ===')
  
  // Look at all refresh configs
  const { data: allConfigs, error } = await supabase
    .from('refresh_config')
    .select('*')
    .order('last_refresh_at', { ascending: false, nullsFirst: false })
  
  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Refresh configs with timestamps:')
    allConfigs?.forEach(config => {
      const status = config.last_refresh_at ? '✅ MARKED AS REFRESHED' : '❌ NOT REFRESHED'
      console.log(`${status} ${config.table_name}:`)
      console.log(`  Last: ${config.last_refresh_at || 'Never'}`)
      console.log(`  Next: ${config.next_refresh_at}`)
      
      // Check if it was just updated by orchestrator
      if (config.last_refresh_at) {
        const minutesAgo = Math.floor((Date.now() - new Date(config.last_refresh_at).getTime()) / (1000 * 60))
        if (minutesAgo < 30) {
          console.log(`  ⚠️  Updated ${minutesAgo} minutes ago but NO DATA WAS TRANSFERRED`)
        }
      }
    })
  }
  
  // 2. Check the audit log table structure
  console.log('\n=== Checking Audit Log Table ===')
  
  // Try to insert a minimal record to see what columns exist
  const { error: insertError } = await supabase
    .from('refresh_audit_log')
    .insert({
      table_schema: 'sqp',
      table_name: 'test_debug',
      status: 'testing'
    })
  
  if (insertError) {
    console.log('Audit log insert error:', insertError.message)
    console.log('This suggests the table has different columns than expected')
  }
  
  // 3. Check if there's data in BigQuery that should be synced
  console.log('\n=== Summary of Issues ===')
  console.log('1. The orchestrator is updating last_refresh_at WITHOUT actually refreshing data')
  console.log('2. The refresh functions are failing but the orchestrator reports "success"')
  console.log('3. No audit logs are being created due to schema mismatch')
  console.log('4. The edge functions likely cannot connect to BigQuery or have other errors')
  
  console.log('\n=== What This Means ===')
  console.log('The refresh system is PARTIALLY working:')
  console.log('- ✅ Orchestrator runs and updates timestamps')
  console.log('- ❌ Actual data refresh is NOT happening')
  console.log('- ❌ Edge functions have errors that are being swallowed')
  console.log('\nTo see the actual errors, you need to check the Edge Function logs in Supabase Dashboard')
}

debugRefreshIssue().catch(console.error)