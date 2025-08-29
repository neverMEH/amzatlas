#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { program } from 'commander';

// Load environment variables
config();

program
  .name('add-brand')
  .description('Add a new brand and automatically match ASINs')
  .argument('<brand-name>', 'Brand name (e.g., "Spyderco")')
  .option('-d, --display-name <name>', 'Display name for the brand')
  .option('-p, --patterns <patterns...>', 'Additional patterns to match (space-separated)')
  .option('--dry-run', 'Show what would be matched without creating')
  .parse();

async function addBrand() {
  const brandName = program.args[0];
  const options = program.opts();
  
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log(`\nAdding brand: ${brandName}`);
  if (options.displayName) {
    console.log(`Display name: ${options.displayName}`);
  }
  
  // Build patterns array
  const patterns = [brandName];
  if (options.patterns) {
    patterns.push(...options.patterns);
  }
  console.log(`Match patterns: ${patterns.join(', ')}`);

  if (options.dryRun) {
    console.log('\n[DRY RUN MODE - No changes will be made]');
    
    // Show what would be matched
    let totalMatches = 0;
    for (const pattern of patterns) {
      const { count } = await supabase
        .from('asin_performance_data')
        .select('*', { count: 'exact', head: true })
        .ilike('product_title', `%${pattern}%`);
      
      console.log(`Pattern "${pattern}" would match: ${count || 0} ASINs`);
      totalMatches += count || 0;
    }
    
    console.log(`\nTotal potential matches: ${totalMatches} ASINs`);
    
    // Show sample matches
    const { data: samples } = await supabase
      .from('asin_performance_data')
      .select('asin, product_title')
      .ilike('product_title', `%${brandName}%`)
      .limit(5);
    
    if (samples && samples.length > 0) {
      console.log('\nSample products that would be matched:');
      samples.forEach(s => {
        console.log(`- ${s.asin}: ${s.product_title}`);
      });
    }
    
    return;
  }

  // Actually create the brand and match ASINs
  const { data: result, error } = await supabase
    .rpc('create_brand_and_match', {
      p_brand_name: brandName,
      p_display_name: options.displayName || brandName,
      p_match_patterns: patterns
    });

  if (error) {
    console.error('\nError creating brand:', error);
    process.exit(1);
  }

  console.log('\n✅ Brand created successfully!');
  console.log(`Brand ID: ${result.brand_id}`);
  console.log(`Matched ASINs: ${result.match_result.matched_count}`);
  
  // Show some sample matches
  if (result.match_result.matched_count > 0) {
    const { data: samples } = await supabase
      .from('asin_brand_mapping')
      .select('asin, product_title, confidence_score')
      .eq('brand_id', result.brand_id)
      .order('confidence_score', { ascending: false })
      .limit(5);
    
    console.log('\nSample matched products:');
    samples?.forEach(s => {
      console.log(`- ${s.asin}: ${s.product_title} (confidence: ${s.confidence_score})`);
    });
  }
}

addBrand().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});