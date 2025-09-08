#!/usr/bin/env node

const { BigQuery } = require('@google-cloud/bigquery');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Manual credentials - you'll need to paste the actual JSON here
const MANUAL_CREDS = {
  "type": "service_account",
  "project_id": "amazon-sp-report-loader",
  "private_key_id": "YOUR_PRIVATE_KEY_ID",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n",
  "client_email": "YOUR_CLIENT_EMAIL",
  "client_id": "YOUR_CLIENT_ID",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "YOUR_CERT_URL"
};

async function syncWithManualCreds() {
  console.log('🚀 Running sync with manual credentials...\n');
  
  try {
    // Try to get credentials from env first
    let credentials = MANUAL_CREDS;
    
    // Check if we have env credentials
    const envCredsRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (envCredsRaw && envCredsRaw.length > 10) {
      console.log('Attempting to use environment credentials...');
      
      // Try various parsing strategies
      let parsed = false;
      let envCreds = envCredsRaw;
      
      // Remove outer quotes
      if (envCreds.startsWith("'") && envCreds.endsWith("'")) {
        envCreds = envCreds.slice(1, -1);
      }
      if (envCreds.startsWith('"') && envCreds.endsWith('"')) {
        envCreds = envCreds.slice(1, -1);
      }
      
      // Try to parse
      try {
        credentials = JSON.parse(envCreds);
        parsed = true;
        console.log('✅ Using credentials from environment');
      } catch (e) {
        // Try unescaping
        try {
          envCreds = envCreds.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          credentials = JSON.parse(envCreds);
          parsed = true;
          console.log('✅ Using unescaped credentials from environment');
        } catch (e2) {
          console.log('❌ Could not parse env credentials, using manual fallback');
          console.log('Error:', e2.message);
        }
      }
    } else {
      console.log('No valid environment credentials found, using manual credentials');
      console.log('⚠️  Please update MANUAL_CREDS in this file with your actual credentials');
      return;
    }
    
    // Fix private key newlines
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    
    // Initialize BigQuery
    const projectId = process.env.BIGQUERY_PROJECT_ID || credentials.project_id;
    const dataset = (process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85').replace(/\.$/, '');
    
    console.log('\nConfiguration:');
    console.log(`  Project: ${projectId}`);
    console.log(`  Dataset: ${dataset}`);
    console.log(`  Email: ${credentials.client_email}\n`);
    
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
    
    // Initialize Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Test BigQuery connection
    console.log('1. Testing BigQuery connection...');
    const testQuery = `
      SELECT 
        COUNT(*) as total_rows,
        COUNT(DISTINCT \`ASIN\`) as unique_asins,
        COUNT(DISTINCT \`Search Query\`) as unique_queries,
        MIN(\`Date\`) as earliest_date,
        MAX(\`Date\`) as latest_date
      FROM \`${projectId}.${dataset}.seller-search_query_performance\`
    `;
    
    const [stats] = await bigquery.query({ query: testQuery });
    const dataStats = stats[0];
    console.log('   ✅ Connected successfully!');
    console.log(`   Total rows: ${dataStats.total_rows}`);
    console.log(`   Unique ASINs: ${dataStats.unique_asins}`);
    console.log(`   Unique queries: ${dataStats.unique_queries}`);
    console.log(`   Date range: ${dataStats.earliest_date} to ${dataStats.latest_date}\n`);
    
    // Test Supabase connection
    console.log('2. Testing Supabase connection...');
    const { count: asinCount } = await supabase
      .from('asin_performance_data')
      .select('*', { count: 'exact', head: true });
    
    const { count: searchCount } = await supabase
      .from('search_query_performance')
      .select('*', { count: 'exact', head: true });
    
    console.log('   ✅ Connected successfully!');
    console.log(`   ASIN records: ${asinCount}`);
    console.log(`   Search query records: ${searchCount}\n`);
    
    // Get sample data
    console.log('3. Fetching sample data to sync...');
    const sampleQuery = `
      SELECT 
        \`Date\`,
        \`ASIN\`,
        \`Parent ASIN\`,
        \`Child ASIN\`,
        \`Search Query\`,
        \`ASIN Impression Count\`,
        \`ASIN Click Count\`,
        \`ASIN Cart Add Count\`,
        \`ASIN Purchase Count\`
      FROM \`${projectId}.${dataset}.seller-search_query_performance\`
      ORDER BY \`Date\` DESC
      LIMIT 50
    `;
    
    const [sampleRows] = await bigquery.query({ query: sampleQuery });
    console.log(`   Found ${sampleRows.length} sample rows\n`);
    
    // Extract unique ASIN/date combinations
    const asinDateMap = new Map();
    sampleRows.forEach(row => {
      const dateValue = row.Date?.value || row.Date;
      const dateStr = dateValue.split('T')[0];
      const asin = row['Parent ASIN'] || row.ASIN || row['Child ASIN'];
      
      if (asin && dateStr) {
        const key = `${asin}_${dateStr}`;
        if (!asinDateMap.has(key)) {
          asinDateMap.set(key, { asin, date: dateStr });
        }
      }
    });
    
    console.log(`4. Syncing ${asinDateMap.size} ASIN/date combinations...\n`);
    
    // Insert parent records
    let parentInserted = 0;
    const parentRecords = Array.from(asinDateMap.values());
    
    for (const record of parentRecords) {
      const { data: existing } = await supabase
        .from('asin_performance_data')
        .select('id')
        .eq('asin', record.asin)
        .eq('start_date', record.date)
        .eq('end_date', record.date)
        .single();
      
      if (!existing) {
        const { error } = await supabase
          .from('asin_performance_data')
          .insert({
            asin: record.asin,
            start_date: record.date,
            end_date: record.date
          });
        
        if (!error) {
          parentInserted++;
        } else if (!error.message.includes('duplicate')) {
          console.error(`Error inserting parent: ${error.message}`);
        }
      }
    }
    
    console.log(`   ✅ Inserted ${parentInserted} parent records\n`);
    
    // Get parent IDs for search query sync
    console.log('5. Syncing search query data...');
    
    const { data: parentData } = await supabase
      .from('asin_performance_data')
      .select('id, asin, start_date')
      .in('asin', parentRecords.map(r => r.asin))
      .in('start_date', parentRecords.map(r => r.date));
    
    const parentLookup = new Map();
    parentData?.forEach(p => {
      parentLookup.set(`${p.asin}_${p.start_date}`, p.id);
    });
    
    // Insert search query data
    let searchInserted = 0;
    
    for (const row of sampleRows) {
      const dateValue = row.Date?.value || row.Date;
      const dateStr = dateValue.split('T')[0];
      const asin = row['Parent ASIN'] || row.ASIN || row['Child ASIN'];
      const parentId = parentLookup.get(`${asin}_${dateStr}`);
      
      if (parentId) {
        const searchRecord = {
          asin_performance_id: parentId,
          search_query: row['Search Query'] || '',
          search_query_score: 0, // Not in this dataset
          asin_impression_count: parseInt(row['ASIN Impression Count']) || 0,
          asin_click_count: parseInt(row['ASIN Click Count']) || 0,
          asin_cart_add_count: parseInt(row['ASIN Cart Add Count']) || 0,
          asin_purchase_count: parseInt(row['ASIN Purchase Count']) || 0
        };
        
        const { data: existing } = await supabase
          .from('search_query_performance')
          .select('id')
          .eq('asin_performance_id', searchRecord.asin_performance_id)
          .eq('search_query', searchRecord.search_query)
          .single();
        
        if (!existing) {
          const { error } = await supabase
            .from('search_query_performance')
            .insert(searchRecord);
          
          if (!error) {
            searchInserted++;
          } else if (!error.message.includes('duplicate')) {
            console.error(`Error inserting search query: ${error.message}`);
          }
        }
      }
    }
    
    console.log(`   ✅ Inserted ${searchInserted} search query records\n`);
    
    console.log('✅ Sync completed successfully!');
    console.log(`   Parent records: ${parentInserted}`);
    console.log(`   Search queries: ${searchInserted}`);
    console.log('\nTo sync more data, modify the LIMIT in the queries above.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 403) {
      console.error('\nAccess denied. Please check:');
      console.error('1. The service account has BigQuery Data Viewer role');
      console.error('2. The dataset name is correct');
      console.error('3. The project ID is correct');
    }
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

// Check if we have Supabase credentials
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
  process.exit(1);
}

syncWithManualCreds().catch(console.error);