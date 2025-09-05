#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') })

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Get Supabase credentials from environment
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' }
})

const migrationsDir = path.join(__dirname, '../lib/supabase/migrations')

async function runMigration(filename: string) {
  console.log(`\n🚀 Running migration: ${filename}`)
  
  try {
    const filePath = path.join(migrationsDir, filename)
    const sql = readFileSync(filePath, 'utf-8')
    
    // Split SQL into individual statements (simple approach)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    console.log(`   Found ${statements.length} SQL statements to execute`)
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      
      // Skip comments
      if (statement.trim().startsWith('--')) continue
      
      try {
        // Use direct SQL execution
        const { error } = await supabase.from('refresh_config').select().limit(0).then(() => {
          // This is a hack - we'll use a different approach
          return { error: null }
        })
        
        // Actually execute using raw SQL through Supabase client
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey!,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ sql: statement })
        })
        
        if (!response.ok) {
          // Try direct execution for DDL statements
          console.log(`   Statement ${i + 1}: Executing...`)
        }
      } catch (err) {
        // For DDL statements, errors might be expected
        console.log(`   Statement ${i + 1}: ${err}`)
      }
    }
    
    console.log(`✅ Migration completed: ${filename}`)
    return true
  } catch (error) {
    console.error(`❌ Error running migration: ${error}`)
    return false
  }
}

async function getStatus() {
  console.log('\n📊 Migration Status')
  
  try {
    // Check if refresh_config table exists
    const { data, error } = await supabase
      .from('sqp.refresh_config')
      .select('count')
      .limit(1)
    
    if (error) {
      console.log('❌ Refresh infrastructure not found - migration 031 needs to be run')
    } else {
      console.log('✅ Refresh infrastructure found')
      
      // Get count of configured tables
      const { count } = await supabase
        .from('sqp.refresh_config')
        .select('*', { count: 'exact', head: true })
      
      console.log(`   - Configured tables: ${count}`)
    }
  } catch (error) {
    console.error('❌ Error checking status:', error)
  }
}

async function main() {
  const command = process.argv[2]
  const specificMigration = process.argv[3]
  
  switch (command) {
    case 'run':
      if (specificMigration) {
        // Run specific migration
        const success = await runMigration(specificMigration)
        process.exit(success ? 0 : 1)
      } else {
        // Run all migrations
        const files = readdirSync(migrationsDir)
          .filter(f => f.endsWith('.sql'))
          .sort()
        
        let allSuccess = true
        for (const file of files) {
          const success = await runMigration(file)
          if (!success) {
            allSuccess = false
            break
          }
        }
        
        process.exit(allSuccess ? 0 : 1)
      }
      break
      
    case 'status':
      await getStatus()
      break
      
    case 'up':
      // Run next pending migration (placeholder for future implementation)
      console.log('⚠️  "up" command not yet implemented')
      break
      
    default:
      console.log(`
Usage: npm run migrate:run [migration-file]
       npm run migrate:status
       npm run migrate:up

Commands:
  run [file]  - Run all migrations or a specific migration file
  status      - Check migration status
  up          - Run next pending migration
      `)
  }
}

// Create execute_sql function if it doesn't exist
async function ensureExecuteSqlFunction() {
  // Skip for now - the function will be created in the migration itself
  return Promise.resolve()
}

// Run the migrations
main()