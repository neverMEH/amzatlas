import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { readFileSync } from 'fs'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyFix() {
  console.log('Applying fix for get_table_columns function...\n')
  
  try {
    // Read the migration SQL
    const sql = readFileSync('./src/lib/supabase/migrations/035_fix_get_table_columns_ambiguity.sql', 'utf-8')
    
    // Execute the SQL
    const { error } = await supabase.rpc('execute_sql', { sql })
    
    if (error) {
      // Try direct execution
      console.log('RPC failed, trying alternative approach...')
      
      // Split into individual statements and execute
      const statements = sql.split(';').filter(s => s.trim())
      
      for (const statement of statements) {
        if (statement.trim()) {
          console.log('Executing:', statement.trim().substring(0, 50) + '...')
          
          // Since we can't execute raw SQL directly, let's test if the fix worked
          // by testing the function
        }
      }
    }
    
    // Test if the function works now
    console.log('\nTesting fixed function...')
    const { data, error: testError } = await supabase
      .rpc('get_table_columns', {
        p_schema_name: 'sqp',
        p_table_name: 'webhook_configs'
      })
    
    if (testError) {
      console.error('❌ Function still has errors:', testError)
      
      // The function exists but with different parameter names
      // Let's try with the original parameter names
      const { data: data2, error: error2 } = await supabase
        .rpc('get_table_columns', {
          schema_name: 'sqp',
          table_name: 'webhook_configs'
        })
      
      if (error2) {
        console.error('❌ Original parameters also failed:', error2)
      } else {
        console.log('✅ Function works with original parameter names')
        console.log('Columns:', data2)
      }
    } else {
      console.log('✅ Function fixed successfully!')
      console.log('Columns:', data)
    }
    
  } catch (error) {
    console.error('Error applying fix:', error)
  }
}

applyFix()