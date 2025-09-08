#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { BigQuery } = require('@google-cloud/bigquery');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function runSimpleSync() {
  console.log('🚀 Running simple BigQuery to Supabase sync...\n');
  
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
    
    // Test connection and get data
    console.log('1. Fetching data from BigQuery...');
    
    // Use a simpler query without ORDER BY issues
    const query = `
      SELECT 
        Date,
        "Child ASIN" as child_asin,
        "Parent ASIN" as parent_asin,
        "Search Query" as search_query,
        "ASIN Impression Count" as impressions,
        "ASIN Click Count" as clicks,
        "ASIN Cart Add Count" as cart_adds,
        "ASIN Purchase Count" as purchases
      FROM \`${projectId}.${dataset}.seller-search_query_performance\`
      WHERE "Parent ASIN" IS NOT NULL
        AND Date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
      LIMIT 20
    `;
    
    const [rows] = await bigquery.query({ query });
    console.log(`   ✅ Retrieved ${rows.length} rows from BigQuery\n`);
    
    if (rows.length === 0) {
      console.log('No recent data found. Trying without date filter...');
      const allQuery = query.replace('AND Date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)', '');
      const [allRows] = await bigquery.query({ query: allQuery });
      rows.push(...allRows);
      console.log(`   Found ${rows.length} rows total\n`);
    }
    
    // Process parent records
    console.log('2. Creating parent records...');
    const parentMap = new Map();
    
    rows.forEach(row => {
      const date = row.Date?.value || row.Date;
      const dateStr = typeof date === 'string' ? date.split('T')[0] : date;
      const asin = row.parent_asin || row.child_asin;
      
      if (asin && dateStr) {
        const key = `${asin}_${dateStr}`;
        if (!parentMap.has(key)) {
          parentMap.set(key, { asin, date: dateStr });
        }
      }
    });
    
    console.log(`   Found ${parentMap.size} unique ASIN/date combinations\n`);
    
    // Insert parent records
    let parentsInserted = 0;
    for (const [key, record] of parentMap) {
      try {
        // Check if exists
        const { data: existing } = await supabase
          .from('asin_performance_data')
          .select('id')
          .eq('asin', record.asin)
          .eq('start_date', record.date)
          .eq('end_date', record.date)
          .maybeSingle();
        
        if (!existing) {
          const { data, error } = await supabase
            .from('asin_performance_data')
            .insert({
              asin: record.asin,
              start_date: record.date,
              end_date: record.date
            })
            .select()
            .single();
          
          if (!error && data) {
            parentsInserted++;
            parentMap.set(key, { ...record, id: data.id });
            console.log(`   ✅ Inserted: ${record.asin} on ${record.date}`);
          } else if (error && !error.message.includes('duplicate')) {
            console.error(`   ❌ Error: ${error.message}`);
          }
        } else {
          parentMap.set(key, { ...record, id: existing.id });
        }
      } catch (e) {
        console.error(`   Error processing ${key}: ${e.message}`);
      }
    }
    
    console.log(`\n   Total parent records inserted: ${parentsInserted}\n`);
    
    // Insert search query data
    console.log('3. Inserting search query data...');
    let searchInserted = 0;
    
    for (const row of rows) {
      try {
        const date = row.Date?.value || row.Date;
        const dateStr = typeof date === 'string' ? date.split('T')[0] : date;
        const asin = row.parent_asin || row.child_asin;
        const key = `${asin}_${dateStr}`;
        
        const parent = parentMap.get(key);
        if (!parent || !parent.id) continue;
        
        // Check if exists
        const { data: existing } = await supabase
          .from('search_query_performance')
          .select('id')
          .eq('asin_performance_id', parent.id)
          .eq('search_query', row.search_query || '')
          .maybeSingle();
        
        if (!existing) {
          const { error } = await supabase
            .from('search_query_performance')
            .insert({
              asin_performance_id: parent.id,
              search_query: row.search_query || '',
              search_query_score: 0,
              asin_impression_count: parseInt(row.impressions) || 0,
              asin_click_count: parseInt(row.clicks) || 0,
              asin_cart_add_count: parseInt(row.cart_adds) || 0,
              asin_purchase_count: parseInt(row.purchases) || 0
            });
          
          if (!error) {
            searchInserted++;
            if (searchInserted <= 5) {
              console.log(`   ✅ Inserted: "${row.search_query}" for ${asin}`);
            }
          } else if (!error.message.includes('duplicate')) {
            console.error(`   ❌ Error: ${error.message}`);
          }
        }
      } catch (e) {
        console.error(`   Error processing search query: ${e.message}`);
      }
    }
    
    console.log(`\n   Total search queries inserted: ${searchInserted}\n`);
    
    console.log('✅ Sync completed!');
    console.log(`   Parent records: ${parentsInserted}`);
    console.log(`   Search queries: ${searchInserted}`);
    console.log('\nTo sync more data, increase the LIMIT in the query.');
    
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
runSimpleSync().catch(console.error);