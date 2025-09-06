#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

async function checkRefreshConfig() {
  console.log('=== Checking Refresh Configuration ===\n')

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // 1. Check if refresh_config table exists
    console.log('📊 Checking refresh_config table...')
    const { data: configs, error: configError } = await supabase
      .from('refresh_config')
      .select('*')
      .limit(10)

    if (configError) {
      console.log(`❌ Error accessing refresh_config: ${configError.message}`)
      
      // Try to find the table in schema
      console.log('\n📊 Looking for refresh tables in database...')
      const { data: tables } = await supabase
        .rpc('get_table_list', { schema_name: 'sqp' })
        .select('*')
        .catch(() => ({ data: null }))

      if (!tables) {
        // Simple query to check what tables exist
        console.log('Checking available tables...')
      }
      return
    }

    console.log(`Found ${configs?.length || 0} configurations`)
    if (configs && configs.length > 0) {
      console.log('\nExisting configurations:')
      configs.forEach(config => {
        console.log(`  ${config.table_schema}.${config.table_name} - Last refresh: ${config.last_refresh_at || 'Never'}`)
      })
    }

    // 2. Check what tables we need to sync
    console.log('\n📊 Tables that need sync configuration:')
    const tablesNeedingSync = [
      { schema: 'sqp', table: 'asin_performance_data' },
      { schema: 'sqp', table: 'search_query_performance' },
      { schema: 'sqp', table: 'daily_sqp_data' }
    ]

    for (const table of tablesNeedingSync) {
      const existing = configs?.find(c => 
        c.table_schema === table.schema && c.table_name === table.table
      )
      
      if (!existing) {
        console.log(`  ❌ Missing: ${table.schema}.${table.table}`)
      } else {
        console.log(`  ✅ Exists: ${table.schema}.${table.table}`)
      }
    }

    // 3. Check for refresh_audit_log table
    console.log('\n📊 Checking refresh_audit_log table...')
    const { data: auditLogs, error: auditError } = await supabase
      .from('refresh_audit_log')
      .select('*')
      .order('refresh_started_at', { ascending: false })
      .limit(5)

    if (auditError) {
      console.log(`❌ Error accessing refresh_audit_log: ${auditError.message}`)
    } else {
      console.log(`Found ${auditLogs?.length || 0} recent audit entries`)
      if (auditLogs && auditLogs.length > 0) {
        console.log('\nRecent sync attempts:')
        auditLogs.forEach(log => {
          const status = log.status === 'success' ? '✅' : '❌'
          console.log(`  ${status} ${log.table_schema}.${log.table_name} - ${log.refresh_started_at} (${log.rows_processed || 0} rows)`)
        })
      }
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  }
}

checkRefreshConfig()
  .then(() => {
    console.log('\n✅ Check completed')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n❌ Check failed:', err)
    process.exit(1)
  })