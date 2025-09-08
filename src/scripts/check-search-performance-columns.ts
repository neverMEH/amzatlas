import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkSearchPerformanceColumns() {
  console.log('Checking search_performance_summary columns...\n')

  // Method 1: Try to get column info from information_schema
  const { data: columns, error: columnsError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, ordinal_position
        FROM information_schema.columns
        WHERE table_schema = 'sqp' 
        AND table_name = 'search_performance_summary'
        ORDER BY ordinal_position;
      `
    })

  if (columnsError) {
    console.error('Error getting column info:', columnsError)
  } else if (columns) {
    console.log('Columns in sqp.search_performance_summary:')
    console.table(columns)
  }

  // Method 2: Try a simple select to see what columns are available
  console.log('\nTrying to select from search_performance_summary...')
  const { data: sample, error: sampleError } = await supabase
    .from('search_performance_summary')
    .select('*')
    .limit(1)

  if (sampleError) {
    console.error('Error selecting from search_performance_summary:', sampleError)
  } else if (sample && sample.length > 0) {
    console.log('\nSample row columns:')
    console.log(Object.keys(sample[0]))
  }

  // Method 3: Check if it's a view or table
  const { data: viewInfo, error: viewError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT table_type
        FROM information_schema.tables
        WHERE table_schema = 'sqp' 
        AND table_name = 'search_performance_summary';
      `
    })

  if (!viewError && viewInfo) {
    console.log('\nTable type:', viewInfo[0]?.table_type)
  }

  // Method 4: Check if the view exists in public schema instead
  const { data: publicColumns, error: publicError } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'search_performance_summary'
        ORDER BY ordinal_position
        LIMIT 10;
      `
    })

  if (!publicError && publicColumns && publicColumns.length > 0) {
    console.log('\nFound in public schema instead:')
    console.table(publicColumns)
  }

  // Method 5: Try the actual query from the API
  console.log('\nTrying the actual API query...')
  const { data: apiTest, error: apiError } = await supabase
    .from('search_performance_summary')
    .select('total_query_impression_count, asin_click_count')
    .limit(1)

  if (apiError) {
    console.error('API query error:', apiError)
    
    // Try with different column names
    console.log('\nTrying with different column names...')
    const { data: altTest, error: altError } = await supabase
      .from('search_performance_summary')
      .select('impressions, clicks')
      .limit(1)
    
    if (altError) {
      console.error('Alternative query error:', altError)
    } else {
      console.log('Alternative query worked! Columns might be: impressions, clicks, etc.')
    }
  } else {
    console.log('API query worked!')
  }
}

checkSearchPerformanceColumns().catch(console.error)