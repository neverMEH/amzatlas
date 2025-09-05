#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testDataUpdate() {
  console.log('🔍 Testing data update visibility...\n')

  try {
    // 1. Check search_query_performance table
    console.log('📊 Checking search_query_performance table:')
    const { data: sqpData, error: sqpError, count: sqpCount } = await supabase
      .from('search_query_performance')
      .select('*', { count: 'exact', head: false })
      .order('end_date', { ascending: false })
      .limit(5)

    if (sqpError) {
      console.error('Error fetching search_query_performance:', sqpError)
    } else {
      console.log(`- Total records: ${sqpCount}`)
      console.log('- Latest 5 records:')
      sqpData?.forEach(row => {
        console.log(`  ASIN: ${row.asin_performance_data_id?.split('_')[0]}, Query: "${row.search_query}", End Date: ${row.end_date}`)
      })
    }

    // 2. Check asin_performance_data table
    console.log('\n📊 Checking asin_performance_data table:')
    const { data: asinData, error: asinError, count: asinCount } = await supabase
      .from('asin_performance_data')
      .select('*', { count: 'exact', head: false })
      .order('end_date', { ascending: false })
      .limit(5)

    if (asinError) {
      console.error('Error fetching asin_performance_data:', asinError)
    } else {
      console.log(`- Total records: ${asinCount}`)
      console.log('- Latest 5 records:')
      asinData?.forEach(row => {
        console.log(`  ASIN: ${row.asin}, Date Range: ${row.start_date} to ${row.end_date}`)
      })
    }

    // 3. Check daily_sqp_data table
    console.log('\n📊 Checking daily_sqp_data table:')
    const { data: dailyData, error: dailyError, count: dailyCount } = await supabase
      .from('daily_sqp_data')
      .select('*', { count: 'exact', head: false })
      .order('date', { ascending: false })
      .limit(5)

    if (dailyError) {
      console.error('Error fetching daily_sqp_data:', dailyError)
    } else {
      console.log(`- Total records: ${dailyCount}`)
      console.log('- Latest 5 records:')
      dailyData?.forEach(row => {
        console.log(`  ASIN: ${row.asin}, Date: ${row.date}, Impressions: ${row.impressions}`)
      })
    }

    // 4. Check refresh audit log
    console.log('\n📋 Recent refresh attempts:')
    const { data: auditLogs, error: auditError } = await supabase
      .from('refresh_audit_log')
      .select('*')
      .order('refresh_started_at', { ascending: false })
      .limit(10)

    if (auditError) {
      console.error('Error fetching audit logs:', auditError)
    } else {
      auditLogs?.forEach(log => {
        const status = log.status === 'success' ? '✅' : log.status === 'failed' ? '❌' : '🔄'
        console.log(`${status} ${log.table_name} - ${log.status} (${log.refresh_started_at})`)
        if (log.rows_processed) {
          console.log(`   Rows processed: ${log.rows_processed}`)
        }
        if (log.error_message) {
          console.log(`   Error: ${log.error_message}`)
        }
      })
    }

    // 5. Check materialized views
    console.log('\n🔄 Checking materialized views refresh status:')
    
    // Check search_performance_summary (in public schema)
    const { data: summaryData, error: summaryError } = await supabase
      .from('search_performance_summary')
      .select('*', { count: 'exact', head: true })

    if (summaryError) {
      console.error('Error checking search_performance_summary:', summaryError)
    } else {
      console.log(`- search_performance_summary exists and is accessible`)
    }

    // 6. Test if data is visible through API endpoints
    console.log('\n🌐 Testing API endpoints:')
    
    // Get a sample ASIN to test with
    const { data: sampleAsin } = await supabase
      .from('asin_performance_data')
      .select('asin')
      .limit(1)
      .single()

    if (sampleAsin) {
      console.log(`- Testing with ASIN: ${sampleAsin.asin}`)
      
      // Note: Since we're in a script, we can't easily test the API endpoints
      // But we can check if the data would be available to them
      const { data: apiData, error: apiError } = await supabase
        .from('search_performance_summary')
        .select('*')
        .eq('asin', sampleAsin.asin)
        .order('end_date', { ascending: false })
        .limit(1)

      if (apiError) {
        console.error('Error fetching from search_performance_summary:', apiError)
      } else if (apiData && apiData.length > 0) {
        console.log('✅ Data is accessible through search_performance_summary view')
        console.log(`   Latest date: ${apiData[0].end_date}`)
      } else {
        console.log('⚠️  No data found in search_performance_summary for this ASIN')
      }
    }

  } catch (error) {
    console.error('Error during test:', error)
  }
}

// Run the test
testDataUpdate()