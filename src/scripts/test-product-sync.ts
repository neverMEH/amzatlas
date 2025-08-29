#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

async function testProductSync() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Testing product title sync...\n');

  // Test 1: Check if we can read asin_performance_data
  console.log('1. Checking asin_performance_data table...');
  const { data: existingData, error: readError } = await supabase
    .from('asin_performance_data')
    .select('id, asin, product_title, start_date, end_date')
    .limit(5);

  if (readError) {
    console.error('❌ Error reading table:', readError);
    return;
  }

  console.log(`✅ Found ${existingData?.length || 0} existing records`);
  if (existingData && existingData.length > 0) {
    console.log('Sample record:', existingData[0]);
  }

  // Test 2: Try to insert a test record
  console.log('\n2. Testing insert with product title...');
  const testData = {
    start_date: '2024-08-18',
    end_date: '2024-08-24',
    asin: 'TEST_ASIN_001',
    product_title: 'Test Product Title - Widget'
  };

  const { data: insertData, error: insertError } = await supabase
    .from('asin_performance_data')
    .insert(testData)
    .select();

  if (insertError) {
    console.error('❌ Error inserting:', insertError);
    
    // Try update instead
    console.log('\n3. Trying to update existing record...');
    const { data: updateData, error: updateError } = await supabase
      .from('asin_performance_data')
      .update({ product_title: 'Updated Product Title' })
      .eq('asin', 'TEST_ASIN_001')
      .select();

    if (updateError) {
      console.error('❌ Error updating:', updateError);
    } else {
      console.log('✅ Updated successfully:', updateData);
    }
  } else {
    console.log('✅ Inserted successfully:', insertData);
  }

  // Test 3: Check if product_title column exists
  console.log('\n4. Checking for records with product titles...');
  const { data: titledData, error: titledError } = await supabase
    .from('asin_performance_data')
    .select('asin, product_title')
    .not('product_title', 'is', null)
    .limit(10);

  if (titledError) {
    console.error('❌ Error querying product titles:', titledError);
  } else {
    console.log(`✅ Found ${titledData?.length || 0} records with product titles`);
    if (titledData && titledData.length > 0) {
      console.log('Sample records with titles:', titledData.slice(0, 3));
    }
  }

  // Test 4: Check unique constraints
  console.log('\n5. Testing upsert operation...');
  const upsertData = {
    start_date: '2024-08-18',
    end_date: '2024-08-24',
    asin: 'B09MW2ZXKR',
    product_title: 'Test Upsert Product'
  };

  const { data: upsertResult, error: upsertError } = await supabase
    .from('asin_performance_data')
    .upsert(upsertData, {
      onConflict: 'asin,start_date,end_date', // This might not work if no constraint exists
      ignoreDuplicates: false
    })
    .select();

  if (upsertError) {
    console.error('❌ Upsert failed:', upsertError);
    console.log('\nTrying insert without onConflict...');
    
    // Just try a simple update
    const { data: simpleUpdate, error: simpleError } = await supabase
      .from('asin_performance_data')
      .update({ product_title: upsertData.product_title })
      .eq('asin', upsertData.asin)
      .eq('start_date', upsertData.start_date)
      .eq('end_date', upsertData.end_date)
      .select();

    if (simpleError) {
      console.error('❌ Simple update failed:', simpleError);
    } else if (simpleUpdate && simpleUpdate.length > 0) {
      console.log('✅ Updated via simple update:', simpleUpdate);
    } else {
      console.log('⚠️  No records matched for update');
    }
  } else {
    console.log('✅ Upsert successful:', upsertResult);
  }
}

testProductSync().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});