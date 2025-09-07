import { createClient } from '@/lib/supabase/server'

async function testBrandViews() {
  try {
    const supabase = createClient()
    
    // First, check if we have the necessary base tables
    console.log('Checking base tables...')
    
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('id, display_name')
      .limit(5)
    
    if (brandsError) {
      console.error('Error fetching brands:', brandsError)
    } else {
      console.log('Brands found:', brands?.length)
    }
    
    // Check if search_performance_summary exists
    const { data: summaryData, error: summaryError } = await supabase
      .from('search_performance_summary')
      .select('asin, impressions')
      .limit(5)
    
    if (summaryError) {
      console.error('Error fetching search_performance_summary:', summaryError)
    } else {
      console.log('Search performance summary rows:', summaryData?.length)
    }
    
    // Check if asin_brand_mapping exists
    const { data: mappings, error: mappingError } = await supabase
      .from('asin_brand_mapping')
      .select('asin, brand_id')
      .limit(5)
    
    if (mappingError) {
      console.error('Error fetching asin_brand_mapping:', mappingError)
    } else {
      console.log('ASIN brand mappings:', mappings?.length)
    }
    
    // Check if search_query_performance exists
    const { data: sqpData, error: sqpError } = await supabase
      .from('search_query_performance')
      .select('asin, search_query')
      .limit(5)
    
    if (sqpError) {
      console.error('Error fetching search_query_performance:', sqpError)
    } else {
      console.log('Search query performance rows:', sqpData?.length)
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

testBrandViews()