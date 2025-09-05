import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const apiBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testBigQuerySyncAPI() {
  console.log('Testing BigQuery Sync via Next.js API...\n')
  
  try {
    // Step 1: Test API health check
    console.log('1. Testing API endpoint availability...')
    const healthResponse = await fetch(`${apiBaseUrl}/api/sync/bigquery`)
    const healthData = await healthResponse.json()
    console.log('API Status:', healthData)
    
    // Step 2: Test single table sync
    console.log('\n2. Testing single table sync (asin_performance_data)...')
    const syncResponse = await fetch(`${apiBaseUrl}/api/sync/bigquery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        tableName: 'asin_performance_data',
        tableSchema: 'sqp',
        options: {
          batchSize: 100,
          dateRange: {
            start: '2025-01-01',
            end: '2025-01-07'
          },
          truncate: false
        }
      })
    })
    
    const syncResult = await syncResponse.json()
    console.log('Sync Result:', syncResult)
    
    // Step 3: Verify data was synced
    if (syncResult.success && syncResult.rowsProcessed > 0) {
      console.log('\n3. Verifying synced data...')
      const { data, error } = await supabase
        .from('asin_performance_data')
        .select('asin, start_date, end_date')
        .order('end_date', { ascending: false })
        .limit(5)
      
      if (!error && data) {
        console.log(`Found ${data.length} records in Supabase:`)
        data.forEach(row => {
          console.log(`  - ASIN: ${row.asin}, Period: ${row.start_date} to ${row.end_date}`)
        })
      }
    }
    
    // Step 4: Test orchestration endpoint
    console.log('\n4. Testing orchestration endpoint...')
    const orchestrateResponse = await fetch(`${apiBaseUrl}/api/sync/orchestrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({
        refreshType: 'manual',
        tables: ['asin_performance_data'] // Sync specific table
      })
    })
    
    const orchestrateResult = await orchestrateResponse.json()
    console.log('Orchestration Result:', orchestrateResult)
    
    // Step 5: Check audit logs
    console.log('\n5. Checking refresh audit logs...')
    const { data: auditLogs } = await supabase
      .from('refresh_audit_log')
      .select('table_name, status, rows_processed, refresh_started_at, error_message')
      .order('refresh_started_at', { ascending: false })
      .limit(5)
    
    if (auditLogs && auditLogs.length > 0) {
      console.log('Recent refresh attempts:')
      auditLogs.forEach(log => {
        console.log(`  - ${log.table_name}: ${log.status} (${log.rows_processed || 0} rows) at ${log.refresh_started_at}`)
        if (log.error_message) {
          console.log(`    Error: ${log.error_message}`)
        }
      })
    }
    
    // Step 6: Test webhook endpoint (if webhooks are configured)
    console.log('\n6. Checking webhook configurations...')
    const { data: webhooks } = await supabase
      .from('webhook_config')
      .select('name, endpoint_url, is_active')
      .eq('is_active', true)
    
    if (webhooks && webhooks.length > 0) {
      console.log(`Found ${webhooks.length} active webhooks:`)
      webhooks.forEach(hook => {
        console.log(`  - ${hook.name}: ${hook.endpoint_url}`)
      })
    } else {
      console.log('No active webhooks configured')
    }
    
    console.log('\n✅ BigQuery sync API test completed!')
    console.log('\nNext steps:')
    console.log('1. Deploy this API to production')
    console.log('2. Set up a cron job to call /api/sync/orchestrate periodically')
    console.log('3. Configure webhooks for sync notifications')
    console.log('4. Monitor the refresh-monitor dashboard at /refresh-monitor')
    
  } catch (error) {
    console.error('\n❌ Test failed:', error)
  }
}

// Run the test
testBigQuerySyncAPI().catch(console.error)