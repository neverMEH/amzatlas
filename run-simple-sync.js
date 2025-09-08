#!/usr/bin/env node

require('dotenv').config();
const { BigQuery } = require('@google-cloud/bigquery');
const { createClient } = require('@supabase/supabase-js');

async function runSimpleSync() {
  console.log('🚀 Running simplified BigQuery to Supabase sync...\n');
  
  try {
    // Parse credentials
    let credentialsStr = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (credentialsStr.startsWith("'") && credentialsStr.endsWith("'")) {
      credentialsStr = credentialsStr.slice(1, -1);
    }
    
    let credentials;
    try {
      credentials = JSON.parse(credentialsStr);
    } catch (e) {
      credentialsStr = credentialsStr.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      credentials = JSON.parse(credentialsStr);
    }
    
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    
    // Initialize clients
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
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Test connections
    console.log('1. Testing connections...');
    
    const countQuery = `SELECT COUNT(*) as count FROM \`${projectId}.${dataset}.seller-search_query_performance\``;
    const [countResult] = await bigquery.query({ query: countQuery });
    console.log(`   ✅ BigQuery: ${countResult[0].count} total rows`);
    
    const { count: supabaseCount } = await supabase
      .from('asin_performance_data')
      .select('*', { count: 'exact', head: true });
    console.log(`   ✅ Supabase: ${supabaseCount} existing records\n`);
    
    // Get a sample of data to sync
    console.log('2. Fetching sample data to sync...');
    
    const sampleQuery = `
      SELECT DISTINCT
        COALESCE(\`Parent ASIN\`, \`ASIN\`) as asin,
        DATE(\`Date\`) as date
      FROM \`${projectId}.${dataset}.seller-search_query_performance\`
      ORDER BY \`Date\` DESC
      LIMIT 100
    `;
    
    const [sampleRows] = await bigquery.query({ query: sampleQuery });
    console.log(`   Found ${sampleRows.length} ASIN/date combinations\n`);
    
    // Transform data
    const parentRecords = sampleRows.map(row => {
      const dateValue = row.date?.value || row.date;
      const dateStr = typeof dateValue === 'string' ? dateValue.split('T')[0] : dateValue;
      return {
        asin: row.asin,
        start_date: dateStr,
        end_date: dateStr
      };
    });
    
    // Insert parent records
    console.log('3. Inserting parent records...');
    let inserted = 0;
    
    for (const record of parentRecords) {
      // Check if exists
      const { data: existing } = await supabase
        .from('asin_performance_data')
        .select('id')
        .eq('asin', record.asin)
        .eq('start_date', record.start_date)
        .eq('end_date', record.end_date)
        .single();
      
      if (!existing) {
        const { error } = await supabase
          .from('asin_performance_data')
          .insert(record);
        
        if (!error) {
          inserted++;
        } else if (!error.message.includes('duplicate')) {
          console.error(`   Error inserting ${record.asin}: ${error.message}`);
        }
      }
    }
    
    console.log(`   ✅ Inserted ${inserted} new parent records\n`);
    
    // Now get some search query data
    console.log('4. Fetching search query data...');
    
    // Get the first few ASINs/dates we have
    const { data: recentParents } = await supabase
      .from('asin_performance_data')
      .select('id, asin, start_date')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (!recentParents || recentParents.length === 0) {
      console.log('   No parent records found');
      return;
    }
    
    console.log(`   Using ${recentParents.length} parent records\n`);
    
    // For each parent, get some search queries
    console.log('5. Syncing search query data...');
    let searchInserted = 0;
    
    for (const parent of recentParents) {
      const searchDataQuery = `
        SELECT 
          '${parent.asin}' as parent_asin,
          \`Search Query\` as search_query,
          \`Search Query Score\` as score,
          \`ASIN Impression Count\` as impressions,
          \`ASIN Click Count\` as clicks,
          \`ASIN Cart Add Count\` as cart_adds,
          \`ASIN Purchase Count\` as purchases
        FROM \`${projectId}.${dataset}.seller-search_query_performance\`
        WHERE \`Parent ASIN\` = '${parent.asin}'
          AND DATE(\`Date\`) = '${parent.start_date}'
        LIMIT 10
      `;
      
      try {
        const [searchRows] = await bigquery.query({ query: searchDataQuery });
        
        for (const row of searchRows) {
          const searchRecord = {
            asin_performance_id: parent.id,
            search_query: row.search_query || '',
            search_query_score: parseInt(row.score) || 0,
            asin_impression_count: parseInt(row.impressions) || 0,
            asin_click_count: parseInt(row.clicks) || 0,
            asin_cart_add_count: parseInt(row.cart_adds) || 0,
            asin_purchase_count: parseInt(row.purchases) || 0
          };
          
          // Check if exists
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
              console.error(`   Error inserting search query: ${error.message}`);
            }
          }
        }
      } catch (queryError) {
        console.error(`   Error querying for ${parent.asin}: ${queryError.message}`);
      }
    }
    
    console.log(`   ✅ Inserted ${searchInserted} search query records\n`);
    
    console.log('✅ Sync completed!');
    console.log(`   Parent records: ${inserted}`);
    console.log(`   Search queries: ${searchInserted}`);
    
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runSimpleSync().catch(console.error);