import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function checkMissingMigrations() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  console.log('Checking for missing database objects...\n')
  
  // Check for sync_log in public schema
  const { data: syncLogExists } = await supabase
    .from('sync_log')
    .select('count')
    .limit(1)
    
  if (!syncLogExists) {
    console.log('❌ Missing: public.sync_log view')
    console.log('   → Run migration 016_create_public_sync_views.sql')
  } else {
    console.log('✅ Found: public.sync_log view')
  }
  
  // Check for data_quality_checks
  const { data: qualityChecksExists } = await supabase
    .from('data_quality_checks')
    .select('count')
    .limit(1)
    
  if (!qualityChecksExists) {
    console.log('❌ Missing: public.data_quality_checks view')
    console.log('   → Run migration 016_create_public_sync_views.sql')
  } else {
    console.log('✅ Found: public.data_quality_checks view')
  }
  
  // Check for pipeline_health view
  const { data: pipelineHealthExists } = await supabase
    .from('pipeline_health')
    .select('count')
    .limit(1)
    
  if (!pipelineHealthExists) {
    console.log('❌ Missing: public.pipeline_health view')
    console.log('   → Run migration 048_cleanup_refresh_infrastructure.sql')
  } else {
    console.log('✅ Found: public.pipeline_health view')
  }
  
  // Check for data_freshness_summary
  const { data: freshnessExists } = await supabase
    .from('data_freshness_summary')
    .select('count')
    .limit(1)
    
  if (!freshnessExists) {
    console.log('❌ Missing: public.data_freshness_summary view')
    console.log('   → Run migration 048_cleanup_refresh_infrastructure.sql')
  } else {
    console.log('✅ Found: public.data_freshness_summary view')
  }
  
  // Check sqp.sync_log table exists
  const { data: syncLogTable } = await supabase.rpc('check_table_exists', {
    schema_name: 'sqp',
    table_name: 'sync_log'
  })
  
  if (!syncLogTable) {
    console.log('❌ Missing: sqp.sync_log table')
    console.log('   → Run migration 007_add_sync_tracking.sql')
  } else {
    console.log('✅ Found: sqp.sync_log table')
  }
  
  console.log('\n✅ = Object exists')
  console.log('❌ = Object missing, run the indicated migration')
}

// First create the helper function
async function createHelperFunction() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  const { error } = await supabase.rpc('exec_sql', {
    query: `
      CREATE OR REPLACE FUNCTION check_table_exists(schema_name text, table_name text)
      RETURNS boolean AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = schema_name 
          AND table_name = table_name
        );
      END;
      $$ LANGUAGE plpgsql;
    `
  })
  
  if (error && !error.message.includes('already exists')) {
    console.error('Error creating helper function:', error)
  }
}

checkMissingMigrations().catch(console.error)