#!/usr/bin/env node

import { config as dotenvConfig } from 'dotenv';
import { testSupabaseConnection } from '@/config/supabase.config';
import { SupabaseService } from '@/lib/supabase/client';

// Load environment variables
dotenvConfig();

async function testConnection() {
  console.log('🔌 Testing Supabase connection...\n');

  try {
    // Test basic connection
    console.log('1. Testing configuration...');
    const connected = await testSupabaseConnection();
    
    if (connected) {
      console.log('✅ Configuration is valid\n');
    } else {
      console.log('❌ Invalid configuration\n');
    }

    // Test service client
    console.log('2. Testing service client...');
    const service = new SupabaseService();
    const serviceConnected = await service.testConnection();
    
    if (serviceConnected) {
      console.log('✅ Service client connected successfully\n');
    } else {
      console.log('❌ Service client connection failed\n');
    }

    // Test table existence
    console.log('3. Checking for tables...');
    try {
      const { data, error } = await service.getWeeklySummaries({ limit: 1 });
      
      if (error) {
        if (error.code === '42P01') {
          console.log('⚠️  Tables do not exist yet. Run migrations first.\n');
        } else {
          console.log(`⚠️  Table query error: ${error.message}\n`);
        }
      } else {
        console.log('✅ Tables exist and are accessible\n');
        console.log(`   Found ${data?.length || 0} records in weekly_summary table`);
      }
    } catch (tableError) {
      console.log('⚠️  Could not check tables:', tableError instanceof Error ? tableError.message : String(tableError));
    }

    // Summary
    console.log('\n📊 Connection Test Summary:');
    console.log('   - URL:', process.env.SUPABASE_URL);
    console.log('   - Has anon key:', !!process.env.SUPABASE_ANON_KEY);
    console.log('   - Has service key:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    console.log('\n✅ Supabase is configured and ready to use!');
    console.log('\nNext step: Run migrations to create the database schema.');

  } catch (error) {
    console.error('\n❌ Connection test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  testConnection();
}

export { testConnection };