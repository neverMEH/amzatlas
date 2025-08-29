#!/usr/bin/env tsx

// Load environment variables
import { config } from 'dotenv';
config();

import { NestedBigQueryToSupabaseSync } from '../lib/supabase/sync/nested-bigquery-to-supabase';
import { getBigQueryConfig, getTableNames } from '../config/bigquery.config';
import { getSupabaseClient } from '../config/supabase.config';

async function testProductDataSync() {
  console.log('=== Testing Product Data Sync ===\n');
  
  try {
    // Initialize sync
    const bigqueryConfig = getBigQueryConfig();
    const tables = getTableNames();
    
    const sync = new NestedBigQueryToSupabaseSync({
      projectId: bigqueryConfig.projectId,
      dataset: bigqueryConfig.dataset,
      table: tables.sqpRaw,
      batchSize: 5, // Very small batch for testing
    });
    
    // Test with a single day and specific ASINs
    const testDate = new Date('2024-08-18');
    console.log('Running sync for:', testDate.toISOString().split('T')[0]);
    console.log('This will sync Product Name and Client Name fields...\n');
    
    const result = await sync.syncDateRange(testDate, testDate, {
      asins: ['B0BN72MLMK'], // Test with just one ASIN
      dryRun: false
    });
    
    console.log('Sync result:', {
      success: result.success,
      recordsProcessed: result.recordsProcessed,
      errors: result.errors.length,
      syncLogId: result.syncLogId
    });
    
    if (result.errors.length > 0) {
      console.log('\nErrors:', result.errors);
    }
    
    // Check if product title was synced
    if (result.success && result.recordsProcessed > 0) {
      console.log('\nChecking synced data in Supabase...');
      
      const supabase = getSupabaseClient();
      
      // Check ASIN performance data
      const { data: asinData, error: asinError } = await supabase
        .from('sqp.asin_performance_data')
        .select('asin, product_title, created_at, updated_at')
        .eq('asin', 'B0BN72MLMK')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (asinError) {
        console.error('Error fetching ASIN data:', asinError);
      } else if (asinData && asinData.length > 0) {
        console.log('\nASIN Performance Data:');
        console.log('- ASIN:', asinData[0].asin);
        console.log('- Product Title:', asinData[0].product_title || '(null)');
        console.log('- Created:', asinData[0].created_at);
        console.log('- Updated:', asinData[0].updated_at);
      }
      
      // Check brand mapping
      const { data: brandMapping, error: brandError } = await supabase
        .from('sqp.asin_brand_mapping')
        .select(`
          asin,
          product_title,
          confidence_score,
          extraction_method,
          brands (
            brand_name,
            display_name
          )
        `)
        .eq('asin', 'B0BN72MLMK')
        .single();
      
      if (brandError && brandError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error fetching brand mapping:', brandError);
      } else if (brandMapping) {
        console.log('\nBrand Mapping:');
        console.log('- ASIN:', brandMapping.asin);
        console.log('- Product Title:', brandMapping.product_title);
        console.log('- Brand:', brandMapping.brands?.brand_name || 'Unknown');
        console.log('- Confidence:', brandMapping.confidence_score);
        console.log('- Method:', brandMapping.extraction_method);
      } else {
        console.log('\nNo brand mapping found yet. The trigger should create it automatically.');
        
        // Try to trigger brand extraction manually
        console.log('\nRunning brand extraction function...');
        const { data: extractionResult, error: extractionError } = await supabase
          .rpc('update_brand_mappings');
        
        if (extractionError) {
          console.error('Error running brand extraction:', extractionError);
        } else {
          console.log('Brand extraction completed.');
          
          // Check again for brand mapping
          const { data: newBrandMapping } = await supabase
            .from('sqp.asin_brand_mapping')
            .select('asin, brands(brand_name)')
            .eq('asin', 'B0BN72MLMK')
            .single();
          
          if (newBrandMapping) {
            console.log('Brand extracted:', newBrandMapping.brands?.brand_name);
          }
        }
      }
    }
    
    console.log('\n✓ Test completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testProductDataSync().catch(console.error);