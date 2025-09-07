import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkTableStructure() {
  console.log('Checking actual table structures...\n')
  
  // Query to get column information
  const { data: auditColumns, error: auditError } = await supabase
    .rpc('run_sql', {
      query: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'sqp' 
        AND table_name = 'refresh_audit_log'
        ORDER BY ordinal_position
      `
    })
  
  if (auditError) {
    // Try alternative approach
    console.log('Trying alternative approach...')
    
    // Just try to select from the table
    const { data, error } = await supabase
      .from('refresh_audit_log')
      .select('*')
      .limit(1)
    
    if (error) {
      console.error('Error selecting from refresh_audit_log:', error)
    } else {
      console.log('Sample refresh_audit_log record:', data)
      if (data && data.length > 0) {
        console.log('Available columns:', Object.keys(data[0]))
      }
    }
  } else {
    console.log('refresh_audit_log columns:', auditColumns)
  }
  
  // Check refresh_config
  console.log('\n=== Checking refresh_config ===')
  const { data: configData, error: configError } = await supabase
    .from('refresh_config')
    .select('*')
    .limit(1)
  
  if (configError) {
    console.error('Error selecting from refresh_config:', configError)
  } else {
    console.log('Sample refresh_config record:', configData)
    if (configData && configData.length > 0) {
      console.log('Available columns:', Object.keys(configData[0]))
    }
  }
}

checkTableStructure().catch(console.error)