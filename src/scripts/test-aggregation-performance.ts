#!/usr/bin/env node
import 'dotenv/config'
import { createClient } from '../lib/supabase/server'

// Test performance of aggregation with large datasets
async function testAggregationPerformance() {
  console.log('Testing Aggregation Performance...\n')
  
  const supabase = createClient()
  const testASIN = 'B001DT1MJG'
  
  // Test different date ranges
  const dateRanges = [
    { name: '1 week', start: '2024-07-28', end: '2024-08-03' },
    { name: '2 weeks', start: '2024-07-21', end: '2024-08-03' },
    { name: '1 month', start: '2024-07-04', end: '2024-08-03' },
    { name: '3 months', start: '2024-05-04', end: '2024-08-03' },
  ]
  
  for (const range of dateRanges) {
    console.log(`Testing ${range.name} (${range.start} to ${range.end})`)
    
    // Test 1: Database query performance
    const dbStart = performance.now()
    const { data: dbData, error: dbError } = await supabase
      .from('search_query_performance')
      .select('*')
      .gte('start_date', range.start)
      .lte('end_date', range.end)
      .eq('asin', testASIN)
      .order('impressions', { ascending: false })
    
    const dbEnd = performance.now()
    const dbTime = dbEnd - dbStart
    
    if (dbError) {
      console.error('  Database error:', dbError)
      continue
    }
    
    console.log(`  Database query: ${dbTime.toFixed(2)}ms`)
    console.log(`  Rows returned: ${dbData?.length || 0}`)
    
    // Test 2: Aggregation performance
    if (dbData && dbData.length > 0) {
      const { shouldAggregateKeywords, aggregateSearchQueries, transformSearchQueryData } = 
        await import('../app/api/dashboard/v2/asin-overview/utils/keyword-aggregation')
      
      const shouldAggregate = shouldAggregateKeywords(range.start, range.end)
      console.log(`  Should aggregate: ${shouldAggregate}`)
      
      if (shouldAggregate) {
        const aggStart = performance.now()
        const transformedData = transformSearchQueryData(dbData)
        const aggregatedData = aggregateSearchQueries(transformedData)
        const aggEnd = performance.now()
        const aggTime = aggEnd - aggStart
        
        console.log(`  Aggregation time: ${aggTime.toFixed(2)}ms`)
        console.log(`  Unique keywords before: ${dbData.length}`)
        console.log(`  Unique keywords after: ${aggregatedData.length}`)
        console.log(`  Reduction: ${((1 - aggregatedData.length / dbData.length) * 100).toFixed(1)}%`)
      }
    }
    
    // Test 3: Full API call performance
    const apiStart = performance.now()
    try {
      const response = await fetch(`http://localhost:3000/api/dashboard/v2/asin-overview?asin=${testASIN}&startDate=${range.start}&endDate=${range.end}&includeQueries=true`)
      const apiEnd = performance.now()
      const apiTime = apiEnd - apiStart
      
      if (response.ok) {
        const data = await response.json()
        console.log(`  API response time: ${apiTime.toFixed(2)}ms`)
        console.log(`  Queries returned: ${data.topQueries?.length || 0}`)
      } else {
        console.log(`  API error: ${response.status}`)
      }
    } catch (error) {
      console.error('  API error:', error)
    }
    
    console.log()
  }
  
  // Memory usage report
  if (process.memoryUsage) {
    const usage = process.memoryUsage()
    console.log('\nMemory Usage:')
    console.log(`  RSS: ${(usage.rss / 1024 / 1024).toFixed(2)} MB`)
    console.log(`  Heap Used: ${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`)
    console.log(`  Heap Total: ${(usage.heapTotal / 1024 / 1024).toFixed(2)} MB`)
  }
}

// Run the test
testAggregationPerformance().catch(console.error)