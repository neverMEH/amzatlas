import { createClient } from '@/lib/supabase/server'
import { readFileSync } from 'fs'
import { join } from 'path'

async function applyMigration() {
  try {
    const supabase = createClient()
    
    const migrationPath = join(process.cwd(), 'src/lib/supabase/migrations/031_create_brand_dashboard_views.sql')
    const migrationSql = readFileSync(migrationPath, 'utf-8')
    
    console.log('Applying migration: 031_create_brand_dashboard_views.sql')
    
    const { error } = await supabase.rpc('exec_sql', { query: migrationSql })
    
    if (error) {
      console.error('Migration failed:', error)
      process.exit(1)
    }
    
    console.log('Migration applied successfully!')
    process.exit(0)
  } catch (error) {
    console.error('Error applying migration:', error)
    process.exit(1)
  }
}

applyMigration()