import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkTableData() {
  console.log('Checking if main tables have data after refresh...\n')
  
  const tablesToCheck = [
    'asin_performance_data',
    'search_query_performance',
    'daily_sqp_data',
    'weekly_summary',
    'monthly_summary',
    'quarterly_summary',
    'yearly_summary',
    'search_performance_summary'
  ]
  
  for (const tableName of tablesToCheck) {
    console.log(`\n=== Checking ${tableName} ===`)
    
    try {
      // Get row count
      const { count, error: countError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
      
      if (countError) {
        console.error(`❌ Error counting rows:`, countError.message)
        continue
      }
      
      console.log(`Total rows: ${count || 0}`)
      
      // Get sample data
      if (count && count > 0) {
        const { data: sample, error: sampleError } = await supabase
          .from(tableName)
          .select('*')
          .limit(1)
        
        if (!sampleError && sample && sample.length > 0) {
          // Check for date fields to see how recent the data is
          const record = sample[0]
          const dateFields = Object.keys(record).filter(key => 
            key.includes('date') || key.includes('_at') || key === 'start_date' || key === 'end_date'
          )
          
          console.log('Sample record dates:')
          dateFields.forEach(field => {
            if (record[field]) {
              console.log(`  ${field}: ${record[field]}`)
            }
          })
          
          // For asin_performance_data, check the most recent data
          if (tableName === 'asin_performance_data') {
            const { data: recent, error: recentError } = await supabase
              .from(tableName)
              .select('start_date, end_date, asin')
              .order('end_date', { ascending: false })
              .limit(5)
            
            if (!recentError && recent) {
              console.log('\nMost recent records:')
              recent.forEach(r => {
                console.log(`  ASIN ${r.asin}: ${r.start_date} to ${r.end_date}`)
              })
            }
          }
        }
      }
      
    } catch (error) {
      console.error(`❌ Error checking ${tableName}:`, error)
    }
  }
  
  // Check refresh config to see if last_refresh_at was updated
  console.log('\n\n=== Checking Refresh Config Updates ===')
  const { data: configs, error: configError } = await supabase
    .from('refresh_config')
    .select('table_name, last_refresh_at, next_refresh_at')
    .order('last_refresh_at', { ascending: false, nullsFirst: false })
    .limit(10)
  
  if (configError) {
    console.error('Error fetching configs:', configError)
  } else {
    console.log('Tables with last_refresh_at updated:')
    configs?.forEach(config => {
      if (config.last_refresh_at) {
        const lastRefresh = new Date(config.last_refresh_at)
        const minutesAgo = Math.floor((Date.now() - lastRefresh.getTime()) / (1000 * 60))
        console.log(`  ${config.table_name}: ${config.last_refresh_at} (${minutesAgo} minutes ago)`)
      }
    })
    
    const refreshedCount = configs?.filter(c => c.last_refresh_at).length || 0
    console.log(`\n${refreshedCount} tables show they were refreshed`)
  }
}

checkTableData().catch(console.error)