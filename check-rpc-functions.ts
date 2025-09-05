import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkRpcFunctions() {
  console.log('Checking RPC functions used by edge functions...\n')
  
  // Test the get_table_columns function that's failing
  console.log('=== Testing get_table_columns RPC ===')
  try {
    const { data, error } = await supabase
      .rpc('get_table_columns', {
        schema_name: 'sqp',
        table_name: 'webhook_configs'
      })
    
    if (error) {
      console.error('❌ Error:', error)
      
      // Try to get the actual column info directly
      console.log('\nTrying direct query instead...')
      const { data: directQuery, error: directError } = await supabase
        .from('webhook_configs')
        .select('*')
        .limit(0)
      
      if (!directError) {
        console.log('✅ Table is accessible directly')
      }
    } else {
      console.log('✅ Success! Columns:', data)
    }
  } catch (e) {
    console.error('Exception:', e)
  }
  
  // Check if the refresh_checkpoints table exists
  console.log('\n=== Checking refresh_checkpoints table ===')
  const { data: checkpointTest, error: checkpointError } = await supabase
    .from('refresh_checkpoints')
    .select('*')
    .limit(1)
  
  if (checkpointError) {
    console.error('❌ refresh_checkpoints table error:', checkpointError.message)
  } else {
    console.log('✅ refresh_checkpoints table exists')
  }
  
  // Let's check what RPC functions actually exist
  console.log('\n=== Checking Available RPC Functions ===')
  
  // Try other RPC functions that might be needed
  const rpcFunctions = [
    'refresh_materialized_view',
    'execute_sql',
    'get_table_row_count'
  ]
  
  for (const funcName of rpcFunctions) {
    try {
      const { error } = await supabase.rpc(funcName, {})
      console.log(`${funcName}: ${error ? `❌ ${error.message}` : '✅ Exists'}`)
    } catch (e) {
      console.log(`${funcName}: ❌ Not found`)
    }
  }
  
  // The real issue might be simpler - let's check if we can just insert data directly
  console.log('\n=== Testing Direct Data Insert ===')
  
  // Try to insert a test record into webhook_configs (won't conflict with existing)
  const testData = {
    name: 'Test Refresh Check',
    url: 'https://example.com/test-refresh',
    events: ['refresh.completed'],
    is_enabled: false
  }
  
  const { data: insertTest, error: insertError } = await supabase
    .from('webhook_configs')
    .insert(testData)
    .select()
  
  if (insertError) {
    console.error('❌ Insert test failed:', insertError.message)
  } else {
    console.log('✅ Insert test successful:', insertTest)
    
    // Clean up
    if (insertTest && insertTest.length > 0) {
      await supabase
        .from('webhook_configs')
        .delete()
        .eq('id', insertTest[0].id)
      console.log('✅ Cleaned up test data')
    }
  }
}

checkRpcFunctions().catch(console.error)