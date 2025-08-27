#!/usr/bin/env node
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function setupSupabaseTables() {
  console.log('Setting up Supabase Tables\n');
  console.log('==========================\n');
  
  try {
    // Initialize Supabase with service role key for admin operations
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );
    
    // Read SQL file
    const sql = fs.readFileSync('./create-supabase-test-table.sql', 'utf8');
    
    console.log('Creating sqp_test table...\n');
    
    // Execute SQL
    // Note: Supabase JS client doesn't directly support raw SQL execution
    // We'll use RPC or direct connection for this
    
    console.log('SQL to execute:');
    console.log('================');
    console.log(sql);
    console.log('\n================\n');
    
    console.log('⚠️  Please execute the SQL above in your Supabase SQL editor:');
    console.log('   1. Go to your Supabase dashboard');
    console.log('   2. Navigate to SQL Editor');
    console.log('   3. Create a new query');
    console.log('   4. Paste the SQL from create-supabase-test-table.sql');
    console.log('   5. Run the query');
    console.log('\nAlternatively, you can use the Supabase CLI:');
    console.log('   supabase db push create-supabase-test-table.sql');
    
    // Check if table exists after manual creation
    console.log('\nChecking if sqp_test table exists...');
    
    const { data, error } = await supabase
      .from('sqp_test')
      .select('id')
      .limit(1);
    
    if (error && error.code === 'PGRST204') {
      console.log('❌ Table sqp_test not found. Please create it using the SQL above.');
    } else if (error) {
      console.log('❌ Error checking table:', error.message);
    } else {
      console.log('✅ Table sqp_test exists and is ready for data sync!');
      
      // Show table info
      const { count } = await supabase
        .from('sqp_test')
        .select('*', { count: 'exact', head: true });
      
      console.log(`   Current record count: ${count || 0}`);
    }
    
    console.log('\n📝 Next Steps:');
    console.log('   1. Create the table if not already created');
    console.log('   2. Run: node sync-bigquery-to-supabase.js top_5 "knife sharpener"');
    console.log('   3. Check the synced data in Supabase');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the setup
setupSupabaseTables();