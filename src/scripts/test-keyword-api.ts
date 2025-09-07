// Test script to verify keyword analysis APIs are working
import { createClient } from '@/lib/supabase/server'

async function testKeywordAPIs() {
  const supabase = createClient()
  
  console.log('Testing Keyword Analysis APIs...\n')
  
  // Test 1: Check if we have ASINs with keywords
  const { data: asinData, error: asinError } = await supabase
    .from('search_query_performance')
    .select('asin, search_query')
    .limit(5)
  
  if (asinError) {
    console.error('Error fetching ASINs:', asinError)
    return
  }
  
  console.log('Sample ASINs with keywords:')
  asinData?.forEach(row => {
    console.log(`  ASIN: ${row.asin}, Keyword: ${row.search_query}`)
  })
  
  // Test 2: Check market share data structure
  const testAsin = asinData?.[0]?.asin
  const testKeyword = asinData?.[0]?.search_query
  
  if (testAsin && testKeyword) {
    console.log(`\nTesting with ASIN: ${testAsin}, Keyword: ${testKeyword}`)
    
    // Get market share data
    const { data: marketData } = await supabase
      .from('search_query_performance')
      .select('*')
      .eq('search_query', testKeyword)
      .limit(5)
    
    console.log('\nMarket share competitors found:', marketData?.length || 0)
    
    // Test comparison data
    const { data: compData } = await supabase
      .from('search_query_performance')
      .select('start_date, end_date, asin_impression_count')
      .eq('asin', testAsin)
      .eq('search_query', testKeyword)
      .order('start_date', { ascending: false })
      .limit(10)
    
    console.log('\nDate ranges available:')
    compData?.forEach(row => {
      console.log(`  ${row.start_date} to ${row.end_date}: ${row.asin_impression_count} impressions`)
    })
  }
  
  console.log('\nTest complete!')
}

testKeywordAPIs().catch(console.error)