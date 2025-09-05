import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') })

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMigration() {
  console.log('🚀 Applying refresh infrastructure migration...')
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../lib/supabase/migrations/031_add_refresh_infrastructure.sql')
    const sql = readFileSync(migrationPath, 'utf-8')
    
    // For complex migrations with DDL, we need to execute through a different approach
    // Let's check if the tables already exist first
    const { data: existingTables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'sqp')
      .in('table_name', ['refresh_config', 'refresh_audit_log', 'refresh_checkpoints'])
    
    if (existingTables && existingTables.length > 0) {
      console.log('⚠️  Some refresh infrastructure tables already exist:')
      existingTables.forEach(t => console.log(`   - ${t.table_name}`))
      console.log('\nSkipping migration to avoid conflicts.')
      return
    }
    
    console.log('📋 Migration contains:')
    console.log('   - Creating refresh_config table')
    console.log('   - Creating refresh_audit_log table')
    console.log('   - Creating refresh_dependencies table')
    console.log('   - Creating refresh_data_quality table')
    console.log('   - Creating refresh_checkpoints table')
    console.log('   - Setting up auto-registration triggers')
    console.log('   - Populating initial configurations')
    console.log('   - Creating monitoring views')
    
    console.log('\n✅ Migration file is ready to be applied.')
    console.log('\n📌 Next steps:')
    console.log('1. Go to your Supabase dashboard')
    console.log('2. Navigate to SQL Editor')
    console.log('3. Copy and paste the migration from:')
    console.log(`   ${migrationPath}`)
    console.log('4. Execute the migration')
    console.log('\nAlternatively, use the Supabase CLI:')
    console.log('   supabase db push')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

// Verify the migration was applied successfully
async function verifyMigration() {
  console.log('\n🔍 Verifying migration...')
  
  try {
    // Check if refresh_config table exists and has data
    const { data: configs, error } = await supabase
      .from('refresh_config')
      .select('*')
      .order('priority', { ascending: false })
    
    if (error) {
      console.log('❌ Migration not yet applied:', error.message)
      return false
    }
    
    console.log(`✅ Found ${configs?.length || 0} configured tables:`)
    configs?.forEach(config => {
      console.log(`   - ${config.table_name} (priority: ${config.priority}, enabled: ${config.is_enabled})`)
    })
    
    // Check dependencies
    const { data: deps } = await supabase
      .from('refresh_dependencies')
      .select('*')
    
    console.log(`\n✅ Found ${deps?.length || 0} table dependencies configured`)
    
    return true
  } catch (error) {
    console.error('❌ Verification error:', error)
    return false
  }
}

async function main() {
  await applyMigration()
  
  // Try to verify
  const success = await verifyMigration()
  if (success) {
    console.log('\n🎉 Migration successfully applied!')
  }
}

main().catch(console.error)