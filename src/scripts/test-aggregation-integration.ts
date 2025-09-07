#!/usr/bin/env node
import 'dotenv/config'
import { format, subDays } from 'date-fns'

// Test the aggregation feature end-to-end
async function testAggregationIntegration() {
  console.log('Testing Keyword Aggregation Integration...\n')

  // Test 1: Single week (no aggregation)
  console.log('Test 1: Single week date range (7 days)')
  const singleWeekStart = '2024-07-28'
  const singleWeekEnd = '2024-08-03'
  
  try {
    const response1 = await fetch(`http://localhost:3000/api/dashboard/v2/asin-overview?asin=B001DT1MJG&startDate=${singleWeekStart}&endDate=${singleWeekEnd}&includeQueries=true`)
    const data1 = await response1.json()
    
    console.log(`  Date range: ${singleWeekStart} to ${singleWeekEnd}`)
    console.log(`  Total queries returned: ${data1.topQueries?.length || 0}`)
    
    // Count unique keywords
    const uniqueKeywords1 = new Set(data1.topQueries?.map((q: any) => q.searchQuery) || [])
    console.log(`  Unique keywords: ${uniqueKeywords1.size}`)
    console.log(`  Aggregation applied: ${uniqueKeywords1.size < (data1.topQueries?.length || 0) ? 'No' : 'N/A'}`)
  } catch (error) {
    console.error('  Error:', error)
  }

  console.log('\n---\n')

  // Test 2: Two weeks (aggregation)
  console.log('Test 2: Two week date range (14 days)')
  const twoWeekStart = '2024-07-21'
  const twoWeekEnd = '2024-08-03'
  
  try {
    const response2 = await fetch(`http://localhost:3000/api/dashboard/v2/asin-overview?asin=B001DT1MJG&startDate=${twoWeekStart}&endDate=${twoWeekEnd}&includeQueries=true`)
    const data2 = await response2.json()
    
    console.log(`  Date range: ${twoWeekStart} to ${twoWeekEnd}`)
    console.log(`  Total queries returned: ${data2.topQueries?.length || 0}`)
    
    // Show sample aggregated data
    if (data2.topQueries?.length > 0) {
      const topQuery = data2.topQueries[0]
      console.log(`\n  Top query example:`)
      console.log(`    Keyword: "${topQuery.searchQuery}"`)
      console.log(`    Impressions: ${topQuery.impressions.toLocaleString()}`)
      console.log(`    Clicks: ${topQuery.clicks.toLocaleString()}`)
      console.log(`    Purchases: ${topQuery.purchases}`)
      console.log(`    CTR: ${(topQuery.ctr * 100).toFixed(2)}%`)
      console.log(`    CVR: ${(topQuery.cvr * 100).toFixed(2)}%`)
    }
  } catch (error) {
    console.error('  Error:', error)
  }

  console.log('\n---\n')

  // Test 3: With comparison period
  console.log('Test 3: Two weeks with comparison period')
  const currentStart = '2024-07-21'
  const currentEnd = '2024-08-03'
  const compareStart = '2024-07-07'
  const compareEnd = '2024-07-20'
  
  try {
    const response3 = await fetch(`http://localhost:3000/api/dashboard/v2/asin-overview?asin=B001DT1MJG&startDate=${currentStart}&endDate=${currentEnd}&compareStartDate=${compareStart}&compareEndDate=${compareEnd}&includeQueries=true`)
    const data3 = await response3.json()
    
    console.log(`  Current period: ${currentStart} to ${currentEnd}`)
    console.log(`  Comparison period: ${compareStart} to ${compareEnd}`)
    console.log(`  Current queries: ${data3.topQueries?.length || 0}`)
    console.log(`  Comparison queries: ${data3.topQueriesComparison?.length || 0}`)
    
    // Compare same keyword across periods
    if (data3.topQueries?.length > 0 && data3.topQueriesComparison?.length > 0) {
      const currentQuery = data3.topQueries[0]
      const compareQuery = data3.topQueriesComparison?.find((q: any) => q.searchQuery === currentQuery.searchQuery)
      
      if (compareQuery) {
        console.log(`\n  Comparison for "${currentQuery.searchQuery}":`)
        console.log(`    Current impressions: ${currentQuery.impressions.toLocaleString()}`)
        console.log(`    Previous impressions: ${compareQuery.impressions.toLocaleString()}`)
        const change = ((currentQuery.impressions - compareQuery.impressions) / compareQuery.impressions * 100).toFixed(1)
        console.log(`    Change: ${change > 0 ? '+' : ''}${change}%`)
      }
    }
  } catch (error) {
    console.error('  Error:', error)
  }

  console.log('\n---\n')

  // Test 4: Date range edge cases
  console.log('Test 4: Date range edge cases')
  const { shouldAggregateKeywords } = await import('../app/api/dashboard/v2/asin-overview/utils/keyword-aggregation')
  
  const testCases = [
    { start: '2024-08-01', end: '2024-08-07', expected: false },
    { start: '2024-08-01', end: '2024-08-08', expected: false },
    { start: '2024-08-01', end: '2024-08-09', expected: true },
    { start: '2024-08-01', end: '2024-08-14', expected: true },
    { start: '2024-08-01', end: '2024-08-31', expected: true },
  ]
  
  for (const test of testCases) {
    const result = shouldAggregateKeywords(test.start, test.end)
    const days = new Date(test.end).getDate() - new Date(test.start).getDate()
    console.log(`  ${test.start} to ${test.end} (${days} days): ${result ? 'Aggregate' : 'No aggregation'} ${result === test.expected ? '✓' : '✗'}`)
  }
}

// Check if running locally
if (process.env.NODE_ENV !== 'production') {
  console.log('Note: Make sure the development server is running (npm run dev)\n')
}

testAggregationIntegration().catch(console.error)