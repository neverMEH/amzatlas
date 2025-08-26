#!/usr/bin/env node

import { config as dotenvConfig } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenvConfig();

async function testSchema() {
  console.log('🔍 Testing Supabase schema setup...\n');

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
      },
    }
  );

  try {
    // Check if sqp schema exists
    console.log('1. Checking for sqp schema...');
    const { data: schemas, error: schemaError } = await supabase
      .from('information_schema.schemata')
      .select('schema_name')
      .eq('schema_name', 'sqp');

    if (schemaError) {
      console.log('   Could not query schemas:', schemaError.message);
    } else if (schemas && schemas.length > 0) {
      console.log('✅ sqp schema exists\n');
    } else {
      console.log('❌ sqp schema not found\n');
    }

    // Try a direct query
    console.log('2. Testing direct table query...');
    const { data, error } = await supabase
      .from('weekly_summary')
      .select('*')
      .limit(1);

    if (error) {
      if (error.message.includes('not found')) {
        console.log('   Table not found in public schema (expected)\n');
      } else {
        console.log('   Error:', error.message);
      }
    } else {
      console.log('   Query succeeded, found', data?.length || 0, 'records\n');
    }

    // Try with schema set
    console.log('3. Testing with schema set in options...');
    const supabaseWithSchema = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
        },
        db: {
          schema: 'sqp',
        },
      }
    );

    const { data: sqpData, error: sqpError } = await supabaseWithSchema
      .from('weekly_summary')
      .select('*')
      .limit(1);

    if (sqpError) {
      console.log('   Error:', sqpError.message);
      console.log('   This might mean the sqp schema is not exposed in PostgREST\n');
    } else {
      console.log('✅ Successfully queried sqp.weekly_summary!');
      console.log('   Found', sqpData?.length || 0, 'records\n');
    }

    // Check PostgREST configuration
    console.log('💡 Important: For the sqp schema to work, you need to:');
    console.log('   1. Go to Supabase Dashboard > Settings > API');
    console.log('   2. Under "Schema", add "sqp" to the exposed schemas');
    console.log('   3. Save changes and wait for the API to restart\n');

    console.log('📚 Alternative: Use views in the public schema that reference sqp tables');
    console.log('   CREATE VIEW public.weekly_summary AS SELECT * FROM sqp.weekly_summary;');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Run if called directly
if (require.main === module) {
  testSchema();
}

export { testSchema };