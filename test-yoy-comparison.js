#!/usr/bin/env node
require('dotenv').config();

const { BigQuery } = require('@google-cloud/bigquery');
const { format, startOfWeek, endOfWeek, subDays, subYears } = require('date-fns');

async function runYoYComparison() {
  console.log('Year-over-Year Comparison for Last Week\n');
  console.log('=======================================\n');
  
  try {
    // BigQuery setup
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    const projectId = process.env.BIGQUERY_PROJECT_ID || 'amazon-sp-report-loader';
    const datasetId = process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85';
    
    const bigquery = new BigQuery({ projectId, credentials });
    
    // Calculate date ranges
    // Data started August 18, 2024, most recent is August 10, 2025
    // Compare week of Aug 4-10, 2025 with Aug 19-25, 2024 (first full week of 2024 data)
    // Or better: compare same calendar week when both years have data
    // Let's use Sept 1-7 for both years
    const thisYearWeekEnd = new Date('2025-08-10'); 
    const thisYearWeekStart = new Date('2025-08-04');
    
    // Since we don't have Aug 4-10 2024, let's compare with the last week of Aug 2024
    const lastYearWeekEnd = new Date('2024-08-25');
    const lastYearWeekStart = new Date('2024-08-19');
    
    // Rename variables for clarity
    const lastWeekEnd = thisYearWeekEnd;
    const lastWeekStart = thisYearWeekStart;
    
    console.log('Date Ranges:');
    console.log(`This Year: ${format(lastWeekStart, 'yyyy-MM-dd')} to ${format(lastWeekEnd, 'yyyy-MM-dd')}`);
    console.log(`Last Year: ${format(lastYearWeekStart, 'yyyy-MM-dd')} to ${format(lastYearWeekEnd, 'yyyy-MM-dd')}`);
    console.log('');
    
    // Query for YoY comparison
    const yoyQuery = `
      WITH this_year AS (
        SELECT 
          \`Search Query\` as query,
          COUNT(DISTINCT \`Child ASIN\`) as asin_count,
          SUM(\`ASIN Impression Count\`) as impressions,
          SUM(\`ASIN Click Count\`) as clicks,
          SUM(\`ASIN Purchase Count\`) as purchases,
          SAFE_DIVIDE(SUM(\`ASIN Click Count\`), SUM(\`ASIN Impression Count\`)) * 100 as ctr,
          SAFE_DIVIDE(SUM(\`ASIN Purchase Count\`), SUM(\`ASIN Click Count\`)) * 100 as cvr,
          SAFE_DIVIDE(SUM(\`ASIN Purchase Count\`), SUM(\`ASIN Impression Count\`)) * 100 as conversion_rate
        FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
        WHERE DATE(Date) BETWEEN @this_year_start AND @this_year_end
        GROUP BY \`Search Query\`
      ),
      last_year AS (
        SELECT 
          \`Search Query\` as query,
          COUNT(DISTINCT \`Child ASIN\`) as asin_count,
          SUM(\`ASIN Impression Count\`) as impressions,
          SUM(\`ASIN Click Count\`) as clicks,
          SUM(\`ASIN Purchase Count\`) as purchases,
          SAFE_DIVIDE(SUM(\`ASIN Click Count\`), SUM(\`ASIN Impression Count\`)) * 100 as ctr,
          SAFE_DIVIDE(SUM(\`ASIN Purchase Count\`), SUM(\`ASIN Click Count\`)) * 100 as cvr,
          SAFE_DIVIDE(SUM(\`ASIN Purchase Count\`), SUM(\`ASIN Impression Count\`)) * 100 as conversion_rate
        FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
        WHERE DATE(Date) BETWEEN @last_year_start AND @last_year_end
        GROUP BY \`Search Query\`
      )
      SELECT 
        COALESCE(ty.query, ly.query) as query,
        
        -- This Year Metrics
        IFNULL(ty.impressions, 0) as ty_impressions,
        IFNULL(ty.clicks, 0) as ty_clicks,
        IFNULL(ty.purchases, 0) as ty_purchases,
        IFNULL(ty.asin_count, 0) as ty_asin_count,
        ROUND(IFNULL(ty.ctr, 0), 2) as ty_ctr,
        ROUND(IFNULL(ty.cvr, 0), 2) as ty_cvr,
        
        -- Last Year Metrics
        IFNULL(ly.impressions, 0) as ly_impressions,
        IFNULL(ly.clicks, 0) as ly_clicks,
        IFNULL(ly.purchases, 0) as ly_purchases,
        IFNULL(ly.asin_count, 0) as ly_asin_count,
        ROUND(IFNULL(ly.ctr, 0), 2) as ly_ctr,
        ROUND(IFNULL(ly.cvr, 0), 2) as ly_cvr,
        
        -- YoY Changes
        SAFE_DIVIDE(ty.impressions - ly.impressions, ly.impressions) * 100 as impressions_yoy_pct,
        SAFE_DIVIDE(ty.clicks - ly.clicks, ly.clicks) * 100 as clicks_yoy_pct,
        SAFE_DIVIDE(ty.purchases - ly.purchases, ly.purchases) * 100 as purchases_yoy_pct,
        ty.ctr - ly.ctr as ctr_yoy_change,
        ty.cvr - ly.cvr as cvr_yoy_change
        
      FROM this_year ty
      FULL OUTER JOIN last_year ly ON ty.query = ly.query
      WHERE COALESCE(ty.impressions, 0) + COALESCE(ly.impressions, 0) > 1000  -- Filter for queries with meaningful traffic
      ORDER BY COALESCE(ty.impressions, 0) + COALESCE(ly.impressions, 0) DESC
      LIMIT 20
    `;
    
    const options = {
      query: yoyQuery,
      params: {
        this_year_start: format(lastWeekStart, 'yyyy-MM-dd'),
        this_year_end: format(lastWeekEnd, 'yyyy-MM-dd'),
        last_year_start: format(lastYearWeekStart, 'yyyy-MM-dd'),
        last_year_end: format(lastYearWeekEnd, 'yyyy-MM-dd')
      }
    };
    
    console.log('Running year-over-year comparison...\n');
    const [results] = await bigquery.query(options);
    
    if (results.length === 0) {
      console.log('No data found for the specified date ranges.');
      return;
    }
    
    // Display results in a formatted table
    console.log('Top 20 Queries - Year over Year Comparison:\n');
    console.log('Query                          | Impressions      | YoY % | Clicks        | YoY % | Purchases   | YoY % | CTR Change | CVR Change');
    console.log('-------------------------------|------------------|-------|---------------|-------|-------------|-------|------------|------------');
    
    results.forEach(row => {
      const query = row.query.length > 30 ? row.query.substring(0, 27) + '...' : row.query.padEnd(30);
      const impStr = `${row.ty_impressions.toLocaleString()} / ${row.ly_impressions.toLocaleString()}`.padEnd(16);
      const impYoY = row.impressions_yoy_pct ? `${row.impressions_yoy_pct.toFixed(1)}%`.padStart(5) : '   -  ';
      const clickStr = `${row.ty_clicks} / ${row.ly_clicks}`.padEnd(13);
      const clickYoY = row.clicks_yoy_pct ? `${row.clicks_yoy_pct.toFixed(1)}%`.padStart(5) : '   -  ';
      const purchStr = `${row.ty_purchases} / ${row.ly_purchases}`.padEnd(11);
      const purchYoY = row.purchases_yoy_pct ? `${row.purchases_yoy_pct.toFixed(1)}%`.padStart(5) : '   -  ';
      const ctrChange = row.ctr_yoy_change ? `${row.ctr_yoy_change > 0 ? '+' : ''}${row.ctr_yoy_change.toFixed(2)}%`.padStart(10) : '         -';
      const cvrChange = row.cvr_yoy_change ? `${row.cvr_yoy_change > 0 ? '+' : ''}${row.cvr_yoy_change.toFixed(2)}%`.padStart(10) : '         -';
      
      console.log(`${query} | ${impStr} | ${impYoY} | ${clickStr} | ${clickYoY} | ${purchStr} | ${purchYoY} | ${ctrChange} | ${cvrChange}`);
    });
    
    // Summary statistics
    console.log('\n\nOverall Summary:');
    console.log('================');
    
    const summaryQuery = `
      WITH this_year_total AS (
        SELECT 
          SUM(\`ASIN Impression Count\`) as total_impressions,
          SUM(\`ASIN Click Count\`) as total_clicks,
          SUM(\`ASIN Purchase Count\`) as total_purchases,
          COUNT(DISTINCT \`Search Query\`) as unique_queries,
          COUNT(DISTINCT \`Child ASIN\`) as unique_asins
        FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
        WHERE DATE(Date) BETWEEN @this_year_start AND @this_year_end
      ),
      last_year_total AS (
        SELECT 
          SUM(\`ASIN Impression Count\`) as total_impressions,
          SUM(\`ASIN Click Count\`) as total_clicks,
          SUM(\`ASIN Purchase Count\`) as total_purchases,
          COUNT(DISTINCT \`Search Query\`) as unique_queries,
          COUNT(DISTINCT \`Child ASIN\`) as unique_asins
        FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
        WHERE DATE(Date) BETWEEN @last_year_start AND @last_year_end
      )
      SELECT 
        ty.total_impressions as ty_impressions,
        ly.total_impressions as ly_impressions,
        ty.total_clicks as ty_clicks,
        ly.total_clicks as ly_clicks,
        ty.total_purchases as ty_purchases,
        ly.total_purchases as ly_purchases,
        ty.unique_queries as ty_queries,
        ly.unique_queries as ly_queries,
        ty.unique_asins as ty_asins,
        ly.unique_asins as ly_asins
      FROM this_year_total ty, last_year_total ly
    `;
    
    const [summaryResults] = await bigquery.query({
      query: summaryQuery,
      params: options.params
    });
    
    if (summaryResults.length > 0) {
      const summary = summaryResults[0];
      
      console.log(`\nThis Year (${format(lastWeekStart, 'MMM d')} - ${format(lastWeekEnd, 'MMM d, yyyy')}):`);
      console.log(`  Total Impressions: ${(summary.ty_impressions || 0).toLocaleString()}`);
      console.log(`  Total Clicks: ${(summary.ty_clicks || 0).toLocaleString()}`);
      console.log(`  Total Purchases: ${(summary.ty_purchases || 0).toLocaleString()}`);
      console.log(`  Unique Queries: ${(summary.ty_queries || 0).toLocaleString()}`);
      console.log(`  Unique ASINs: ${(summary.ty_asins || 0).toLocaleString()}`);
      
      console.log(`\nLast Year (${format(lastYearWeekStart, 'MMM d')} - ${format(lastYearWeekEnd, 'MMM d, yyyy')}):`);
      console.log(`  Total Impressions: ${(summary.ly_impressions || 0).toLocaleString()}`);
      console.log(`  Total Clicks: ${(summary.ly_clicks || 0).toLocaleString()}`);
      console.log(`  Total Purchases: ${(summary.ly_purchases || 0).toLocaleString()}`);
      console.log(`  Unique Queries: ${(summary.ly_queries || 0).toLocaleString()}`);
      console.log(`  Unique ASINs: ${(summary.ly_asins || 0).toLocaleString()}`);
      
      console.log('\nYear-over-Year Growth:');
      
      // Calculate growth with null/zero handling
      const calculateGrowth = (current, previous) => {
        if (!previous || previous === 0) return current > 0 ? 'New' : '-';
        const growth = ((current - previous) / previous * 100).toFixed(1);
        return `${growth > 0 ? '+' : ''}${growth}%`;
      };
      
      console.log(`  Impressions: ${calculateGrowth(summary.ty_impressions, summary.ly_impressions)}`);
      console.log(`  Clicks: ${calculateGrowth(summary.ty_clicks, summary.ly_clicks)}`);
      console.log(`  Purchases: ${calculateGrowth(summary.ty_purchases, summary.ly_purchases)}`);
      console.log(`  Unique Queries: ${calculateGrowth(summary.ty_queries, summary.ly_queries)}`);
      console.log(`  Unique ASINs: ${calculateGrowth(summary.ty_asins, summary.ly_asins)}`);
    }
    
    console.log('\n✅ Year-over-year comparison complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.errors && error.errors[0]) {
      console.error('   Details:', error.errors[0].message);
    }
  }
}

// Run the comparison
runYoYComparison();