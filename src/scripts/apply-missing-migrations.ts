#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function applyMissingMigrations() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  console.log('🔍 Checking and applying missing migrations...\n')
  
  // List of migrations to check and apply
  const migrations = [
    {
      name: '016_create_public_sync_views',
      checkQuery: "SELECT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'sync_log')",
      file: '016_create_public_sync_views.sql'
    },
    {
      name: '048_cleanup_refresh_infrastructure',
      checkQuery: "SELECT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'pipeline_health')",
      file: '048_cleanup_refresh_infrastructure.sql'
    }
  ]
  
  for (const migration of migrations) {
    console.log(`Checking ${migration.name}...`)
    
    // Check if migration is needed
    const { data: exists, error: checkError } = await supabase.rpc('exec_sql', {
      query: migration.checkQuery
    }).single()
    
    if (checkError) {
      console.error(`Error checking ${migration.name}:`, checkError)
      continue
    }
    
    if (!exists) {
      console.log(`  ❌ Missing - applying migration...`)
      
      // Read migration file
      const migrationPath = path.join(__dirname, '..', 'lib', 'supabase', 'migrations', migration.file)
      const migrationSql = fs.readFileSync(migrationPath, 'utf8')
      
      // Apply migration
      const { error: applyError } = await supabase.rpc('exec_sql', {
        query: migrationSql
      })
      
      if (applyError) {
        console.error(`  ❌ Failed to apply ${migration.name}:`, applyError.message)
      } else {
        console.log(`  ✅ Successfully applied ${migration.name}`)
      }
    } else {
      console.log(`  ✅ Already applied`)
    }
  }
  
  console.log('\n✅ Migration check complete')
}

// First ensure we have the exec_sql function
async function ensureExecSqlFunction() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  const { error } = await supabase.rpc('query', {
    query: `
      CREATE OR REPLACE FUNCTION exec_sql(query text)
      RETURNS json AS $$
      DECLARE
        result json;
      BEGIN
        EXECUTE query INTO result;
        RETURN result;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `
  })
  
  if (error && !error.message.includes('already exists')) {
    console.error('Note: exec_sql function may not exist, manual migration may be needed')
  }
}

ensureExecSqlFunction()
  .then(() => applyMissingMigrations())
  .catch(console.error)