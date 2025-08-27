#!/usr/bin/env node
require('dotenv').config();

const { BigQuery } = require('@google-cloud/bigquery');
const { createClient } = require('@supabase/supabase-js');

async function testASINDistribution() {
  console.log('Testing ASIN Distribution Analysis...\n');
  
  try {
    // BigQuery setup
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    const projectId = process.env.BIGQUERY_PROJECT_ID || 'amazon-sp-report-loader';
    const datasetId = process.env.BIGQUERY_DATASET || 'sqp_data';
    
    const bigquery = new BigQuery({ projectId, credentials });
    
    // Get a sample query to analyze
    console.log('1. Finding queries with good ASIN distribution...');
    const topQueriesQuery = `
      SELECT 
        \`Search Query\` as query,
        COUNT(DISTINCT \`Child ASIN\`) as asin_count,
        SUM(\`ASIN Impression Count\`) as total_impressions
      FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
      WHERE DATE(Date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      GROUP BY \`Search Query\`
      HAVING COUNT(DISTINCT \`Child ASIN\`) > 10
      ORDER BY total_impressions DESC
      LIMIT 3
    `;
    
    const [topQueries] = await bigquery.query(topQueriesQuery);
    
    if (topQueries.length === 0) {
      console.log('No queries found with >10 ASINs in the last 30 days');
      return;
    }
    
    console.log('\nTop queries with multiple ASINs:');
    topQueries.forEach(q => {
      console.log(`  - "${q.query}": ${q.asin_count} ASINs, ${q.total_impressions.toLocaleString()} impressions`);
    });
    
    // Analyze ASIN distribution for the top query
    const targetQuery = topQueries[0].query;
    console.log(`\n2. Analyzing ASIN distribution for "${targetQuery}"...`);
    
    const distributionQuery = `
      SELECT
        \`Child ASIN\` as asin,
        SUM(\`ASIN Impression Count\`) as impressions,
        SUM(\`ASIN Click Count\`) as clicks,
        SUM(\`ASIN Purchase Count\`) as purchases,
        SAFE_DIVIDE(SUM(\`ASIN Click Count\`), SUM(\`ASIN Impression Count\`)) * 100 as ctr,
        SAFE_DIVIDE(SUM(\`ASIN Purchase Count\`), SUM(\`ASIN Click Count\`)) * 100 as cvr
      FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
      WHERE \`Search Query\` = @query
        AND DATE(Date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      GROUP BY \`Child ASIN\`
      ORDER BY impressions DESC
      LIMIT 20
    `;
    
    const options = {
      query: distributionQuery,
      params: { query: targetQuery }
    };
    
    const [asinData] = await bigquery.query(options);
    
    console.log('\nTop 20 ASINs by impressions:');
    console.log('ASIN        | Impressions | Clicks | Purchases | CTR % | CVR %');
    console.log('------------|-------------|--------|-----------|-------|-------');
    
    let totalImpressions = 0;
    asinData.forEach((asin, index) => {
      totalImpressions += asin.impressions;
      console.log(
        `${asin.asin.padEnd(11)} | ${asin.impressions.toString().padStart(11)} | ${asin.clicks.toString().padStart(6)} | ${asin.purchases.toString().padStart(9)} | ${(asin.ctr || 0).toFixed(2).padStart(5)} | ${(asin.cvr || 0).toFixed(2).padStart(5)}`
      );
    });
    
    // Test different sampling strategies
    console.log('\n3. Testing sampling strategies:');
    
    // Strategy 1: Top 1 ASIN
    const top1Impressions = asinData[0].impressions;
    console.log(`\n  Strategy 1 - Top 1 ASIN:`);
    console.log(`    - ASIN: ${asinData[0].asin}`);
    console.log(`    - Coverage: ${(top1Impressions / totalImpressions * 100).toFixed(2)}% of top 20 impressions`);
    
    // Strategy 2: Top 5 ASINs
    const top5Impressions = asinData.slice(0, 5).reduce((sum, a) => sum + a.impressions, 0);
    console.log(`\n  Strategy 2 - Top 5 ASINs:`);
    console.log(`    - ASINs: ${asinData.slice(0, 5).map(a => a.asin).join(', ')}`);
    console.log(`    - Coverage: ${(top5Impressions / totalImpressions * 100).toFixed(2)}% of top 20 impressions`);
    
    // Strategy 3: Top 10 ASINs
    const top10Impressions = asinData.slice(0, 10).reduce((sum, a) => sum + a.impressions, 0);
    console.log(`\n  Strategy 3 - Top 10 ASINs:`);
    console.log(`    - Coverage: ${(top10Impressions / totalImpressions * 100).toFixed(2)}% of top 20 impressions`);
    
    // Test Supabase connection if credentials are available
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      console.log('\n4. Testing Supabase connection...');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );
      
      // Try to query a table
      const { data, error } = await supabase
        .from('sqp_weekly_summary')
        .select('count')
        .limit(1);
      
      if (error && error.code !== 'PGRST116') {
        console.log(`   ❌ Supabase connection error: ${error.message}`);
      } else {
        console.log('   ✅ Supabase connection successful');
      }
    } else {
      console.log('\n4. Skipping Supabase test (credentials not configured)');
    }
    
    console.log('\n✅ ASIN distribution analysis complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.errors && error.errors[0]) {
      console.error('   Details:', error.errors[0].message);
    }
  }
}

// Run the test
testASINDistribution();