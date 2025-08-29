#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

async function applyPublicViews() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  console.log('Connecting to Supabase...');
  const supabase = createClient(supabaseUrl, supabaseKey, {
    db: {
      schema: 'public'
    }
  });

  // Since we can't execute raw SQL through the API, let's verify what tables exist
  console.log('Checking existing tables...');
  
  // Check if sqp.asin_performance_data exists by trying to query it
  const { data: asinData, error: asinError } = await supabase
    .from('asin_performance_data')
    .select('*')
    .limit(1);
  
  if (asinError && !asinError.message.includes('permission denied')) {
    console.log('asin_performance_data table not accessible:', asinError.message);
  } else {
    console.log('asin_performance_data table exists and is accessible');
  }

  // Check sqp schema tables by trying to query with schema prefix in Supabase client
  const sqpClient = createClient(supabaseUrl, supabaseKey, {
    db: {
      schema: 'sqp'
    }
  });

  console.log('\nChecking sqp schema tables...');
  const tables = ['asin_performance_data', 'search_query_performance', 'sync_log', 'data_quality_checks', 'asin_brand_mapping', 'brands', 'brand_hierarchy'];
  
  for (const table of tables) {
    const { error } = await sqpClient
      .from(table)
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(`❌ sqp.${table}: ${error.message}`);
    } else {
      console.log(`✅ sqp.${table} exists`);
    }
  }

  console.log('\n⚠️  Migration must be applied through Supabase Dashboard SQL Editor:');
  console.log('1. Go to https://supabase.com/dashboard/project/unkdghonqrxplvjxeotl/sql');
  console.log('2. Copy the content from src/lib/supabase/migrations/026_create_public_views_for_sqp_tables.sql');
  console.log('3. Run the migration in the SQL editor');
  console.log('\nThis will create public views that expose the sqp schema tables through the API.');
}

applyPublicViews().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});