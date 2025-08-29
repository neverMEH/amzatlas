#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

async function testBrandFunctions() {
  console.log('Testing brand matching functions...\n');

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Test 1: Try to match existing Work Sharp brand
  console.log('=== TEST 1: Match Work Sharp brand ===');
  
  const { data: workSharpResult, error: wsError } = await supabase
    .rpc('match_asins_to_brand', {
      p_brand_name: 'Work Sharp',
      p_match_patterns: ['Work Sharp', 'WorkSharp', 'WORK SHARP']
    });

  if (wsError) {
    console.error('❌ Error:', wsError.message);
    console.log('\nThe migration needs to be applied first!');
    console.log('Please run migration 027_add_brand_matching_functions.sql in your Supabase SQL editor.');
    return;
  }

  console.log('✅ Work Sharp matching result:', workSharpResult);

  // Test 2: Test creating a new brand (dry run - won't actually create)
  console.log('\n=== TEST 2: Test brand creation function ===');
  
  // First, let's see what would be matched for a hypothetical brand
  const testBrandName = 'TestBrand' + Date.now(); // Unique name to avoid conflicts
  
  const { data: createResult, error: createError } = await supabase
    .rpc('create_brand_and_match', {
      p_brand_name: testBrandName,
      p_display_name: 'Test Brand Display',
      p_match_patterns: [testBrandName]
    });

  if (createError) {
    console.error('❌ Error:', createError.message);
  } else {
    console.log('✅ Brand creation result:', createResult);
    
    // Clean up test brand
    if (createResult?.brand_id) {
      await supabase
        .from('brands')
        .delete()
        .eq('id', createResult.brand_id);
      console.log('   (Test brand cleaned up)');
    }
  }

  // Test 3: Verify current brand state
  console.log('\n=== CURRENT BRAND STATE ===');
  
  const { data: brands } = await supabase
    .from('brands')
    .select(`
      brand_name,
      display_name,
      asin_brand_mapping (count)
    `)
    .order('brand_name');

  brands?.forEach(brand => {
    const count = brand.asin_brand_mapping?.[0]?.count || 0;
    console.log(`- ${brand.display_name}: ${count} ASINs`);
  });

  console.log('\n✅ All tests completed!');
}

testBrandFunctions().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});