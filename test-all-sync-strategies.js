#!/usr/bin/env node
require('dotenv').config();

const { BigQuery } = require('@google-cloud/bigquery');
const { createClient } = require('@supabase/supabase-js');
const { format } = require('date-fns');

async function testAllStrategies() {
  console.log('Testing All ASIN Sync Strategies\n');
  console.log('================================\n');
  
  const strategies = [
    { name: 'top_1', description: 'Top 1 ASIN only' },
    { name: 'top_5', description: 'Top 5 ASINs' },
    { name: 'top_10', description: 'Top 10 ASINs' },
    { name: 'all', description: 'All ASINs' }
  ];
  
  const testQuery = 'knife sharpener';
  
  console.log(`Test Query: "${testQuery}"\n`);
  
  // First, check what data is available
  try {
    // Initialize BigQuery
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    const projectId = process.env.BIGQUERY_PROJECT_ID || 'amazon-sp-report-loader';
    const datasetId = process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85';
    
    const bigquery = new BigQuery({ projectId, credentials });
    
    // Check data availability
    const overviewQuery = `
      SELECT 
        COUNT(DISTINCT \`Child ASIN\`) as total_asins,
        SUM(\`ASIN Impression Count\`) as total_impressions,
        SUM(\`ASIN Click Count\`) as total_clicks,
        SUM(\`ASIN Purchase Count\`) as total_purchases
      FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
      WHERE \`Search Query\` = @query
        AND DATE(Date) BETWEEN '2025-08-04' AND '2025-08-10'
    `;
    
    const [overview] = await bigquery.query({
      query: overviewQuery,
      params: { query: testQuery }
    });
    
    if (overview.length > 0 && overview[0].total_asins > 0) {
      console.log('📊 Data Overview:');
      console.log(`   Total ASINs: ${overview[0].total_asins}`);
      console.log(`   Total Impressions: ${overview[0].total_impressions.toLocaleString()}`);
      console.log(`   Total Clicks: ${overview[0].total_clicks.toLocaleString()}`);
      console.log(`   Total Purchases: ${overview[0].total_purchases.toLocaleString()}\n`);
    }
    
    // Test each strategy
    for (const strategy of strategies) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`Testing Strategy: ${strategy.name} (${strategy.description})`);
      console.log('='.repeat(50) + '\n');
      
      // Calculate coverage for this strategy
      let coverageQuery = '';
      if (strategy.name === 'top_1') {
        coverageQuery = `
          WITH top_asins AS (
            SELECT 
              \`Child ASIN\` as asin,
              SUM(\`ASIN Impression Count\`) as asin_impressions
            FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
            WHERE \`Search Query\` = @query
              AND DATE(Date) BETWEEN '2025-08-04' AND '2025-08-10'
            GROUP BY asin
            ORDER BY asin_impressions DESC
            LIMIT 1
          )
          SELECT 
            COUNT(DISTINCT ta.asin) as selected_asins,
            SUM(ta.asin_impressions) as covered_impressions
          FROM top_asins ta
        `;
      } else if (strategy.name === 'top_5') {
        coverageQuery = `
          WITH top_asins AS (
            SELECT 
              \`Child ASIN\` as asin,
              SUM(\`ASIN Impression Count\`) as asin_impressions
            FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
            WHERE \`Search Query\` = @query
              AND DATE(Date) BETWEEN '2025-08-04' AND '2025-08-10'
            GROUP BY asin
            ORDER BY asin_impressions DESC
            LIMIT 5
          )
          SELECT 
            COUNT(DISTINCT ta.asin) as selected_asins,
            SUM(ta.asin_impressions) as covered_impressions
          FROM top_asins ta
        `;
      } else if (strategy.name === 'top_10') {
        coverageQuery = `
          WITH top_asins AS (
            SELECT 
              \`Child ASIN\` as asin,
              SUM(\`ASIN Impression Count\`) as asin_impressions
            FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
            WHERE \`Search Query\` = @query
              AND DATE(Date) BETWEEN '2025-08-04' AND '2025-08-10'
            GROUP BY asin
            ORDER BY asin_impressions DESC
            LIMIT 10
          )
          SELECT 
            COUNT(DISTINCT ta.asin) as selected_asins,
            SUM(ta.asin_impressions) as covered_impressions
          FROM top_asins ta
        `;
      }
      
      if (coverageQuery) {
        const [coverage] = await bigquery.query({
          query: coverageQuery,
          params: { query: testQuery }
        });
        
        if (coverage.length > 0 && coverage[0].selected_asins > 0) {
          const coveragePercent = (coverage[0].covered_impressions / overview[0].total_impressions * 100).toFixed(1);
          console.log(`📈 Strategy Coverage:`);
          console.log(`   ASINs selected: ${coverage[0].selected_asins}`);
          console.log(`   Impressions covered: ${coverage[0].covered_impressions.toLocaleString()} (${coveragePercent}%)`);
        }
      } else {
        // For 'all' strategy
        console.log(`📈 Strategy Coverage:`);
        console.log(`   ASINs selected: ALL (${overview[0].total_asins})`);
        console.log(`   Impressions covered: ${overview[0].total_impressions.toLocaleString()} (100.0%)`);
      }
      
      // Show sample command
      console.log(`\n💻 To sync with this strategy, run:`);
      console.log(`   node sync-bigquery-to-supabase.js ${strategy.name} "${testQuery}"`);
    }
    
    console.log('\n\n📌 Recommendations:');
    console.log('   • For quick testing: Use "top_1" (minimal data, fastest)');
    console.log('   • For balanced testing: Use "top_5" (good coverage, reasonable size)');
    console.log('   • For comprehensive testing: Use "top_10" (excellent coverage)');
    console.log('   • For complete data: Use "all" (full dataset, largest size)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.errors && error.errors[0]) {
      console.error('   Details:', error.errors[0].message);
    }
  }
}

// Run the test
testAllStrategies();