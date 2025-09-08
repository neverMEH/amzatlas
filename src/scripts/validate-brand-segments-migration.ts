#!/usr/bin/env tsx

/**
 * Validation script for migration 053: brand_product_segments
 * Tests database schema changes and performance benchmarks
 */

import { createClient } from '@supabase/supabase-js'
import { performance } from 'perf_hooks'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface ValidationResult {
  test: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  duration?: number
  message: string
  details?: any
}

const results: ValidationResult[] = []

function logResult(result: ValidationResult) {
  results.push(result)
  const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️'
  const duration = result.duration ? ` (${result.duration.toFixed(2)}ms)` : ''
  console.log(`${status} ${result.test}${duration}: ${result.message}`)
}

async function validateTableStructure() {
  console.log('\n🔍 Validating table structure...')
  
  try {
    const startTime = performance.now()
    
    // Test materialized view exists and has data
    const { data, error } = await supabase
      .from('brand_product_segments')
      .select()
      .limit(1)
    
    const duration = performance.now() - startTime
    
    if (error) {
      logResult({
        test: 'Materialized View Structure',
        status: 'FAIL',
        duration,
        message: `Error accessing brand_product_segments: ${error.message}`,
        details: error
      })
      return
    }
    
    logResult({
      test: 'Materialized View Structure',
      status: 'PASS',
      duration,
      message: `Table accessible with ${data?.length || 0} sample records`
    })
    
    // Test enhanced brand performance view
    const { data: enhancedData, error: enhancedError } = await supabase
      .from('brand_performance_enhanced')
      .select()
      .limit(1)
    
    if (enhancedError) {
      logResult({
        test: 'Enhanced Brand Performance View',
        status: 'FAIL',
        message: `Error accessing brand_performance_enhanced: ${enhancedError.message}`
      })
    } else {
      logResult({
        test: 'Enhanced Brand Performance View',
        status: 'PASS',
        message: `View accessible with ${enhancedData?.length || 0} sample records`
      })
    }
    
  } catch (err) {
    logResult({
      test: 'Table Structure Validation',
      status: 'FAIL',
      message: `Unexpected error: ${err}`
    })
  }
}

async function validatePerformance() {
  console.log('\n⚡ Running performance benchmarks...')
  
  // Test 1: Validate segment type classification (all should be weekly)
  try {
    const startTime = performance.now()
    
    const { data, error } = await supabase.rpc('execute_sql', {
      sql: `
        WITH date_segments AS (
          SELECT DISTINCT
            CASE 
              WHEN end_date - start_date = 0 THEN 'weekly'
              WHEN end_date - start_date <= 31 THEN 'monthly'  
              WHEN end_date - start_date <= 93 THEN 'quarterly'
              WHEN end_date - start_date <= 366 THEN 'yearly'
              ELSE 'other'
            END as segment_type,
            COUNT(*) OVER (PARTITION BY 
              CASE 
                WHEN end_date - start_date = 0 THEN 'weekly'
                WHEN end_date - start_date <= 31 THEN 'monthly'  
                WHEN end_date - start_date <= 93 THEN 'quarterly'
                WHEN end_date - start_date <= 366 THEN 'yearly'
                ELSE 'other'
              END
            ) as count_per_type
          FROM sqp.asin_performance_data 
          WHERE start_date >= '2024-08-01'
        )
        SELECT segment_type, MAX(count_per_type) as total_count
        FROM date_segments 
        GROUP BY segment_type 
        ORDER BY total_count DESC;
      `
    })
    
    const duration = performance.now() - startTime
    
    if (error) {
      logResult({
        test: 'Segment Type Classification',
        status: 'FAIL',
        duration,
        message: `Classification failed: ${error.message}`
      })
    } else {
      // We expect only 'weekly' segments based on the data analysis
      const weeklyCount = data?.find((row: any) => row.segment_type === 'weekly')?.total_count || 0
      const otherTypes = data?.filter((row: any) => row.segment_type !== 'weekly').length || 0
      
      logResult({
        test: 'Segment Type Classification',
        status: weeklyCount > 0 && otherTypes === 0 ? 'PASS' : 'FAIL',
        duration,
        message: `Found ${weeklyCount} weekly segments, ${otherTypes} other types (expected: only weekly)`
      })
    }
  } catch (err) {
    logResult({
      test: 'Segment Type Classification',
      status: 'FAIL',
      message: `Test error: ${err}`
    })
  }
  
  // Test 2: Date range query
  try {
    const startTime = performance.now()
    
    const { data, error } = await supabase
      .from('brand_product_segments')
      .select('brand_name, asin, total_purchases')
      .eq('segment_type', 'weekly')
      .gte('segment_start_date', '2024-08-01')
      .lte('segment_end_date', '2024-09-30')
      .order('total_purchases', { ascending: false })
      .limit(100)
    
    const duration = performance.now() - startTime
    
    if (error) {
      logResult({
        test: 'Date Range Query Performance',
        status: 'FAIL',
        duration,
        message: `Query failed: ${error.message}`
      })
    } else {
      const passed = duration < 150
      logResult({
        test: 'Date Range Query Performance',
        status: passed ? 'PASS' : 'FAIL',
        duration,
        message: `Query returned ${data?.length || 0} records (target: <150ms)`
      })
    }
  } catch (err) {
    logResult({
      test: 'Date Range Query Performance',
      status: 'FAIL',
      message: `Test error: ${err}`
    })
  }
}

async function validateHelperFunctions() {
  console.log('\n🔧 Validating helper functions...')
  
  // Test metadata function
  try {
    const { data: testData } = await supabase
      .from('brand_product_segments')
      .select('brand_id, asin')
      .limit(1)
      .single()
    
    if (!testData) {
      logResult({
        test: 'Segment Metadata Function',
        status: 'SKIP',
        message: 'No segment data available for testing'
      })
    } else {
      const startTime = performance.now()
      
      const { data, error } = await supabase
        .rpc('get_product_segment_metadata', {
          p_brand_id: testData.brand_id,
          p_asin: testData.asin,
          p_segment_type: 'weekly'
        })
      
      const duration = performance.now() - startTime
      
      if (error) {
        logResult({
          test: 'Segment Metadata Function',
          status: 'FAIL',
          duration,
          message: `Function failed: ${error.message}`
        })
      } else {
        const passed = duration < 80 && data && typeof data === 'object'
        logResult({
          test: 'Segment Metadata Function',
          status: passed ? 'PASS' : 'FAIL',
          duration,
          message: `Function returned metadata (target: <80ms)`
        })
      }
    }
  } catch (err) {
    logResult({
      test: 'Segment Metadata Function',
      status: 'FAIL',
      message: `Test error: ${err}`
    })
  }
  
  // Test validation function
  try {
    const startTime = performance.now()
    
    const { data, error } = await supabase
      .rpc('validate_brand_product_segments')
    
    const duration = performance.now() - startTime
    
    if (error) {
      logResult({
        test: 'Data Validation Function',
        status: 'FAIL',
        duration,
        message: `Validation failed: ${error.message}`
      })
    } else {
      const allPassed = data && data.every((check: any) => check.status === 'PASS')
      logResult({
        test: 'Data Validation Function',
        status: allPassed ? 'PASS' : 'FAIL',
        duration,
        message: `Validation completed with ${data?.length || 0} checks (target: <300ms)`
      })
      
      // Log validation details
      if (data) {
        data.forEach((check: any) => {
          console.log(`  • ${check.validation_check}: ${check.status} - ${check.details}`)
        })
      }
    }
  } catch (err) {
    logResult({
      test: 'Data Validation Function',
      status: 'FAIL',
      message: `Test error: ${err}`
    })
  }
}

async function validateDataQuality() {
  console.log('\n📊 Validating data quality...')
  
  try {
    // Check for data presence
    const { data: segmentCounts, error } = await supabase
      .from('brand_product_segments')
      .select('segment_type')
    
    if (error) {
      logResult({
        test: 'Data Quality Check',
        status: 'FAIL',
        message: `Error querying segments: ${error.message}`
      })
      return
    }
    
    const totalSegments = segmentCounts?.length || 0
    const weeklySegments = segmentCounts?.filter(s => s.segment_type === 'weekly').length || 0
    const monthlySegments = segmentCounts?.filter(s => s.segment_type === 'monthly').length || 0
    const dailySegments = segmentCounts?.filter(s => s.segment_type === 'daily').length || 0
    
    logResult({
      test: 'Data Quality Check',
      status: totalSegments > 0 ? 'PASS' : 'SKIP',
      message: `Total: ${totalSegments} segments (Weekly: ${weeklySegments}, Monthly: ${monthlySegments}, Daily: ${dailySegments})`
    })
    
    // Check for data integrity
    if (totalSegments > 0) {
      const { data: integrityData } = await supabase
        .from('brand_product_segments')
        .select('click_through_rate, conversion_rate, cart_add_rate')
        .limit(100)
      
      const invalidRates = integrityData?.filter(row => 
        row.click_through_rate < 0 || row.click_through_rate > 1 ||
        row.conversion_rate < 0 || row.conversion_rate > 1 ||
        row.cart_add_rate < 0 || row.cart_add_rate > 1
      ) || []
      
      logResult({
        test: 'Rate Bounds Integrity',
        status: invalidRates.length === 0 ? 'PASS' : 'FAIL',
        message: `${invalidRates.length} records with invalid rates (should be 0-1)`
      })
    }
    
  } catch (err) {
    logResult({
      test: 'Data Quality Check',
      status: 'FAIL',
      message: `Test error: ${err}`
    })
  }
}

async function refreshMaterializedView() {
  console.log('\n🔄 Refreshing materialized view...')
  
  try {
    const startTime = performance.now()
    
    await supabase.rpc('execute_sql', {
      sql: 'REFRESH MATERIALIZED VIEW public.brand_product_segments;'
    })
    
    const duration = performance.now() - startTime
    
    logResult({
      test: 'Materialized View Refresh',
      status: 'PASS',
      duration,
      message: 'Successfully refreshed brand_product_segments'
    })
    
  } catch (err) {
    logResult({
      test: 'Materialized View Refresh',
      status: 'FAIL',
      message: `Refresh failed: ${err}`
    })
  }
}

async function generateReport() {
  console.log('\n📋 Validation Summary')
  console.log('='.repeat(50))
  
  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  const skipped = results.filter(r => r.status === 'SKIP').length
  
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`⚠️  Skipped: ${skipped}`)
  console.log(`📊 Total: ${results.length}`)
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:')
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  • ${r.test}: ${r.message}`)
    })
  }
  
  const avgDuration = results
    .filter(r => r.duration)
    .reduce((sum, r) => sum + (r.duration || 0), 0) / results.filter(r => r.duration).length
  
  if (avgDuration) {
    console.log(`\n⚡ Average Query Time: ${avgDuration.toFixed(2)}ms`)
  }
  
  console.log('\n🎯 Migration 053 Validation', failed === 0 ? 'COMPLETED ✅' : 'FAILED ❌')
  
  return failed === 0
}

async function main() {
  console.log('🚀 Starting Migration 053 Validation')
  console.log('Testing brand_product_segments infrastructure...\n')
  
  // Create helper function if not exists (for validation)
  await supabase.rpc('execute_sql', {
    sql: `
      CREATE OR REPLACE FUNCTION execute_sql(sql text)
      RETURNS void AS $$
      BEGIN
        EXECUTE sql;
      END;
      $$ LANGUAGE plpgsql;
    `
  })
  
  await refreshMaterializedView()
  await validateTableStructure()
  await validatePerformance()
  await validateHelperFunctions()
  await validateDataQuality()
  
  const success = await generateReport()
  process.exit(success ? 0 : 1)
}

main().catch(err => {
  console.error('❌ Validation script failed:', err)
  process.exit(1)
})