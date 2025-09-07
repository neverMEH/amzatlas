import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testBigQueryConnection() {
  console.log('Testing BigQuery Connection from Edge Functions...\n')
  
  // First, let's check what tables the edge function thinks need refresh
  console.log('=== Checking Tables That Need Refresh ===')
  const { data: tablesToRefresh, error } = await supabase
    .from('refresh_config')
    .select('*')
    .eq('is_enabled', true)
    .lte('next_refresh_at', new Date().toISOString())
    .order('priority', { ascending: false })
  
  if (error) {
    console.error('Error:', error)
  } else {
    console.log(`Found ${tablesToRefresh?.length || 0} tables that need refresh:`)
    tablesToRefresh?.forEach(t => {
      console.log(`- ${t.table_name} (function: ${t.function_name || 'refresh-generic-table'})`)
    })
  }
  
  // Let's check the actual edge function code to see what might be wrong
  console.log('\n=== Checking Edge Function Issues ===')
  
  // The orchestrator reported success but no data was actually refreshed
  // This suggests the individual refresh functions are failing silently
  
  // Let's manually trigger a refresh for a specific table with more details
  console.log('\nTrying to refresh webhook_configs table (small table for testing)...')
  
  const testConfig = {
    id: 1,
    table_schema: 'sqp',
    table_name: 'webhook_configs',
    refresh_frequency_hours: 24,
    priority: 100
  }
  
  const { data: refreshResult, error: refreshError } = await supabase.functions.invoke('refresh-generic-table', {
    body: { 
      config: testConfig,
      auditLogId: null,
      debug: true // Request debug info if available
    }
  })
  
  if (refreshError) {
    console.error('Refresh error:', refreshError)
    
    // Try to read error body
    if (refreshError.context?.body) {
      try {
        const reader = refreshError.context.body.getReader()
        const { value } = await reader.read()
        const text = new TextDecoder().decode(value)
        const errorData = JSON.parse(text)
        console.log('Error details:', errorData)
      } catch (e) {
        console.log('Could not parse error details')
      }
    }
  } else {
    console.log('Refresh result:', refreshResult)
  }
  
  // Check if there are any specific function mappings
  console.log('\n=== Checking Function Mappings ===')
  const { data: configs } = await supabase
    .from('refresh_config')
    .select('table_name, function_name')
    .not('function_name', 'is', null)
  
  console.log('Tables with custom functions:')
  configs?.forEach(c => {
    console.log(`- ${c.table_name}: ${c.function_name}`)
  })
  
  // Let's also check if the refresh functions exist
  console.log('\n=== Testing Specific Refresh Functions ===')
  const functionsToCheck = [
    'refresh-asin-performance',
    'refresh-search-query',
    'refresh-materialized-view'
  ]
  
  for (const fn of functionsToCheck) {
    const { data, error } = await supabase.functions.invoke(fn, {
      body: { test: true }
    })
    
    console.log(`${fn}: ${error ? `❌ ${error.context?.status || 'Error'}` : '✅ Available'}`)
  }
}

testBigQueryConnection().catch(console.error)