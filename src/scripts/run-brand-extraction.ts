#!/usr/bin/env tsx
/**
 * Run brand extraction for all ASINs with product titles
 * This script ensures brand mappings are up-to-date after data sync
 */

import { config } from 'dotenv';
config();

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runBrandExtraction() {
  console.log(chalk.blue('\n=== Running Brand Extraction ===\n'));
  
  try {
    // Get current statistics
    const { data: asinStats } = await supabase
      .from('asin_performance_data')
      .select('asin, product_title', { count: 'exact', head: false })
      .not('product_title', 'is', null);
    
    const { data: mappingStats } = await supabase
      .from('asin_brand_mapping')
      .select('asin', { count: 'exact', head: true });
    
    console.log(chalk.gray('Current status:'));
    console.log(chalk.gray('- ASINs with product titles:'), asinStats?.length || 0);
    console.log(chalk.gray('- ASINs with brand mappings:'), mappingStats || 0);
    console.log();
    
    // Run the brand extraction function
    console.log(chalk.yellow('Running brand extraction for unmapped ASINs...'));
    
    const { data, error } = await supabase
      .rpc('run_brand_extraction_for_existing_asins');
    
    if (error) {
      throw error;
    }
    
    console.log(chalk.green('✓ Brand extraction completed'));
    
    // Get updated statistics
    const { data: newMappingStats } = await supabase
      .from('asin_brand_mapping')
      .select('asin', { count: 'exact', head: true });
    
    const { data: brandStats } = await supabase
      .from('brands')
      .select('id', { count: 'exact', head: true });
    
    console.log();
    console.log(chalk.blue('=== Results ==='));
    console.log(chalk.gray('- Total brand mappings:'), newMappingStats || 0);
    console.log(chalk.gray('- Unique brands:'), brandStats || 0);
    
    // Show sample of extracted brands
    const { data: sampleBrands } = await supabase
      .from('brands')
      .select('brand_name, normalized_name')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (sampleBrands && sampleBrands.length > 0) {
      console.log();
      console.log(chalk.blue('Recent brands extracted:'));
      sampleBrands.forEach(brand => {
        console.log(chalk.gray('-'), brand.brand_name, 
          chalk.gray(`(normalized: ${brand.normalized_name})`));
      });
    }
    
    // Check for unmapped ASINs
    const { data: unmappedASINs } = await supabase
      .from('asin_performance_data')
      .select('asin, product_title')
      .not('product_title', 'is', null)
      .limit(5);
    
    if (unmappedASINs) {
      const unmappedWithBrands = [];
      for (const asin of unmappedASINs) {
        const { data: mapping } = await supabase
          .from('asin_brand_mapping')
          .select('brand_id')
          .eq('asin', asin.asin)
          .single();
        
        if (!mapping) {
          unmappedWithBrands.push(asin);
        }
      }
      
      if (unmappedWithBrands.length > 0) {
        console.log();
        console.log(chalk.yellow('Sample of ASINs that could not be mapped:'));
        unmappedWithBrands.forEach(asin => {
          console.log(chalk.gray('-'), asin.asin, ':', asin.product_title);
        });
      }
    }
    
  } catch (error) {
    console.error(chalk.red('Error running brand extraction:'), error);
    process.exit(1);
  }
}

async function updateBrandHierarchyView() {
  console.log();
  console.log(chalk.blue('=== Refreshing Brand Hierarchy View ==='));
  
  try {
    // The brand_hierarchy view should auto-refresh, but we can query it to verify
    const { data: hierarchyData, error } = await supabase
      .from('brand_hierarchy')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error(chalk.red('Error querying brand hierarchy:'), error);
    } else {
      console.log(chalk.green('✓ Brand hierarchy view is accessible'));
      console.log(chalk.gray('Sample entries:'), hierarchyData?.length || 0);
    }
    
  } catch (error) {
    console.error(chalk.red('Error updating brand hierarchy:'), error);
  }
}

// Main execution
async function main() {
  try {
    await runBrandExtraction();
    await updateBrandHierarchyView();
    
    console.log();
    console.log(chalk.green('✓ All brand extraction tasks completed successfully'));
    
  } catch (error) {
    console.error(chalk.red('Script failed:'), error);
    process.exit(1);
  }
}

main();