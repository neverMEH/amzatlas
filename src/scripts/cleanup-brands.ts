#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

async function cleanupBrands() {
  console.log('Cleaning up incorrect brand entries...\n');

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get all brands
  const { data: allBrands } = await supabase
    .from('brands')
    .select('id, brand_name, display_name')
    .order('brand_name');

  console.log('Current brands:');
  allBrands?.forEach(b => {
    console.log(`- ${b.brand_name} (${b.display_name})`);
  });

  // Identify brands that are clearly not real brands
  const notRealBrands = [
    'Fine',
    'Official',
    'Official Work Sharp Knife',
    'Upgrade',
    'Work',  // Too generic
    'Unknown Brand',
    'Work Sharp Benchstone Knife',
    'Work Sharp Blade Grinder Attachment',
    'Work Sharp Guided Field',
    'Work Sharp Guided Sharpening',
    'Work Sharp Ken Onion Edition Knife',
    'Work Sharp Knife',
    'Work Sharp Knife Sharpening',
    'Work Sharp Portable Pocket',
    'Work Sharp Rolling Knife',
    'Fine Abrasive Kit',
    'Upgrade Kit',
    'Work Sharp Benchtop Whetstone Knife Sharpener',
    'Work Sharp EDC Pivot Plus Knife Sharpener',
    'Work Sharp Professional Precision Adjust',
    'Work Sharp Professional Electric Culinary',
    'Work Sharp Professional Electric Kitchen Knife Sharpener Upgrade'
  ];

  console.log('\nRemoving incorrect brand entries...');

  for (const brandName of notRealBrands) {
    // First remove any mappings
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('brand_name', brandName)
      .single();

    if (brand) {
      // Remove mappings first
      await supabase
        .from('asin_brand_mapping')
        .delete()
        .eq('brand_id', brand.id);

      // Then remove the brand
      const { error } = await supabase
        .from('brands')
        .delete()
        .eq('id', brand.id);

      if (!error) {
        console.log(`✅ Removed: ${brandName}`);
      } else {
        console.log(`❌ Could not remove ${brandName}: ${error.message}`);
      }
    }
  }

  // Verify final state
  console.log('\n=== FINAL STATE ===');
  
  const { data: finalBrands } = await supabase
    .from('brands')
    .select(`
      brand_name,
      display_name,
      asin_brand_mapping (count)
    `)
    .order('brand_name');

  console.log('\nRemaining brands:');
  finalBrands?.forEach(b => {
    const count = b.asin_brand_mapping?.[0]?.count || 0;
    console.log(`- ${b.display_name}: ${count} ASINs`);
  });

  console.log('\n✅ Cleanup complete!');
}

cleanupBrands().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});