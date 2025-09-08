#!/usr/bin/env node

require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const { createClient } = require('@supabase/supabase-js');

async function fixAndSync() {
  console.log('🔧 Fixing credentials and starting sync...\n');
  
  try {
    // Get raw credentials from env
    let credentialsStr = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    
    if (!credentialsStr) {
      throw new Error('No GOOGLE_APPLICATION_CREDENTIALS_JSON found');
    }
    
    // Remove surrounding quotes if present
    if (credentialsStr.startsWith("'") && credentialsStr.endsWith("'")) {
      credentialsStr = credentialsStr.slice(1, -1);
    }
    if (credentialsStr.startsWith('"') && credentialsStr.endsWith('"')) {
      credentialsStr = credentialsStr.slice(1, -1);
    }
    
    // Try to parse - if it fails, it might be escaped
    let credentials;
    try {
      credentials = JSON.parse(credentialsStr);
    } catch (e) {
      // Try unescaping
      credentialsStr = credentialsStr.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      credentials = JSON.parse(credentialsStr);
    }
    
    // Fix private key newlines
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    
    console.log('✅ Credentials parsed successfully');
    console.log(`   Project: ${credentials.project_id}`);
    console.log(`   Email: ${credentials.client_email}\n`);
    
    // Initialize BigQuery
    const projectId = process.env.BIGQUERY_PROJECT_ID || credentials.project_id;
    const dataset = (process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85').replace(/\.$/, '');
    
    const bigquery = new BigQuery({
      projectId,
      credentials: {
        type: credentials.type,
        project_id: credentials.project_id,
        private_key_id: credentials.private_key_id,
        private_key: credentials.private_key,
        client_email: credentials.client_email,
        client_id: credentials.client_id
      }
    });
    
    console.log('1. Testing BigQuery connection...');
    const testQuery = `
      SELECT 
        COUNT(*) as total_rows,
        MIN(\`Date\`) as earliest_date,
        MAX(\`Date\`) as latest_date
      FROM \`${projectId}.${dataset}.seller-search_query_performance\`
    `;
    
    const [rows] = await bigquery.query({ query: testQuery });
    const stats = rows[0];
    console.log(`   ✅ Connected! Found ${stats.total_rows} rows`);
    console.log(`   Date range: ${stats.earliest_date} to ${stats.latest_date}\n`);
    
    // Initialize Supabase
    console.log('2. Testing Supabase connection...');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { count, error } = await supabase
      .from('asin_performance_data')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    console.log(`   ✅ Connected! Current records: ${count}\n`);
    
    // Now perform the sync
    console.log('3. Starting data sync...\n');
    
    // Get recent data to sync
    const recentQuery = `
      SELECT DISTINCT
        COALESCE(\`Parent ASIN\`, \`ASIN\`) as asin,
        DATE(\`Date\`) as date
      FROM \`${projectId}.${dataset}.seller-search_query_performance\`
      WHERE DATE(\`Date\`) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      LIMIT 1000
    `;
    
    console.log('   Fetching parent records to sync...');
    const [parentRows] = await bigquery.query({ query: recentQuery });
    console.log(`   Found ${parentRows.length} unique ASIN/date combinations\n`);
    
    if (parentRows.length === 0) {
      console.log('   No recent data found. Trying latest data...');
      const latestQuery = `
        SELECT DISTINCT
          COALESCE(\`Parent ASIN\`, \`ASIN\`) as asin,
          DATE(\`Date\`) as date
        FROM \`${projectId}.${dataset}.seller-search_query_performance\`
        ORDER BY \`Date\` DESC
        LIMIT 1000
      `;
      
      const [latestRows] = await bigquery.query({ query: latestQuery });
      parentRows.push(...latestRows);
      console.log(`   Found ${latestRows.length} records from latest data\n`);
    }
    
    // Transform to parent records format
    const parentRecords = parentRows.map(row => {
      const dateValue = row.date?.value || row.date;
      const dateStr = dateValue.split('T')[0];
      return {
        asin: row.asin,
        start_date: dateStr,
        end_date: dateStr
      };
    });
    
    // Insert parent records in batches
    console.log('4. Inserting parent records (asin_performance_data)...');
    const batchSize = 100;
    let totalInserted = 0;
    
    for (let i = 0; i < parentRecords.length; i += batchSize) {
      const batch = parentRecords.slice(i, i + batchSize);
      
      // Check existing
      const asins = batch.map(r => r.asin);
      const dates = batch.map(r => r.start_date);
      
      const { data: existing } = await supabase
        .from('asin_performance_data')
        .select('asin, start_date, end_date')
        .in('asin', asins)
        .in('start_date', dates);
      
      const existingKeys = new Set(
        (existing || []).map(e => `${e.asin}_${e.start_date}_${e.end_date}`)
      );
      
      const newRecords = batch.filter(r => 
        !existingKeys.has(`${r.asin}_${r.start_date}_${r.end_date}`)
      );
      
      if (newRecords.length > 0) {
        const { error: insertError } = await supabase
          .from('asin_performance_data')
          .insert(newRecords);
        
        if (insertError && !insertError.message.includes('duplicate')) {
          console.error('   Insert error:', insertError.message);
        } else {
          totalInserted += newRecords.length;
          console.log(`   Inserted ${newRecords.length} new records (batch ${Math.floor(i/batchSize) + 1})`);
        }
      }
    }
    
    console.log(`   ✅ Total parent records inserted: ${totalInserted}\n`);
    
    // Now sync search query data
    console.log('5. Syncing search query performance data...');
    
    // Get the parent IDs we just inserted
    const { data: parentData } = await supabase
      .from('asin_performance_data')
      .select('id, asin, start_date, end_date')
      .order('created_at', { ascending: false })
      .limit(1000);
    
    if (!parentData || parentData.length === 0) {
      console.log('   No parent records found to link to');
      return;
    }
    
    // Create lookup map
    const parentLookup = new Map();
    parentData.forEach(p => {
      parentLookup.set(`${p.asin}_${p.start_date}`, p.id);
    });
    
    console.log(`   Found ${parentData.length} parent records to link\n`);
    
    // Get search query data for these ASINs/dates
    const asinDatePairs = parentData.map(p => 
      `(\`Parent ASIN\` = '${p.asin}' AND DATE(\`Date\`) = '${p.start_date}')`
    ).slice(0, 10); // Limit to avoid query too long
    
    const searchQuery = `
      SELECT 
        \`Date\`,
        \`Parent ASIN\` as asin,
        \`Search Query\` as search_query,
        \`ASIN Impression Count\` as impressions,
        \`ASIN Click Count\` as clicks,
        \`ASIN Cart Add Count\` as cart_adds,
        \`ASIN Purchase Count\` as purchases,
        \`Search Query Score\` as score
      FROM \`${projectId}.${dataset}.seller-search_query_performance\`
      WHERE ${asinDatePairs.join(' OR ')}
      LIMIT 5000
    `;
    
    console.log('   Fetching search query data...');
    const [searchRows] = await bigquery.query({ query: searchQuery });
    console.log(`   Found ${searchRows.length} search query records\n`);
    
    // Transform and insert search query data
    let searchInserted = 0;
    const searchBatchSize = 100;
    
    for (let i = 0; i < searchRows.length; i += searchBatchSize) {
      const batch = searchRows.slice(i, i + searchBatchSize);
      
      const transformedBatch = batch.map(row => {
        const dateValue = row.Date?.value || row.Date;
        const dateStr = dateValue.split('T')[0];
        const parentId = parentLookup.get(`${row.asin}_${dateStr}`);
        
        if (!parentId) return null;
        
        return {
          asin_performance_id: parentId,
          search_query: row.search_query || '',
          search_query_score: parseInt(row.score) || 0,
          asin_impression_count: parseInt(row.impressions) || 0,
          asin_click_count: parseInt(row.clicks) || 0,
          asin_cart_add_count: parseInt(row.cart_adds) || 0,
          asin_purchase_count: parseInt(row.purchases) || 0
        };
      }).filter(r => r !== null);
      
      if (transformedBatch.length > 0) {
        const { error: insertError } = await supabase
          .from('search_query_performance')
          .insert(transformedBatch);
        
        if (insertError && !insertError.message.includes('duplicate')) {
          console.error('   Search insert error:', insertError.message);
        } else {
          searchInserted += transformedBatch.length;
          console.log(`   Inserted ${transformedBatch.length} search records (batch ${Math.floor(i/searchBatchSize) + 1})`);
        }
      }
    }
    
    console.log(`   ✅ Total search query records inserted: ${searchInserted}\n`);
    
    console.log('✅ Sync completed successfully!');
    console.log(`   Parent records: ${totalInserted}`);
    console.log(`   Search records: ${searchInserted}`);
    
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

fixAndSync().catch(console.error);