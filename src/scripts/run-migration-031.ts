#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  console.log('🔄 Running migration 031: Fix ASIN column length...\n')

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../lib/supabase/migrations/031_fix_asin_column_length.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    // Split into individual statements (simple split by semicolon at end of line)
    const statements = migrationSQL
      .split(/;\s*$/m)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`Found ${statements.length} SQL statements to execute`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      
      // Skip if it's just a comment
      if (statement.trim().startsWith('--')) continue
      
      console.log(`\nExecuting statement ${i + 1}/${statements.length}...`)
      console.log(`Preview: ${statement.substring(0, 60)}...`)
      
      const { error } = await supabase.rpc('exec_sql', {
        sql_query: statement + ';'
      })
      
      if (error) {
        console.error(`❌ Error in statement ${i + 1}:`, error)
        
        // Try using a direct query if RPC doesn't exist
        if (error.message?.includes('exec_sql')) {
          console.log('Trying alternative method...')
          
          // For this migration, we need to run it manually
          console.log('\n⚠️  Cannot run DDL statements through Supabase client.')
          console.log('Please run the following migration manually in Supabase SQL Editor:\n')
          console.log('```sql')
          console.log(migrationSQL)
          console.log('```')
          return
        }
      } else {
        console.log(`✅ Statement ${i + 1} executed successfully`)
      }
    }

    console.log('\n✅ Migration completed successfully!')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    console.log('\n📋 To run this migration manually, execute the following SQL in Supabase dashboard:')
    console.log('\n--- START MIGRATION ---')
    const migrationPath = path.join(__dirname, '../lib/supabase/migrations/031_fix_asin_column_length.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')
    console.log(migrationSQL)
    console.log('--- END MIGRATION ---')
  }
}

// Run the migration
runMigration()