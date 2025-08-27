#!/usr/bin/env node
require('dotenv').config();

const { BigQuery } = require('@google-cloud/bigquery');
const { createClient } = require('@supabase/supabase-js');
const { format } = require('date-fns');

// ASIN filtering strategies
const STRATEGIES = {
  TOP_1: 'top_1',
  TOP_5: 'top_5',
  TOP_10: 'top_10',
  ALL: 'all'
};

async function syncBigQueryToSupabase(strategy = STRATEGIES.TOP_5, testQuery = 'knife sharpener') {
  console.log('BigQuery to Supabase Data Sync\n');
  console.log('===============================\n');
  console.log(`Strategy: ${strategy}`);
  console.log(`Test Query: ${testQuery}`);
  console.log(`Timestamp: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}\n`);
  
  try {
    // Initialize BigQuery
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    const projectId = process.env.BIGQUERY_PROJECT_ID || 'amazon-sp-report-loader';
    const datasetId = process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85';
    
    const bigquery = new BigQuery({ projectId, credentials });
    
    // Initialize Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    // Date range - last 7 days of available data
    const endDate = '2025-08-10';
    const startDate = '2025-08-04';
    
    console.log(`Date Range: ${startDate} to ${endDate}\n`);
    
    // Step 1: Get ASINs based on strategy
    console.log('Step 1: Selecting ASINs based on strategy...');
    
    let asinFilter = '';
    if (strategy !== STRATEGIES.ALL) {
      const asinQuery = `
        SELECT 
          \`Child ASIN\` as asin,
          SUM(\`ASIN Impression Count\`) as total_impressions
        FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
        WHERE \`Search Query\` = @query
          AND DATE(Date) BETWEEN @start_date AND @end_date
        GROUP BY asin
        ORDER BY total_impressions DESC
        LIMIT @limit
      `;
      
      const limit = strategy === STRATEGIES.TOP_1 ? 1 : 
                    strategy === STRATEGIES.TOP_5 ? 5 : 10;
      
      const [topASINs] = await bigquery.query({
        query: asinQuery,
        params: {
          query: testQuery,
          start_date: startDate,
          end_date: endDate,
          limit: limit
        }
      });
      
      if (topASINs.length === 0) {
        console.log('No ASINs found for the query.');
        return;
      }
      
      const asinList = topASINs.map(row => `'${row.asin}'`).join(',');
      asinFilter = `AND \`Child ASIN\` IN (${asinList})`;
      
      console.log(`Selected ${topASINs.length} ASINs:`);
      topASINs.forEach((asin, idx) => {
        console.log(`  ${idx + 1}. ${asin.asin} - ${asin.total_impressions.toLocaleString()} impressions`);
      });
    }
    
    // Step 2: Get data from BigQuery
    console.log('\nStep 2: Fetching data from BigQuery...');
    
    const dataQuery = `
      SELECT 
        \`Search Query\` as search_query,
        \`Child ASIN\` as asin,
        \`Product Name\` as product_name,
        DATE(Date) as date,
        SUM(\`ASIN Impression Count\`) as impressions,
        SUM(\`ASIN Click Count\`) as clicks,
        SUM(\`ASIN Purchase Count\`) as purchases,
        SAFE_DIVIDE(SUM(\`ASIN Click Count\`), SUM(\`ASIN Impression Count\`)) as ctr,
        SAFE_DIVIDE(SUM(\`ASIN Purchase Count\`), SUM(\`ASIN Click Count\`)) as cvr,
        ANY_VALUE(\`Marketplace\`) as marketplace,
        ANY_VALUE(\`Category\`) as category
      FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
      WHERE \`Search Query\` = @query
        AND DATE(Date) BETWEEN @start_date AND @end_date
        ${asinFilter}
      GROUP BY search_query, asin, product_name, date
      ORDER BY date DESC, impressions DESC
    `;
    
    const [rows] = await bigquery.query({
      query: dataQuery,
      params: {
        query: testQuery,
        start_date: startDate,
        end_date: endDate
      }
    });
    
    console.log(`Fetched ${rows.length} records from BigQuery`);
    
    if (rows.length === 0) {
      console.log('No data found to sync.');
      return;
    }
    
    // Step 3: Check Supabase tables
    console.log('\nStep 3: Checking Supabase tables...');
    
    // Check if sqp_test table exists
    const { data: tables, error: tableError } = await supabase
      .from('sqp_test')
      .select('search_query')
      .limit(1);
    
    if (tableError && tableError.code === 'PGRST204') {
      console.log('Creating sqp_test table in Supabase...');
      
      // Note: In a real scenario, you'd create the table via migration
      // For now, we'll just note that the table needs to be created
      console.log('\n⚠️  Table sqp_test does not exist in Supabase.');
      console.log('Please create the table with the following schema:');
      console.log(`
CREATE TABLE sqp_test (
  id SERIAL PRIMARY KEY,
  search_query VARCHAR(255),
  asin VARCHAR(20),
  product_name TEXT,
  date DATE,
  impressions INTEGER,
  clicks INTEGER,
  purchases INTEGER,
  ctr DECIMAL(5,2),
  cvr DECIMAL(5,2),
  marketplace VARCHAR(50),
  category VARCHAR(255),
  sync_strategy VARCHAR(20),
  sync_timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sqp_test_query ON sqp_test(search_query);
CREATE INDEX idx_sqp_test_asin ON sqp_test(asin);
CREATE INDEX idx_sqp_test_date ON sqp_test(date);
      `);
      return;
    }
    
    // Step 4: Transform and prepare data for Supabase
    console.log('\nStep 4: Transforming data for Supabase...');
    
    const supabaseData = rows.map(row => ({
      search_query: row.search_query,
      asin: row.asin,
      product_name: row.product_name,
      date: format(new Date(row.date.value), 'yyyy-MM-dd'),
      impressions: parseInt(row.impressions),
      clicks: parseInt(row.clicks),
      purchases: parseInt(row.purchases),
      ctr: parseFloat((row.ctr * 100).toFixed(2)),
      cvr: row.cvr ? parseFloat((row.cvr * 100).toFixed(2)) : 0,
      marketplace: row.marketplace,
      category: row.category,
      sync_strategy: strategy,
      sync_timestamp: new Date().toISOString()
    }));
    
    // Step 5: Insert data into Supabase
    console.log('\nStep 5: Inserting data into Supabase...');
    
    // Insert in batches of 100
    const batchSize = 100;
    let totalInserted = 0;
    
    for (let i = 0; i < supabaseData.length; i += batchSize) {
      const batch = supabaseData.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('sqp_test')
        .insert(batch);
      
      if (error) {
        console.error(`Error inserting batch ${Math.floor(i/batchSize) + 1}:`, error.message);
      } else {
        totalInserted += batch.length;
        console.log(`  Inserted batch ${Math.floor(i/batchSize) + 1} (${batch.length} records)`);
      }
    }
    
    console.log(`\n✅ Successfully synced ${totalInserted} records to Supabase`);
    
    // Step 6: Verify the sync
    console.log('\nStep 6: Verifying sync...');
    
    const { data: verifyData, error: verifyError } = await supabase
      .from('sqp_test')
      .select('search_query, asin, impressions')
      .eq('search_query', testQuery)
      .eq('sync_strategy', strategy)
      .order('impressions', { ascending: false })
      .limit(5);
    
    if (verifyError) {
      console.error('Verification error:', verifyError.message);
    } else {
      console.log('\nTop 5 records in Supabase:');
      verifyData.forEach((row, idx) => {
        console.log(`  ${idx + 1}. ${row.asin}: ${row.impressions.toLocaleString()} impressions`);
      });
    }
    
    // Summary statistics
    const totalImpressions = supabaseData.reduce((sum, row) => sum + row.impressions, 0);
    const totalClicks = supabaseData.reduce((sum, row) => sum + row.clicks, 0);
    const totalPurchases = supabaseData.reduce((sum, row) => sum + row.purchases, 0);
    
    console.log('\n📊 Sync Summary:');
    console.log(`  Strategy: ${strategy}`);
    console.log(`  Records synced: ${totalInserted}`);
    console.log(`  Total impressions: ${totalImpressions.toLocaleString()}`);
    console.log(`  Total clicks: ${totalClicks.toLocaleString()}`);
    console.log(`  Total purchases: ${totalPurchases.toLocaleString()}`);
    console.log(`  Overall CTR: ${(totalClicks / totalImpressions * 100).toFixed(2)}%`);
    console.log(`  Overall CVR: ${(totalPurchases / totalClicks * 100).toFixed(2)}%`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.errors && error.errors[0]) {
      console.error('   Details:', error.errors[0].message);
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const strategy = args[0] || STRATEGIES.TOP_5;
const query = args[1] || 'knife sharpener';

// Run the sync
syncBigQueryToSupabase(strategy, query);