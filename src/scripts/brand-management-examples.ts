#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

async function demonstrateBrandManagement() {
  console.log('Brand Management Examples\n');

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('=== EXAMPLE 1: Match existing Work Sharp brand ===');
  
  // Match ASINs to existing Work Sharp brand
  const { data: workSharpMatch, error: wsError } = await supabase
    .rpc('match_asins_to_brand', {
      p_brand_name: 'Work Sharp',
      p_match_patterns: ['Work Sharp', 'WorkSharp', 'WORK SHARP']
    });

  if (wsError) {
    console.error('Error matching Work Sharp:', wsError);
  } else {
    console.log('Work Sharp matching result:', workSharpMatch);
  }

  console.log('\n=== EXAMPLE 2: Add a new brand and auto-match ===');
  
  // Example: Adding Spyderco brand
  const { data: spydercoResult, error: spydercoError } = await supabase
    .rpc('create_brand_and_match', {
      p_brand_name: 'Spyderco',
      p_display_name: 'Spyderco Knives',
      p_match_patterns: ['Spyderco', 'SPYDERCO']
    });

  if (spydercoError) {
    console.error('Error creating Spyderco brand:', spydercoError);
  } else {
    console.log('Spyderco brand creation result:', spydercoResult);
  }

  console.log('\n=== EXAMPLE 3: Check current brand statistics ===');
  
  // Get brand statistics
  const { data: brandStats } = await supabase
    .from('brands')
    .select(`
      brand_name,
      display_name,
      asin_brand_mapping (count)
    `)
    .order('brand_name');

  console.log('\nCurrent brands and their ASIN counts:');
  brandStats?.forEach(brand => {
    const count = brand.asin_brand_mapping?.[0]?.count || 0;
    console.log(`- ${brand.display_name}: ${count} ASINs`);
  });

  console.log('\n=== EXAMPLE 4: Manual brand assignment ===');
  
  // If you want to manually assign a specific ASIN to a brand
  const exampleASIN = 'B000EXAMPLE';
  const exampleBrandId = workSharpMatch?.brand_id;
  
  if (exampleBrandId) {
    console.log(`\nTo manually assign an ASIN to a brand, you would use:`);
    console.log(`
await supabase
  .from('asin_brand_mapping')
  .upsert({
    asin: '${exampleASIN}',
    brand_id: '${exampleBrandId}',
    product_title: 'Example Product Title',
    extraction_method: 'manual',
    confidence_score: 1.0,
    verified: true
  });
    `);
  }

  console.log('\n=== HOW TO USE IN YOUR APPLICATION ===');
  console.log(`
1. To add a new brand and automatically match all ASINs:
   - Use: create_brand_and_match('Brand Name', 'Display Name', ['pattern1', 'pattern2'])
   
2. To match ASINs to an existing brand:
   - Use: match_asins_to_brand('Brand Name', ['pattern1', 'pattern2'])
   
3. Automatic matching happens when:
   - New product titles are added during sync
   - Product titles are updated
   - The trigger will check all active brands and match automatically
   
4. To manually verify/override mappings:
   - Update asin_brand_mapping.verified = true
   - Set confidence_score = 1.0 for manual overrides
  `);
}

demonstrateBrandManagement().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});