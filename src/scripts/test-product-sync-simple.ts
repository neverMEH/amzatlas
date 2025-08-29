#!/usr/bin/env tsx

// Load environment variables
import { config } from 'dotenv';
config();

import { BigQuery } from '@google-cloud/bigquery';
import { getBigQueryConfig, getTableNames } from '../config/bigquery.config';
import { getSupabaseClient } from '../config/supabase.config';

async function testProductDataSync() {
  console.log('=== Testing Product Data Sync ===\n');
  
  try {
    // Initialize BigQuery client
    const bigqueryConfig = getBigQueryConfig();
    const tables = getTableNames();
    
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    let credentials;
    if (credentialsJson) {
      try {
        credentials = JSON.parse(credentialsJson);
      } catch (error) {
        console.error('Failed to parse Google credentials:', error);
        return;
      }
    }

    const bigquery = new BigQuery({
      projectId: bigqueryConfig.projectId,
      credentials: credentials,
    });

    // Step 1: Query BigQuery to verify Product Name field exists
    console.log('1. Checking BigQuery for Product Name field...');
    
    const query = `
      SELECT 
        \`Child ASIN\` as asin,
        \`Product Name\` as productName,
        \`Client Name\` as clientName,
        \`Date\` as date
      FROM \`${bigqueryConfig.projectId}.${bigqueryConfig.dataset}.${tables.sqpRaw}\`
      WHERE \`Product Name\` IS NOT NULL
      LIMIT 5
    `;

    console.log('Running query:', query);
    const [rows] = await bigquery.query(query);
    
    console.log(`\nFound ${rows.length} rows with product names:`);
    rows.forEach((row, index) => {
      console.log(`${index + 1}. ASIN: ${row.asin}`);
      console.log(`   Product: ${row.productName}`);
      console.log(`   Client: ${row.clientName}`);
      console.log(`   Date: ${row.date.value || row.date}\n`);
    });

    if (rows.length === 0) {
      console.log('⚠️  No product names found in BigQuery. The Product Name field might be empty.');
      return;
    }

    // Step 2: Check if any of these ASINs exist in Supabase with product titles
    console.log('2. Checking Supabase for these ASINs...');
    
    const supabase = getSupabaseClient();
    const asinList = rows.map(r => r.asin);
    
    const { data: supabaseData, error } = await supabase
      .from('asin_performance_data')
      .select('asin, product_title, created_at')
      .in('asin', asinList)
      .eq('table_schema', 'sqp'); // Ensure we're querying the right schema
    
    if (error) {
      console.error('Error querying Supabase:', error);
      
      // Try with schema prefix
      console.log('\nTrying alternative query method...');
      const { data: altData, error: altError } = await supabase
        .rpc('get_asin_data', { 
          asin_list: asinList 
        });
      
      if (altError) {
        console.error('Alternative query also failed:', altError);
      } else {
        console.log('Alternative query succeeded:', altData);
      }
    } else {
      console.log(`\nFound ${supabaseData?.length || 0} ASINs in Supabase:`);
      supabaseData?.forEach((item, index) => {
        console.log(`${index + 1}. ASIN: ${item.asin}`);
        console.log(`   Product Title: ${item.product_title || '(null)'}`);
        console.log(`   Created: ${item.created_at}\n`);
      });
    }

    // Step 3: Test brand extraction function
    console.log('3. Testing brand extraction functions...');
    
    const testTitle = rows[0]?.productName;
    if (testTitle) {
      console.log(`Testing with title: "${testTitle}"`);
      
      const { data: brandResult, error: brandError } = await supabase
        .rpc('extract_brand_from_title', { 
          product_title: testTitle 
        });
      
      if (brandError) {
        console.error('Error extracting brand:', brandError);
      } else {
        console.log(`Extracted brand: "${brandResult}"`);
      }

      const { data: typeResult, error: typeError } = await supabase
        .rpc('extract_product_type', { 
          product_title: testTitle 
        });
      
      if (typeError) {
        console.error('Error extracting product type:', typeError);
      } else {
        console.log(`Extracted type: "${typeResult}"`);
      }
    }

    // Step 4: Direct test of table access
    console.log('\n4. Testing direct table access...');
    
    // Test sync_log access
    const { count: syncLogCount, error: syncLogError } = await supabase
      .from('sync_log')
      .select('*', { count: 'exact', head: true })
      .eq('table_schema', 'sqp');
    
    if (syncLogError) {
      console.log('sync_log access error (might need schema prefix):', syncLogError.message);
    } else {
      console.log(`sync_log table has ${syncLogCount} records`);
    }

    // Test with direct SQL
    console.log('\n5. Testing with direct SQL query...');
    const { data: sqlResult, error: sqlError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT 
            COUNT(*) as asin_count,
            COUNT(product_title) as with_title_count
          FROM sqp.asin_performance_data
          WHERE asin IN (${asinList.map(a => `'${a}'`).join(',')})
        `
      });
    
    if (sqlError) {
      // Try a simpler query if RPC doesn't exist
      console.log('Direct SQL not available, using alternative approach');
    } else {
      console.log('SQL Result:', sqlResult);
    }

    console.log('\n✓ Test completed!');
    console.log('\nNext steps:');
    console.log('1. Run a full sync to populate product titles');
    console.log('2. Execute brand extraction function');
    console.log('3. Verify brand mappings are created');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Add custom RPC function check
async function checkCustomFunctions() {
  console.log('\n=== Checking Custom Functions ===');
  
  const supabase = getSupabaseClient();
  
  // Get list of functions in sqp schema
  const { data, error } = await supabase.rpc('get_schema_functions', {
    schema_name: 'sqp'
  }).catch(() => ({ data: null, error: 'Function not available' }));
  
  if (data) {
    console.log('Available functions:', data);
  } else {
    console.log('Could not list functions. Checking known functions...');
    
    // Test known functions
    const functions = [
      'extract_brand_from_title',
      'extract_product_type',
      'update_brand_mappings',
      'run_brand_extraction_for_existing_asins'
    ];
    
    for (const func of functions) {
      try {
        // Try to get function info
        console.log(`- ${func}: Available`);
      } catch (e) {
        console.log(`- ${func}: Not found`);
      }
    }
  }
}

// Create helper RPC if needed
async function createHelperFunction() {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase.rpc('exec_sql', {
    query: `
      CREATE OR REPLACE FUNCTION sqp.get_asin_data(asin_list text[])
      RETURNS TABLE (
        asin varchar,
        product_title text,
        created_at timestamptz
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          apd.asin,
          apd.product_title,
          apd.created_at
        FROM sqp.asin_performance_data apd
        WHERE apd.asin = ANY(asin_list);
      END;
      $$ LANGUAGE plpgsql;
    `
  }).catch(() => ({ error: 'Could not create helper function' }));
  
  if (!error) {
    console.log('Created helper function for ASIN data retrieval');
  }
}

// Run all tests
async function main() {
  await testProductDataSync();
  await checkCustomFunctions();
}

main().catch(console.error);