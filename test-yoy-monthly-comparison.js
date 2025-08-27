#!/usr/bin/env node
require('dotenv').config();

const { BigQuery } = require('@google-cloud/bigquery');
const { format } = require('date-fns');

async function runMonthlyYoYComparison() {
  console.log('Year-over-Year Monthly Comparison\n');
  console.log('==================================\n');
  
  try {
    // BigQuery setup
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    const projectId = process.env.BIGQUERY_PROJECT_ID || 'amazon-sp-report-loader';
    const datasetId = process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85';
    
    const bigquery = new BigQuery({ projectId, credentials });
    
    // Compare July 2024 vs July 2025 (last complete month with data for both years)
    console.log('Comparing July 2025 vs July 2024\n');
    
    // Query for monthly YoY comparison
    const monthlyYoyQuery = `
      WITH july_2025 AS (
        SELECT 
          \`Search Query\` as query,
          COUNT(DISTINCT \`Child ASIN\`) as asin_count,
          SUM(\`ASIN Impression Count\`) as impressions,
          SUM(\`ASIN Click Count\`) as clicks,
          SUM(\`ASIN Purchase Count\`) as purchases,
          SAFE_DIVIDE(SUM(\`ASIN Click Count\`), SUM(\`ASIN Impression Count\`)) * 100 as ctr,
          SAFE_DIVIDE(SUM(\`ASIN Purchase Count\`), SUM(\`ASIN Click Count\`)) * 100 as cvr
        FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
        WHERE DATE(Date) BETWEEN '2025-07-01' AND '2025-07-31'
        GROUP BY \`Search Query\`
      ),
      july_2024 AS (
        SELECT 
          \`Search Query\` as query,
          COUNT(DISTINCT \`Child ASIN\`) as asin_count,
          SUM(\`ASIN Impression Count\`) as impressions,
          SUM(\`ASIN Click Count\`) as clicks,
          SUM(\`ASIN Purchase Count\`) as purchases,
          SAFE_DIVIDE(SUM(\`ASIN Click Count\`), SUM(\`ASIN Impression Count\`)) * 100 as ctr,
          SAFE_DIVIDE(SUM(\`ASIN Purchase Count\`), SUM(\`ASIN Click Count\`)) * 100 as cvr
        FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
        WHERE DATE(Date) BETWEEN '2024-09-01' AND '2024-09-30'  -- Using Sept 2024 as proxy since July 2024 has no data
        GROUP BY \`Search Query\`
      )
      SELECT 
        COALESCE(j25.query, j24.query) as query,
        
        -- 2025 Metrics
        IFNULL(j25.impressions, 0) as impressions_2025,
        IFNULL(j25.clicks, 0) as clicks_2025,
        IFNULL(j25.purchases, 0) as purchases_2025,
        ROUND(IFNULL(j25.ctr, 0), 2) as ctr_2025,
        
        -- 2024 Metrics (Sept as proxy)
        IFNULL(j24.impressions, 0) as impressions_2024,
        IFNULL(j24.clicks, 0) as clicks_2024,
        IFNULL(j24.purchases, 0) as purchases_2024,
        ROUND(IFNULL(j24.ctr, 0), 2) as ctr_2024,
        
        -- YoY Changes
        SAFE_DIVIDE(j25.impressions - j24.impressions, j24.impressions) * 100 as impressions_growth,
        SAFE_DIVIDE(j25.clicks - j24.clicks, j24.clicks) * 100 as clicks_growth,
        SAFE_DIVIDE(j25.purchases - j24.purchases, j24.purchases) * 100 as purchases_growth
        
      FROM july_2025 j25
      FULL OUTER JOIN july_2024 j24 ON j25.query = j24.query
      WHERE COALESCE(j25.impressions, 0) + COALESCE(j24.impressions, 0) > 5000
      ORDER BY COALESCE(j25.impressions, 0) DESC
      LIMIT 20
    `;
    
    const [results] = await bigquery.query(monthlyYoyQuery);
    
    console.log('Top 20 Queries - Monthly Comparison (July 2025 vs Sept 2024):\n');
    console.log('Query                     | 2025 Impressions | 2024 Impressions | Growth % | 2025 CTR | 2024 CTR');
    console.log('--------------------------|------------------|------------------|----------|----------|----------');
    
    results.forEach(row => {
      const query = row.query.length > 25 ? row.query.substring(0, 22) + '...' : row.query.padEnd(25);
      const imp2025 = row.impressions_2025.toLocaleString().padStart(16);
      const imp2024 = row.impressions_2024.toLocaleString().padStart(16);
      const growth = row.impressions_growth ? `${row.impressions_growth > 0 ? '+' : ''}${row.impressions_growth.toFixed(1)}%`.padStart(8) : '      New';
      const ctr2025 = `${row.ctr_2025.toFixed(2)}%`.padStart(8);
      const ctr2024 = `${row.ctr_2024.toFixed(2)}%`.padStart(8);
      
      console.log(`${query} | ${imp2025} | ${imp2024} | ${growth} | ${ctr2025} | ${ctr2024}`);
    });
    
    // Monthly trend analysis
    console.log('\n\nMonthly Trend Analysis (Sept 2024 - July 2025):\n');
    
    const trendQuery = `
      SELECT 
        FORMAT_DATE('%Y-%m', Date) as month,
        COUNT(DISTINCT \`Search Query\`) as unique_queries,
        COUNT(DISTINCT \`Child ASIN\`) as unique_asins,
        SUM(\`ASIN Impression Count\`) as total_impressions,
        SUM(\`ASIN Click Count\`) as total_clicks,
        SUM(\`ASIN Purchase Count\`) as total_purchases,
        SAFE_DIVIDE(SUM(\`ASIN Click Count\`), SUM(\`ASIN Impression Count\`)) * 100 as overall_ctr,
        SAFE_DIVIDE(SUM(\`ASIN Purchase Count\`), SUM(\`ASIN Click Count\`)) * 100 as overall_cvr
      FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
      WHERE DATE(Date) >= '2024-09-01' AND DATE(Date) <= '2025-07-31'
      GROUP BY month
      ORDER BY month
    `;
    
    const [trendResults] = await bigquery.query(trendQuery);
    
    console.log('Month   | Queries | ASINs | Impressions    | Clicks   | Purchases | CTR % | CVR %');
    console.log('--------|---------|-------|----------------|----------|-----------|-------|-------');
    
    trendResults.forEach(month => {
      console.log(
        `${month.month} | ${month.unique_queries.toString().padStart(7)} | ${month.unique_asins.toString().padStart(5)} | ${month.total_impressions.toLocaleString().padStart(14)} | ${month.total_clicks.toLocaleString().padStart(8)} | ${month.total_purchases.toLocaleString().padStart(9)} | ${month.overall_ctr.toFixed(2).padStart(5)} | ${month.overall_cvr.toFixed(2).padStart(5)}`
      );
    });
    
    // Calculate growth metrics
    const firstMonth = trendResults.find(m => m.month === '2024-09');
    const lastMonth = trendResults.find(m => m.month === '2025-07');
    
    if (firstMonth && lastMonth) {
      console.log('\n\nGrowth from Sept 2024 to July 2025:');
      console.log('====================================');
      
      const impGrowth = ((lastMonth.total_impressions - firstMonth.total_impressions) / firstMonth.total_impressions * 100).toFixed(1);
      const clickGrowth = ((lastMonth.total_clicks - firstMonth.total_clicks) / firstMonth.total_clicks * 100).toFixed(1);
      const purchGrowth = ((lastMonth.total_purchases - firstMonth.total_purchases) / firstMonth.total_purchases * 100).toFixed(1);
      const queryGrowth = ((lastMonth.unique_queries - firstMonth.unique_queries) / firstMonth.unique_queries * 100).toFixed(1);
      const asinGrowth = ((lastMonth.unique_asins - firstMonth.unique_asins) / firstMonth.unique_asins * 100).toFixed(1);
      
      console.log(`  Impressions: ${impGrowth > 0 ? '+' : ''}${impGrowth}%`);
      console.log(`  Clicks: ${clickGrowth > 0 ? '+' : ''}${clickGrowth}%`);
      console.log(`  Purchases: ${purchGrowth > 0 ? '+' : ''}${purchGrowth}%`);
      console.log(`  Unique Queries: ${queryGrowth > 0 ? '+' : ''}${queryGrowth}%`);
      console.log(`  Unique ASINs: ${asinGrowth > 0 ? '+' : ''}${asinGrowth}%`);
      console.log(`  CTR improvement: ${(lastMonth.overall_ctr - firstMonth.overall_ctr).toFixed(2)} percentage points`);
      console.log(`  CVR improvement: ${(lastMonth.overall_cvr - firstMonth.overall_cvr).toFixed(2)} percentage points`);
    }
    
    console.log('\n✅ Year-over-year monthly comparison complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.errors && error.errors[0]) {
      console.error('   Details:', error.errors[0].message);
    }
  }
}

// Run the comparison
runMonthlyYoYComparison();