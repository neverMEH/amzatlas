#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { BigQuery } = require('@google-cloud/bigquery');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function runFullSync() {
  console.log('🚀 Running full BigQuery to Supabase sync...\n');
  
  let credentialsPath = null;
  
  try {
    // Setup credentials
    const credsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credsEnv) throw new Error('No credentials in environment');
    
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcp-'));
    credentialsPath = path.join(tempDir, 'creds.json');
    
    let creds = credsEnv;
    if (creds.startsWith("'")) creds = creds.slice(1, -1);
    
    let credentials;
    try {
      credentials = JSON.parse(creds);
    } catch (e) {
      creds = creds.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      credentials = JSON.parse(creds);
    }
    
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    
    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
    
    // Initialize clients
    const projectId = process.env.BIGQUERY_PROJECT_ID || credentials.project_id;
    const dataset = process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85';
    
    const bigquery = new BigQuery({
      projectId: projectId,
      keyFilename: credentialsPath
    });
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    console.log('Configuration:');
    console.log(`  Project: ${projectId}`);
    console.log(`  Dataset: ${dataset}\n`);
    
    // Get data stats first
    console.log('1. Analyzing BigQuery data...');
    const statsQuery = `
      SELECT 
        COUNT(*) as total_rows,
        COUNT(DISTINCT "Parent ASIN") as unique_parent_asins,
        COUNT(DISTINCT "Child ASIN") as unique_child_asins,
        COUNT(DISTINCT "Search Query") as unique_queries,
        MIN(Date) as earliest_date,
        MAX(Date) as latest_date
      FROM \`${projectId}.${dataset}.seller-search_query_performance\`
      WHERE "Parent ASIN" IS NOT NULL
    `;
    
    const [stats] = await bigquery.query({ query: statsQuery });
    const dataStats = stats[0];
    
    console.log('   Data summary:');
    console.log(`   - Total rows: ${dataStats.total_rows}`);
    console.log(`   - Parent ASINs: ${dataStats.unique_parent_asins}`);
    console.log(`   - Child ASINs: ${dataStats.unique_child_asins}`);
    console.log(`   - Search queries: ${dataStats.unique_queries}`);
    console.log(`   - Date range: ${dataStats.earliest_date.value} to ${dataStats.latest_date.value}\n`);
    
    // Get a larger batch of data
    console.log('2. Fetching data from BigQuery...');
    const batchSize = 500; // Increase this for more data
    
    const dataQuery = `
      SELECT *
      FROM \`${projectId}.${dataset}.seller-search_query_performance\`
      WHERE "Parent ASIN" IS NOT NULL
      ORDER BY Date DESC
      LIMIT ${batchSize}
    `;
    
    const [rows] = await bigquery.query({ query: dataQuery });
    console.log(`   ✅ Retrieved ${rows.length} rows\n`);
    
    // Show sample data
    if (rows.length > 0) {
      console.log('   Sample data:');
      const sample = rows[0];
      console.log(`   - Date: ${sample.Date}`);
      console.log(`   - Parent ASIN: ${sample['Parent ASIN']}`);
      console.log(`   - Child ASIN: ${sample['Child ASIN']}`);
      console.log(`   - Search Query: ${sample['Search Query']}`);
      console.log(`   - Impressions: ${sample['ASIN Impression Count']}`);
      console.log(`   - Clicks: ${sample['ASIN Click Count']}`);
      console.log(`   - Purchases: ${sample['ASIN Purchase Count']}\n`);
    }
    
    // Process parent records
    console.log('3. Processing parent records...');
    const parentMap = new Map();
    const parentRecords = [];
    
    rows.forEach(row => {
      const date = row.Date;
      const dateStr = date.value ? date.value.split('T')[0] : date.split('T')[0];
      const asin = row['Parent ASIN'] || row['Child ASIN'];
      
      if (asin && dateStr) {
        const key = `${asin}_${dateStr}`;
        if (!parentMap.has(key)) {
          parentMap.set(key, true);
          parentRecords.push({
            asin: asin,
            start_date: dateStr,
            end_date: dateStr
          });
        }
      }
    });
    
    console.log(`   Found ${parentRecords.length} unique ASIN/date combinations\n`);
    
    // Batch insert parent records
    console.log('4. Inserting parent records in batches...');
    const parentBatchSize = 50;
    let totalParentsInserted = 0;
    
    for (let i = 0; i < parentRecords.length; i += parentBatchSize) {
      const batch = parentRecords.slice(i, i + parentBatchSize);
      
      // Check which already exist
      const asins = batch.map(r => r.asin);
      const dates = batch.map(r => r.start_date);
      
      const { data: existing, error: checkError } = await supabase
        .from('asin_performance_data')
        .select('asin, start_date, end_date')
        .in('asin', asins)
        .in('start_date', dates);
      
      if (checkError) {
        console.error(`   Error checking existing: ${checkError.message}`);
        continue;
      }
      
      // Filter out existing records
      const existingKeys = new Set(
        (existing || []).map(e => `${e.asin}_${e.start_date}_${e.end_date}`)
      );
      
      const newRecords = batch.filter(r => 
        !existingKeys.has(`${r.asin}_${r.start_date}_${r.end_date}`)
      );
      
      if (newRecords.length > 0) {
        const { data, error } = await supabase
          .from('asin_performance_data')
          .insert(newRecords)
          .select();
        
        if (error) {
          console.error(`   Error inserting batch: ${error.message}`);
        } else {
          totalParentsInserted += newRecords.length;
          console.log(`   Batch ${Math.floor(i/parentBatchSize) + 1}: Inserted ${newRecords.length} records`);
        }
      } else {
        console.log(`   Batch ${Math.floor(i/parentBatchSize) + 1}: All ${batch.length} records already exist`);
      }
    }
    
    console.log(`\n   Total parent records inserted: ${totalParentsInserted}\n`);
    
    // Get parent IDs for search query insertion
    console.log('5. Fetching parent record IDs...');
    const { data: parentData } = await supabase
      .from('asin_performance_data')
      .select('id, asin, start_date, end_date')
      .order('created_at', { ascending: false })
      .limit(1000);
    
    const parentLookup = new Map();
    parentData?.forEach(p => {
      parentLookup.set(`${p.asin}_${p.start_date}`, p.id);
    });
    
    console.log(`   Loaded ${parentLookup.size} parent record IDs\n`);
    
    // Process search query data
    console.log('6. Processing search query data...');
    const searchRecords = [];
    
    rows.forEach(row => {
      const date = row.Date;
      const dateStr = date.value ? date.value.split('T')[0] : date.split('T')[0];
      const asin = row['Parent ASIN'] || row['Child ASIN'];
      const parentId = parentLookup.get(`${asin}_${dateStr}`);
      
      if (parentId) {
        searchRecords.push({
          asin_performance_id: parentId,
          search_query: row['Search Query'] || '',
          search_query_score: parseInt(row['Search Query Score']) || 0,
          search_query_volume: parseInt(row['Search Query Volume']) || 0,
          asin_impression_count: parseInt(row['ASIN Impression Count']) || 0,
          asin_click_count: parseInt(row['ASIN Click Count']) || 0,
          asin_cart_add_count: parseInt(row['ASIN Cart Add Count']) || 0,
          asin_purchase_count: parseInt(row['ASIN Purchase Count']) || 0,
          asin_impression_share: parseFloat(row['ASIN Impression Share']) || 0,
          asin_click_share: parseFloat(row['ASIN Click Share']) || 0,
          asin_cart_add_share: parseFloat(row['ASIN Cart Add Share']) || 0,
          asin_purchase_share: parseFloat(row['ASIN Purchase Share']) || 0,
          // Add more fields as needed
          total_query_impression_count: parseInt(row['Total Query Impression Count']) || 0,
          total_click_count: parseInt(row['Total Click Count']) || 0,
          total_cart_add_count: parseInt(row['Total Cart Add Count']) || 0,
          total_purchase_count: parseInt(row['Total Purchase Count']) || 0
        });
      }
    });
    
    console.log(`   Prepared ${searchRecords.length} search query records\n`);
    
    // Batch insert search queries
    console.log('7. Inserting search query data in batches...');
    const searchBatchSize = 100;
    let totalSearchInserted = 0;
    
    for (let i = 0; i < searchRecords.length; i += searchBatchSize) {
      const batch = searchRecords.slice(i, i + searchBatchSize);
      
      // Check for existing records
      const perfIds = [...new Set(batch.map(r => r.asin_performance_id))];
      const queries = [...new Set(batch.map(r => r.search_query))];
      
      // For simplicity, we'll just try to insert and handle duplicates
      const { data, error } = await supabase
        .from('search_query_performance')
        .insert(batch)
        .select();
      
      if (error) {
        if (error.message.includes('duplicate')) {
          console.log(`   Batch ${Math.floor(i/searchBatchSize) + 1}: Some duplicates skipped`);
        } else {
          console.error(`   Batch ${Math.floor(i/searchBatchSize) + 1}: Error - ${error.message}`);
        }
      } else {
        totalSearchInserted += data.length;
        console.log(`   Batch ${Math.floor(i/searchBatchSize) + 1}: Inserted ${data.length} records`);
      }
    }
    
    console.log(`\n   Total search queries inserted: ${totalSearchInserted}\n`);
    
    // Final summary
    console.log('✅ Sync completed successfully!\n');
    console.log('Summary:');
    console.log(`  - Rows processed: ${rows.length}`);
    console.log(`  - Parent records inserted: ${totalParentsInserted}`);
    console.log(`  - Search queries inserted: ${totalSearchInserted}`);
    console.log(`\nTo sync more data, increase the batchSize variable (currently ${batchSize})`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Clean up
    if (credentialsPath && fs.existsSync(credentialsPath)) {
      fs.unlinkSync(credentialsPath);
      fs.rmdirSync(path.dirname(credentialsPath));
    }
  }
}

// Run the sync
runFullSync().catch(console.error);