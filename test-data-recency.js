#!/usr/bin/env node
require('dotenv').config();

const { BigQuery } = require('@google-cloud/bigquery');
const { format } = require('date-fns');

async function checkDataRecency() {
  console.log('Checking Data Recency\n');
  console.log('=====================\n');
  
  try {
    // BigQuery setup
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    const projectId = process.env.BIGQUERY_PROJECT_ID || 'amazon-sp-report-loader';
    const datasetId = process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85';
    
    const bigquery = new BigQuery({ projectId, credentials });
    
    // Query to find date range of data
    const dateRangeQuery = `
      SELECT 
        MIN(Date) as earliest_date,
        MAX(Date) as latest_date,
        COUNT(DISTINCT Date) as unique_dates,
        COUNT(*) as total_records
      FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
    `;
    
    console.log('Analyzing date range of available data...\n');
    const [dateResults] = await bigquery.query(dateRangeQuery);
    
    if (dateResults.length > 0 && dateResults[0].earliest_date) {
      const result = dateResults[0];
      console.log('Date Range Summary:');
      console.log(`  Earliest Date: ${format(new Date(result.earliest_date.value), 'yyyy-MM-dd')}`);
      console.log(`  Latest Date: ${format(new Date(result.latest_date.value), 'yyyy-MM-dd')}`);
      console.log(`  Total Days: ${result.unique_dates}`);
      console.log(`  Total Records: ${result.total_records.toLocaleString()}`);
      
      // Check recent data availability
      const recentDataQuery = `
        SELECT 
          DATE(Date) as date,
          COUNT(*) as record_count,
          COUNT(DISTINCT \`Search Query\`) as unique_queries,
          COUNT(DISTINCT \`Child ASIN\`) as unique_asins,
          SUM(\`ASIN Impression Count\`) as total_impressions
        FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
        WHERE DATE(Date) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
        GROUP BY DATE(Date)
        ORDER BY date DESC
        LIMIT 30
      `;
      
      console.log('\nRecent Data Availability (Last 30 days):\n');
      const [recentData] = await bigquery.query(recentDataQuery);
      
      if (recentData.length > 0) {
        console.log('Date       | Records | Queries | ASINs | Impressions');
        console.log('-----------|---------|---------|-------|-------------');
        
        recentData.forEach(day => {
          const dateStr = format(new Date(day.date.value), 'yyyy-MM-dd');
          const records = day.record_count.toString().padStart(7);
          const queries = day.unique_queries.toString().padStart(7);
          const asins = day.unique_asins.toString().padStart(5);
          const impressions = day.total_impressions.toLocaleString().padStart(11);
          
          console.log(`${dateStr} | ${records} | ${queries} | ${asins} | ${impressions}`);
        });
      } else {
        console.log('No data found in the last 30 days.');
      }
      
      // Check data for 2024
      const year2024Query = `
        SELECT 
          FORMAT_DATE('%Y-%m', Date) as month,
          COUNT(*) as record_count,
          SUM(\`ASIN Impression Count\`) as total_impressions
        FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
        WHERE EXTRACT(YEAR FROM Date) = 2024
        GROUP BY month
        ORDER BY month
      `;
      
      console.log('\n2024 Data Summary:\n');
      const [data2024] = await bigquery.query(year2024Query);
      
      if (data2024.length > 0) {
        console.log('Month   | Records    | Impressions');
        console.log('--------|------------|-------------');
        data2024.forEach(month => {
          console.log(`${month.month} | ${month.record_count.toString().padStart(10)} | ${month.total_impressions.toLocaleString().padStart(11)}`);
        });
      } else {
        console.log('No data found for 2024.');
      }
      
      // Check data for 2025
      const year2025Query = `
        SELECT 
          FORMAT_DATE('%Y-%m', Date) as month,
          COUNT(*) as record_count,
          SUM(\`ASIN Impression Count\`) as total_impressions
        FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
        WHERE EXTRACT(YEAR FROM Date) = 2025
        GROUP BY month
        ORDER BY month
      `;
      
      console.log('\n2025 Data Summary:\n');
      const [data2025] = await bigquery.query(year2025Query);
      
      if (data2025.length > 0) {
        console.log('Month   | Records    | Impressions');
        console.log('--------|------------|-------------');
        data2025.forEach(month => {
          console.log(`${month.month} | ${month.record_count.toString().padStart(10)} | ${month.total_impressions.toLocaleString().padStart(11)}`);
        });
      } else {
        console.log('No data found for 2025.');
      }
      
    } else {
      console.log('No data found in the table.');
    }
    
    console.log('\n✅ Data recency check complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.errors && error.errors[0]) {
      console.error('   Details:', error.errors[0].message);
    }
  }
}

// Run the check
checkDataRecency();