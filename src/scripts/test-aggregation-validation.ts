#!/usr/bin/env node
import 'dotenv/config'
import { createClient } from '../lib/supabase/server'
import { shouldAggregateKeywords, aggregateSearchQueries, transformSearchQueryData } from '../app/api/dashboard/v2/asin-overview/utils/keyword-aggregation'

// Test that aggregation maintains mathematical correctness
async function testAggregationValidation() {
  console.log('Testing Aggregation Data Validation...\n')
  
  const supabase = createClient()
  const testASIN = 'B001DT1MJG'
  const startDate = '2024-07-21'
  const endDate = '2024-08-03'
  
  console.log(`Testing ASIN: ${testASIN}`)
  console.log(`Date range: ${startDate} to ${endDate}`)
  console.log(`Should aggregate: ${shouldAggregateKeywords(startDate, endDate)}\n`)
  
  // Fetch raw data
  const { data: rawData, error } = await supabase
    .from('search_query_performance')
    .select('*')
    .gte('start_date', startDate)
    .lte('end_date', endDate)
    .eq('asin', testASIN)
    .order('search_query')
  
  if (error || !rawData) {
    console.error('Error fetching data:', error)
    return
  }
  
  console.log(`Raw data rows: ${rawData.length}`)
  
  // Group raw data by keyword for manual validation
  const manualGroups = new Map<string, any[]>()
  for (const row of rawData) {
    const key = row.search_query
    if (!manualGroups.has(key)) {
      manualGroups.set(key, [])
    }
    manualGroups.get(key)!.push(row)
  }
  
  console.log(`Unique keywords: ${manualGroups.size}\n`)
  
  // Aggregate using our function
  const transformedData = transformSearchQueryData(rawData)
  const aggregatedData = aggregateSearchQueries(transformedData)
  
  console.log('Validation Results:')
  console.log('==================\n')
  
  let validationErrors = 0
  
  // Validate each aggregated keyword
  for (const aggRow of aggregatedData) {
    const keyword = aggRow.searchQuery
    const manualRows = manualGroups.get(keyword)
    
    if (!manualRows) {
      console.error(`ERROR: Keyword "${keyword}" not found in manual groups`)
      validationErrors++
      continue
    }
    
    // Manual calculation
    const manualSums = {
      impressions: 0,
      clicks: 0,
      cartAdds: 0,
      purchases: 0,
    }
    
    let totalImpressionWeight = 0
    let weightedSums = {
      ctr: 0,
      cvr: 0,
      impressionShare: 0,
      clickShare: 0,
      purchaseShare: 0,
    }
    
    for (const row of manualRows) {
      // Sum volume metrics
      manualSums.impressions += row.impressions || 0
      manualSums.clicks += row.clicks || 0
      manualSums.cartAdds += row.cart_adds || 0
      manualSums.purchases += row.purchases || 0
      
      // Weight rate metrics by impressions
      const weight = row.impressions || 0
      totalImpressionWeight += weight
      
      weightedSums.ctr += (row.click_through_rate || 0) * weight
      weightedSums.cvr += (row.conversion_rate || 0) * weight
      weightedSums.impressionShare += (row.impression_share || 0) * weight
      weightedSums.clickShare += (row.click_share || 0) * weight
      weightedSums.purchaseShare += (row.purchase_share || 0) * weight
    }
    
    // Calculate manual averages
    const manualRates = {
      ctr: manualSums.impressions > 0 ? manualSums.clicks / manualSums.impressions : 0,
      cvr: manualSums.clicks > 0 ? manualSums.purchases / manualSums.clicks : 0,
      cartAddRate: manualSums.clicks > 0 ? manualSums.cartAdds / manualSums.clicks : 0,
      purchaseRate: manualSums.cartAdds > 0 ? manualSums.purchases / manualSums.cartAdds : 0,
      impressionShare: totalImpressionWeight > 0 ? weightedSums.impressionShare / totalImpressionWeight : 0,
      clickShare: totalImpressionWeight > 0 ? weightedSums.clickShare / totalImpressionWeight : 0,
      purchaseShare: totalImpressionWeight > 0 ? weightedSums.purchaseShare / totalImpressionWeight : 0,
    }
    
    // Validate volume metrics
    console.log(`Keyword: "${keyword}" (${manualRows.length} weeks)`)
    
    const volumeTests = [
      { name: 'Impressions', expected: manualSums.impressions, actual: aggRow.impressions },
      { name: 'Clicks', expected: manualSums.clicks, actual: aggRow.clicks },
      { name: 'Cart Adds', expected: manualSums.cartAdds, actual: aggRow.cartAdds },
      { name: 'Purchases', expected: manualSums.purchases, actual: aggRow.purchases },
    ]
    
    for (const test of volumeTests) {
      const isValid = test.expected === test.actual
      if (!isValid) {
        console.error(`  ✗ ${test.name}: Expected ${test.expected}, got ${test.actual}`)
        validationErrors++
      } else {
        console.log(`  ✓ ${test.name}: ${test.actual}`)
      }
    }
    
    // Validate rate metrics
    const rateTests = [
      { name: 'CTR', expected: manualRates.ctr, actual: aggRow.ctr, tolerance: 0.0001 },
      { name: 'CVR', expected: manualRates.cvr, actual: aggRow.cvr, tolerance: 0.0001 },
      { name: 'Cart Add Rate', expected: manualRates.cartAddRate, actual: aggRow.cartAddRate, tolerance: 0.0001 },
      { name: 'Purchase Rate', expected: manualRates.purchaseRate, actual: aggRow.purchaseRate, tolerance: 0.0001 },
      { name: 'Impression Share', expected: manualRates.impressionShare, actual: aggRow.impressionShare, tolerance: 0.0001 },
    ]
    
    for (const test of rateTests) {
      const diff = Math.abs(test.expected - test.actual)
      const isValid = diff <= test.tolerance
      if (!isValid) {
        console.error(`  ✗ ${test.name}: Expected ${(test.expected * 100).toFixed(3)}%, got ${(test.actual * 100).toFixed(3)}%`)
        validationErrors++
      } else {
        console.log(`  ✓ ${test.name}: ${(test.actual * 100).toFixed(2)}%`)
      }
    }
    
    console.log()
  }
  
  console.log('==================')
  console.log(`Total validation errors: ${validationErrors}`)
  console.log(`Validation ${validationErrors === 0 ? 'PASSED' : 'FAILED'}`)
  
  // Test edge cases
  console.log('\nEdge Case Tests:')
  console.log('================\n')
  
  // Test empty data
  const emptyResult = aggregateSearchQueries([])
  console.log(`Empty data returns empty array: ${emptyResult.length === 0 ? '✓' : '✗'}`)
  
  // Test single row
  const singleRow = transformSearchQueryData([rawData[0]])
  const singleResult = aggregateSearchQueries(singleRow)
  console.log(`Single row aggregation: ${singleResult.length === 1 ? '✓' : '✗'}`)
  
  // Test keywords with missing weeks
  const partialKeywords = new Set<string>()
  const weekCounts = new Map<string, number>()
  
  for (const [keyword, rows] of manualGroups) {
    weekCounts.set(keyword, rows.length)
    if (rows.length < 2) {
      partialKeywords.add(keyword)
    }
  }
  
  console.log(`Keywords with partial data: ${partialKeywords.size}`)
  console.log(`All partial keywords handled: ${aggregatedData.length === manualGroups.size ? '✓' : '✗'}`)
}

// Run the validation
testAggregationValidation().catch(console.error)