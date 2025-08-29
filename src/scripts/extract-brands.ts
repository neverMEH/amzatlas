#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

async function extractBrands() {
  console.log('Starting brand extraction from product titles...\n');

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check if extract_brands_from_asin_data function exists
  console.log('Calling brand extraction function...');
  const { data, error } = await supabase.rpc('extract_brands_from_asin_data');

  if (error) {
    console.error('Error calling extract_brands_from_asin_data:', error);
    
    // Try alternate approach - get ASINs with titles and manually extract
    console.log('\nTrying manual brand extraction...');
    await manualBrandExtraction(supabase);
    return;
  }

  console.log('Brand extraction completed via RPC function');
  if (data) {
    console.log('Result:', data);
  }

  // Always verify results at the end
  await verifyBrandData(supabase);
}

async function manualBrandExtraction(supabase: any) {
  // Get ASINs with product titles
  const { data: asinsWithTitles, error } = await supabase
    .from('asin_performance_data')
    .select('asin, product_title')
    .not('product_title', 'is', null)
    .limit(1000);

  if (error) {
    console.error('Error fetching ASINs with titles:', error);
    return;
  }

  console.log(`Found ${asinsWithTitles?.length || 0} ASINs with product titles`);

  // Group by ASIN to get unique products
  const uniqueProducts = new Map<string, string>();
  asinsWithTitles?.forEach(record => {
    if (!uniqueProducts.has(record.asin)) {
      uniqueProducts.set(record.asin, record.product_title);
    }
  });

  console.log(`Processing ${uniqueProducts.size} unique products...`);

  // Common brand patterns
  const brandPatterns = [
    /^([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)\s+/,  // Brand at start
    /by\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)/i, // "by Brand"
    /from\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)/i, // "from Brand"
  ];

  const brandsFound = new Set<string>();
  const asinBrandMappings: Array<{asin: string, brand: string, title: string}> = [];

  for (const [asin, title] of uniqueProducts) {
    let brand = null;

    // Try each pattern
    for (const pattern of brandPatterns) {
      const match = title.match(pattern);
      if (match && match[1]) {
        brand = match[1].trim();
        // Filter out common non-brand words
        if (!['The', 'And', 'For', 'With', 'Set', 'Pack'].includes(brand)) {
          break;
        }
      }
    }

    // If no pattern match, try first word(s) before common product descriptors
    if (!brand) {
      const words = title.split(' ');
      const stopWords = ['Set', 'Pack', 'Bundle', 'Kit', 'Collection', 'Series'];
      let brandWords = [];
      
      for (const word of words) {
        if (stopWords.includes(word)) break;
        if (word.length > 2 && /^[A-Z]/.test(word)) {
          brandWords.push(word);
        }
        if (brandWords.length >= 2) break; // Max 2 words for brand
      }
      
      if (brandWords.length > 0) {
        brand = brandWords.join(' ');
      }
    }

    if (brand) {
      brandsFound.add(brand);
      asinBrandMappings.push({ asin, brand, title });
    }
  }

  console.log(`\nExtracted ${brandsFound.size} unique brands`);
  console.log('Sample brands:', Array.from(brandsFound).slice(0, 10));

  // Insert brands
  console.log('\nInserting brands...');
  let brandInsertCount = 0;
  for (const brandName of brandsFound) {
    const normalizedName = brandName.toLowerCase().replace(/\s+/g, '-');
    const { error } = await supabase
      .from('brands')
      .insert({ 
        brand_name: brandName,
        normalized_name: normalizedName,
        display_name: brandName
      })
      .select();

    if (!error) {
      brandInsertCount++;
    }
  }
  console.log(`Inserted ${brandInsertCount} new brands`);

  // Get brand IDs for mapping
  const { data: brands, error: brandError } = await supabase
    .from('brands')
    .select('id, brand_name');

  if (brandError) {
    console.error('Error fetching brands:', brandError);
    return;
  }

  const brandMap = new Map(brands?.map(b => [b.brand_name, b.id]) || []);

  // Insert ASIN-brand mappings
  console.log('\nCreating ASIN-brand mappings...');
  let mappingCount = 0;
  for (const mapping of asinBrandMappings) {
    const brandId = brandMap.get(mapping.brand);
    if (brandId) {
      const { error } = await supabase
        .from('asin_brand_mapping')
        .insert({
          asin: mapping.asin,
          brand_id: brandId,
          product_title: mapping.title,
          extraction_method: 'automatic',
          confidence_score: 0.7
        })
        .select();

      if (!error) {
        mappingCount++;
      } else if (error.code !== '23505') { // Ignore duplicate key errors
        console.error(`Error mapping ${mapping.asin}:`, error.message);
      }
    }
  }
  console.log(`Created ${mappingCount} ASIN-brand mappings`);
}

async function verifyBrandData(supabase: any) {
  console.log('\n=== VERIFICATION ===');

  // Count brands
  const { count: brandCount } = await supabase
    .from('brands')
    .select('*', { count: 'exact', head: true });
  console.log(`Total brands: ${brandCount || 0}`);

  // Count mappings
  const { count: mappingCount } = await supabase
    .from('asin_brand_mapping')
    .select('*', { count: 'exact', head: true });
  console.log(`Total ASIN-brand mappings: ${mappingCount || 0}`);

  // Sample data
  const { data: sampleMappings } = await supabase
    .from('asin_brand_mapping')
    .select(`
      asin,
      brands (brand_name, display_name)
    `)
    .limit(5);

  console.log('\nSample ASIN-brand mappings:');
  sampleMappings?.forEach(m => {
    console.log(`- ${m.asin}: ${m.brands?.display_name || 'Unknown'}`);
  });
}

extractBrands().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});