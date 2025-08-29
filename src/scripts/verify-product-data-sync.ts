#!/usr/bin/env tsx
/**
 * Verify that product titles are being correctly synced from BigQuery to Supabase
 */

import { BigQuery } from '@google-cloud/bigquery';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import { getBigQueryConfig, getTableNames } from '../config/bigquery.config';

// Initialize clients
const bigqueryConfig = getBigQueryConfig();
const tables = getTableNames();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get credentials from environment
const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
let credentials;
if (credentialsJson) {
  try {
    credentials = JSON.parse(credentialsJson);
  } catch (error) {
    console.error('Failed to parse Google credentials:', error);
    process.exit(1);
  }
}

const bigquery = new BigQuery({
  projectId: bigqueryConfig.projectId,
  credentials: credentials,
});

interface VerificationResult {
  totalASINs: number;
  asinsWithProductNames: number;
  asinsInSupabase: number;
  asinsWithProductTitles: number;
  missingProductTitles: string[];
  sampleData: Array<{
    asin: string;
    bigQueryProductName: string;
    supabaseProductTitle: string | null;
  }>;
}

async function verifyProductDataSync(): Promise<VerificationResult> {
  console.log(chalk.blue('\n=== Verifying Product Data Sync ===\n'));
  
  const result: VerificationResult = {
    totalASINs: 0,
    asinsWithProductNames: 0,
    asinsInSupabase: 0,
    asinsWithProductTitles: 0,
    missingProductTitles: [],
    sampleData: []
  };
  
  try {
    // Step 1: Check BigQuery for ASINs with Product Names
    console.log(chalk.gray('1. Querying BigQuery for product data...'));
    
    const bigQueryQuery = `
      SELECT DISTINCT 
        \`Child ASIN\` as asin,
        \`Product Name\` as productName,
        \`Client Name\` as clientName
      FROM \`${bigqueryConfig.projectId}.${bigqueryConfig.dataset}.${tables.sqpRaw}\`
      WHERE \`Product Name\` IS NOT NULL
      LIMIT 100
    `;
    
    const [bigQueryRows] = await bigquery.query(bigQueryQuery);
    result.totalASINs = bigQueryRows.length;
    result.asinsWithProductNames = bigQueryRows.filter(r => r.productName).length;
    
    console.log(chalk.gray('  - Total ASINs found:'), result.totalASINs);
    console.log(chalk.gray('  - ASINs with product names:'), result.asinsWithProductNames);
    
    // Step 2: Check Supabase for these ASINs
    console.log(chalk.gray('\n2. Checking Supabase for synced data...'));
    
    const asinList = bigQueryRows.map(r => r.asin);
    const { data: supabaseData, error } = await supabase
      .from('asin_performance_data')
      .select('asin, product_title')
      .in('asin', asinList);
    
    if (error) {
      throw error;
    }
    
    result.asinsInSupabase = supabaseData?.length || 0;
    result.asinsWithProductTitles = supabaseData?.filter(d => d.product_title).length || 0;
    
    console.log(chalk.gray('  - ASINs found in Supabase:'), result.asinsInSupabase);
    console.log(chalk.gray('  - ASINs with product titles:'), result.asinsWithProductTitles);
    
    // Step 3: Compare data
    console.log(chalk.gray('\n3. Comparing BigQuery and Supabase data...'));
    
    const supabaseMap = new Map(
      supabaseData?.map(d => [d.asin, d.product_title]) || []
    );
    
    // Find missing product titles
    for (const row of bigQueryRows) {
      const supabaseTitle = supabaseMap.get(row.asin);
      
      if (row.productName && !supabaseTitle) {
        result.missingProductTitles.push(row.asin);
      }
      
      // Add sample data
      if (result.sampleData.length < 10) {
        result.sampleData.push({
          asin: row.asin,
          bigQueryProductName: row.productName,
          supabaseProductTitle: supabaseTitle || null
        });
      }
    }
    
    console.log(chalk.gray('  - ASINs with missing product titles:'), result.missingProductTitles.length);
    
    // Step 4: Display results
    console.log(chalk.blue('\n=== Verification Results ===\n'));
    
    const syncRate = result.asinsWithProductNames > 0 
      ? (result.asinsWithProductTitles / result.asinsWithProductNames * 100).toFixed(1)
      : '0';
    
    console.log(chalk.gray('Sync Success Rate:'), 
      syncRate === '100.0' ? chalk.green(`${syncRate}%`) : chalk.yellow(`${syncRate}%`)
    );
    
    if (result.sampleData.length > 0) {
      console.log(chalk.blue('\nSample Data Comparison:'));
      console.log(chalk.gray('(First 10 records)'));
      
      result.sampleData.forEach((sample, index) => {
        const match = sample.bigQueryProductName === sample.supabaseProductTitle;
        const icon = match ? chalk.green('✓') : chalk.red('✗');
        
        console.log(`\n${index + 1}. ${icon} ASIN: ${sample.asin}`);
        console.log(chalk.gray('   BigQuery:'), sample.bigQueryProductName || '(null)');
        console.log(chalk.gray('   Supabase:'), sample.supabaseProductTitle || '(null)');
      });
    }
    
    if (result.missingProductTitles.length > 0) {
      console.log(chalk.yellow('\nASINs missing product titles in Supabase:'));
      result.missingProductTitles.slice(0, 10).forEach(asin => {
        console.log(chalk.gray('-'), asin);
      });
      if (result.missingProductTitles.length > 10) {
        console.log(chalk.gray(`... and ${result.missingProductTitles.length - 10} more`));
      }
    }
    
    // Step 5: Check brand mappings
    console.log(chalk.blue('\n=== Brand Mapping Status ===\n'));
    
    const { data: brandMappings } = await supabase
      .from('asin_brand_mapping')
      .select('asin, brand_id')
      .in('asin', asinList.slice(0, 20));
    
    const mappedCount = brandMappings?.length || 0;
    console.log(chalk.gray('Brand mappings found:'), `${mappedCount}/${Math.min(20, asinList.length)}`);
    
    if (brandMappings && brandMappings.length > 0) {
      // Get some brand names
      const brandIds = [...new Set(brandMappings.map(m => m.brand_id))];
      const { data: brands } = await supabase
        .from('brands')
        .select('id, brand_name')
        .in('id', brandIds.slice(0, 5));
      
      if (brands && brands.length > 0) {
        console.log(chalk.gray('\nSample brands extracted:'));
        brands.forEach(brand => {
          console.log(chalk.gray('-'), brand.brand_name);
        });
      }
    }
    
  } catch (error) {
    console.error(chalk.red('Verification failed:'), error);
    throw error;
  }
  
  return result;
}

// Run test sync for a small batch
async function testSmallSync() {
  console.log(chalk.blue('\n=== Running Test Sync ===\n'));
  
  try {
    const { NestedBigQueryToSupabaseSync } = await import('../lib/supabase/sync/nested-bigquery-to-supabase');
    
    const sync = new NestedBigQueryToSupabaseSync({
      projectId: bigqueryConfig.projectId,
      dataset: bigqueryConfig.dataset,
      table: tables.sqpRaw,
      batchSize: 10, // Small batch for testing
    });
    
    // Sync just one day of data
    const testDate = new Date('2024-08-18');
    const result = await sync.syncDateRange(testDate, testDate, {
      dryRun: false,
      asins: ['B0BN72MLMK', 'B09WZ8J7Y7', 'B0B2CD4DK6'].filter(Boolean).slice(0, 3) // Test with specific ASINs
    });
    
    console.log(chalk.gray('Test sync result:'), {
      success: result.success,
      recordsProcessed: result.recordsProcessed,
      errors: result.errors.length
    });
    
    if (result.errors.length > 0) {
      console.log(chalk.red('Errors:'), result.errors);
    }
    
  } catch (error) {
    console.error(chalk.red('Test sync failed:'), error);
  }
}

// Main execution
async function main() {
  try {
    // First verify current state
    const verificationResult = await verifyProductDataSync();
    
    // If sync rate is low, run a test sync
    if (verificationResult.asinsWithProductTitles < verificationResult.asinsWithProductNames * 0.9) {
      console.log(chalk.yellow('\n⚠️  Product title sync rate is below 90%. Running test sync...'));
      await testSmallSync();
      
      // Re-verify after test sync
      console.log(chalk.blue('\n=== Re-verifying After Test Sync ==='));
      await verifyProductDataSync();
    } else {
      console.log(chalk.green('\n✓ Product title sync is working correctly!'));
    }
    
    // Check if brand extraction is needed
    if (verificationResult.asinsWithProductTitles > 0) {
      console.log(chalk.blue('\n=== Checking Brand Extraction ==='));
      
      const { data: unmappedCount } = await supabase
        .rpc('count', { 
          table_name: 'asin_performance_data',
          filter: 'product_title.not.is.null'
        })
        .single();
      
      console.log(chalk.gray('Ready for brand extraction'));
    }
    
  } catch (error) {
    console.error(chalk.red('Verification script failed:'), error);
    process.exit(1);
  }
}

main();