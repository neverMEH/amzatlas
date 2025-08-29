#!/usr/bin/env tsx

import { config } from 'dotenv';
config();

import { BigQuery } from '@google-cloud/bigquery';
import { getBigQueryConfig, getTableNames } from '../config/bigquery.config';

async function checkBigQueryDates() {
  try {
    const bigqueryConfig = getBigQueryConfig();
    const tables = getTableNames();
    
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    let credentials;
    if (credentialsJson) {
      credentials = JSON.parse(credentialsJson);
    }

    const bigquery = new BigQuery({
      projectId: bigqueryConfig.projectId,
      credentials: credentials,
    });

    // Check date range and product data availability
    const query = `
      SELECT 
        MIN(Date) as earliest_date,
        MAX(Date) as latest_date,
        COUNT(DISTINCT Date) as unique_dates,
        COUNT(DISTINCT \`Child ASIN\`) as unique_asins,
        COUNT(*) as total_rows,
        COUNT(\`Product Name\`) as rows_with_product_name
      FROM \`${bigqueryConfig.projectId}.${bigqueryConfig.dataset}.${tables.sqpRaw}\`
    `;

    console.log('Checking BigQuery data availability...\n');
    const [result] = await bigquery.query(query);
    
    console.log('Data Summary:');
    console.log('- Earliest Date:', result[0].earliest_date?.value || result[0].earliest_date);
    console.log('- Latest Date:', result[0].latest_date?.value || result[0].latest_date);
    console.log('- Unique Dates:', result[0].unique_dates);
    console.log('- Unique ASINs:', result[0].unique_asins);
    console.log('- Total Rows:', result[0].total_rows);
    console.log('- Rows with Product Name:', result[0].rows_with_product_name);

    // Get a sample week with product data
    const sampleQuery = `
      SELECT 
        Date,
        COUNT(*) as row_count,
        COUNT(DISTINCT \`Child ASIN\`) as asin_count,
        COUNT(\`Product Name\`) as with_product_name
      FROM \`${bigqueryConfig.projectId}.${bigqueryConfig.dataset}.${tables.sqpRaw}\`
      WHERE \`Product Name\` IS NOT NULL
      GROUP BY Date
      ORDER BY Date DESC
      LIMIT 7
    `;

    console.log('\nRecent dates with product data:');
    const [sampleDates] = await bigquery.query(sampleQuery);
    
    sampleDates.forEach(row => {
      const date = row.Date?.value || row.Date;
      console.log(`- ${date}: ${row.row_count} rows, ${row.asin_count} ASINs, ${row.with_product_name} with product names`);
    });

    // Get specific ASIN with product data
    const asinQuery = `
      SELECT 
        \`Child ASIN\` as asin,
        \`Product Name\` as productName,
        MIN(Date) as first_date,
        MAX(Date) as last_date,
        COUNT(*) as occurrences
      FROM \`${bigqueryConfig.projectId}.${bigqueryConfig.dataset}.${tables.sqpRaw}\`
      WHERE \`Product Name\` IS NOT NULL
      GROUP BY \`Child ASIN\`, \`Product Name\`
      ORDER BY occurrences DESC
      LIMIT 5
    `;

    console.log('\nTop ASINs with product data:');
    const [topAsins] = await bigquery.query(asinQuery);
    
    topAsins.forEach(row => {
      console.log(`\nASIN: ${row.asin}`);
      console.log(`Product: ${row.productName}`);
      console.log(`Date Range: ${row.first_date?.value || row.first_date} to ${row.last_date?.value || row.last_date}`);
      console.log(`Occurrences: ${row.occurrences}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

checkBigQueryDates().catch(console.error);