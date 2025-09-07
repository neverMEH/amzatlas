import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkRefreshResults() {
  console.log('Checking refresh results...\n')
  
  // Check recent audit logs
  const { data: recentLogs, error } = await supabase
    .from('refresh_audit_log')
    .select('*')
    .order('refresh_started_at', { ascending: false })
    .limit(20)
  
  if (error) {
    console.error('Error fetching logs:', error)
    return
  }
  
  console.log('=== Recent Refresh Attempts ===\n')
  
  const groupedByRun = new Map<string, any[]>()
  
  recentLogs?.forEach(log => {
    const startTime = new Date(log.refresh_started_at).toISOString()
    const key = startTime.substring(0, 19) // Group by minute
    if (!groupedByRun.has(key)) {
      groupedByRun.set(key, [])
    }
    groupedByRun.get(key)?.push(log)
  })
  
  for (const [timeKey, logs] of groupedByRun) {
    console.log(`\nRefresh run at ${timeKey}:`)
    logs.forEach(log => {
      const duration = log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : 'N/A'
      const rows = log.rows_processed || 0
      console.log(`  ${log.status === 'success' ? '✅' : '❌'} ${log.table_schema}.${log.table_name}`)
      console.log(`     Duration: ${duration}, Rows: ${rows.toLocaleString()}`)
      if (log.error_message) {
        console.log(`     Error: ${log.error_message}`)
      }
    })
  }
  
  // Check summary statistics
  const { data: stats } = await supabase
    .from('refresh_audit_log')
    .select('status, count')
    .eq('refresh_started_at', recentLogs?.[0]?.refresh_started_at || '')
  
  console.log('\n=== Summary ===')
  const successCount = recentLogs?.filter(l => l.status === 'success').length || 0
  const failedCount = recentLogs?.filter(l => l.status === 'failed').length || 0
  const totalRows = recentLogs?.reduce((sum, log) => sum + (log.rows_processed || 0), 0) || 0
  
  console.log(`Total refreshes: ${recentLogs?.length || 0}`)
  console.log(`Successful: ${successCount}`)
  console.log(`Failed: ${failedCount}`)
  console.log(`Total rows processed: ${totalRows.toLocaleString()}`)
}

checkRefreshResults().catch(console.error)