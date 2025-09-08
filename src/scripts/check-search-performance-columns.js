const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkSearchPerformanceColumns() {
  console.log('Checking search_performance_summary columns...\n')

  // Try a simple select to see what columns are available
  console.log('Trying to select from search_performance_summary...')
  const { data: sample, error: sampleError } = await supabase
    .from('search_performance_summary')
    .select('*')
    .limit(1)

  if (sampleError) {
    console.error('Error selecting from search_performance_summary:', sampleError)
    
    // Try from sqp schema explicitly
    console.log('\nTrying from sqp.search_performance_summary...')
    const { data: sqpSample, error: sqpError } = await supabase
      .from('sqp.search_performance_summary')
      .select('*')
      .limit(1)
    
    if (sqpError) {
      console.error('Error with sqp schema:', sqpError)
    } else if (sqpSample && sqpSample.length > 0) {
      console.log('\nColumns in sqp.search_performance_summary:')
      console.log(Object.keys(sqpSample[0]).slice(0, 20), '...')
    }
  } else if (sample && sample.length > 0) {
    console.log('\nSample row columns:')
    const columns = Object.keys(sample[0])
    console.log('Total columns:', columns.length)
    console.log('First 20 columns:', columns.slice(0, 20))
    
    // Check for impression-related columns
    console.log('\nImpression-related columns:')
    columns.forEach(col => {
      if (col.toLowerCase().includes('impression')) {
        console.log(' -', col)
      }
    })
    
    // Check for click-related columns
    console.log('\nClick-related columns:')
    columns.forEach(col => {
      if (col.toLowerCase().includes('click')) {
        console.log(' -', col)
      }
    })
  }

  // Try the actual query from the API
  console.log('\nTrying the actual API query with total_query_impression_count...')
  const { data: apiTest, error: apiError } = await supabase
    .from('search_performance_summary')
    .select('total_query_impression_count, asin_click_count')
    .limit(1)

  if (apiError) {
    console.error('API query error:', apiError.message)
  } else {
    console.log('API query with total_query_impression_count worked!')
  }
}

checkSearchPerformanceColumns().catch(console.error)