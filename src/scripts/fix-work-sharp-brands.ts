#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

async function fixWorkSharpBrands() {
  console.log('Fixing brand assignments for Work Sharp products...\n');

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Step 1: Find or create the "Work Sharp" brand
  console.log('1. Setting up Work Sharp brand...');
  
  // Check if Work Sharp brand exists
  let { data: existingBrand } = await supabase
    .from('brands')
    .select('*')
    .eq('brand_name', 'Work Sharp')
    .single();

  let workSharpBrandId;
  
  if (!existingBrand) {
    // Create Work Sharp brand
    const { data: newBrand, error: brandError } = await supabase
      .from('brands')
      .insert({
        brand_name: 'Work Sharp',
        normalized_name: 'work-sharp',
        display_name: 'Work Sharp',
        is_active: true
      })
      .select()
      .single();

    if (brandError) {
      console.error('Error creating Work Sharp brand:', brandError);
      return;
    }
    
    workSharpBrandId = newBrand.id;
    console.log('✅ Created Work Sharp brand');
  } else {
    workSharpBrandId = existingBrand.id;
    console.log('✅ Found existing Work Sharp brand');
  }

  // Step 2: Get all ASINs with product titles containing "Work Sharp"
  console.log('\n2. Finding all Work Sharp products...');
  
  const { data: workSharpProducts, error: productError } = await supabase
    .from('asin_performance_data')
    .select('asin, product_title')
    .or('product_title.ilike.%Work Sharp%,product_title.ilike.%WorkSharp%')
    .not('product_title', 'is', null);

  if (productError) {
    console.error('Error fetching products:', productError);
    return;
  }

  // Get unique ASINs
  const uniqueASINs = new Set<string>();
  const asinTitleMap = new Map<string, string>();
  
  workSharpProducts?.forEach(p => {
    uniqueASINs.add(p.asin);
    asinTitleMap.set(p.asin, p.product_title);
  });

  console.log(`Found ${uniqueASINs.size} unique Work Sharp ASINs`);

  // Step 3: Clear existing incorrect mappings for these ASINs
  console.log('\n3. Clearing incorrect brand mappings...');
  
  const { error: deleteError } = await supabase
    .from('asin_brand_mapping')
    .delete()
    .in('asin', Array.from(uniqueASINs));

  if (deleteError && deleteError.code !== 'PGRST116') {
    console.error('Error clearing mappings:', deleteError);
  } else {
    console.log('✅ Cleared existing mappings');
  }

  // Step 4: Create correct mappings
  console.log('\n4. Creating correct brand mappings...');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const asin of uniqueASINs) {
    const productTitle = asinTitleMap.get(asin) || 'Work Sharp Product';
    
    const { error } = await supabase
      .from('asin_brand_mapping')
      .insert({
        asin: asin,
        brand_id: workSharpBrandId,
        product_title: productTitle,
        extraction_method: 'automatic',
        confidence_score: 0.95,
        verified: true
      });

    if (error) {
      if (error.code !== '23505') { // Ignore duplicate key errors
        console.error(`Error mapping ${asin}:`, error.message);
        errorCount++;
      }
    } else {
      successCount++;
    }
  }

  console.log(`✅ Created ${successCount} mappings`);
  if (errorCount > 0) {
    console.log(`⚠️  ${errorCount} errors occurred`);
  }

  // Step 5: Clean up incorrect brands
  console.log('\n5. Cleaning up incorrect brands...');
  
  // Delete brands that are actually product names
  const incorrectBrandPatterns = [
    '%Kit%',
    '%Upgrade%',
    '%Sharpener%',
    '%Electric%',
    '%Professional%',
    '%Benchtop%',
    '%EDC%',
    '%Pivot%'
  ];

  for (const pattern of incorrectBrandPatterns) {
    const { error } = await supabase
      .from('brands')
      .delete()
      .ilike('brand_name', pattern)
      .neq('id', workSharpBrandId);

    if (error && error.code !== 'PGRST116') {
      console.error(`Error deleting brands matching ${pattern}:`, error.message);
    }
  }

  console.log('✅ Cleaned up incorrect brands');

  // Step 6: Verify results
  console.log('\n=== VERIFICATION ===');
  
  const { count: totalMappings } = await supabase
    .from('asin_brand_mapping')
    .select('*', { count: 'exact', head: true })
    .eq('brand_id', workSharpBrandId);

  console.log(`Total Work Sharp ASIN mappings: ${totalMappings}`);

  // Sample verification
  const { data: samples } = await supabase
    .from('asin_brand_mapping')
    .select(`
      asin,
      product_title,
      brands (brand_name, display_name)
    `)
    .eq('brand_id', workSharpBrandId)
    .limit(5);

  console.log('\nSample Work Sharp products:');
  samples?.forEach(s => {
    console.log(`- ${s.asin}: ${s.product_title}`);
  });

  // Check remaining brands
  const { data: remainingBrands } = await supabase
    .from('brands')
    .select('brand_name, display_name')
    .order('brand_name');

  console.log('\nRemaining brands in database:');
  remainingBrands?.forEach(b => {
    console.log(`- ${b.display_name}`);
  });
}

fixWorkSharpBrands().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});