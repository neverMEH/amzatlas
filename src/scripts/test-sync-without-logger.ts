#!/usr/bin/env node

import { config } from 'dotenv';
import { BigQuery } from '@google-cloud/bigquery';
import { getBigQueryConfig, getTableNames } from '../config/bigquery.config';

// Load environment variables
config();

async function testSyncQuery() {
  console.log('Testing sync query with actual BigQuery data...\n');

  try {
    // Get configuration
    const bigqueryConfig = getBigQueryConfig();
    const tables = getTableNames();

    console.log('Configuration:', {
      projectId: bigqueryConfig.projectId,
      dataset: bigqueryConfig.dataset,
      table: tables.sqpRaw
    });

    // Initialize BigQuery client
    const bigquery = new BigQuery({
      projectId: bigqueryConfig.projectId,
      credentials: bigqueryConfig.credentials,
    });

    // Try to query the table directly to see what columns are available
    console.log('Trying direct table query...');

    const query = `
      SELECT *
      FROM \`${bigqueryConfig.projectId}.${bigqueryConfig.dataset}.${tables.sqpRaw}\`
      LIMIT 3
    `;

    console.log('Query:', query);

    const [job] = await bigquery.createQueryJob({ query });
    const [rows] = await job.getQueryResults();

    if (rows && rows.length > 0) {
      console.log(`\n✅ Query successful! Found ${rows.length} records.`);
      
      console.log('\nTable columns:');
      const firstRow = rows[0];
      const columns = Object.keys(firstRow);
      columns.forEach((col, i) => {
        console.log(`${i + 1}. ${col}: ${typeof firstRow[col]}`);
      });
      
      console.log('\nSample data:');
      rows.forEach((row, i) => {
        console.log(`\nRecord ${i + 1}:`);
        // Show first 10 columns with their values
        columns.slice(0, 10).forEach(col => {
          const value = row[col];
          const displayValue = value && typeof value === 'object' && value.value 
            ? value.value 
            : value;
          console.log(`  ${col}: ${displayValue}`);
        });
      });

      console.log('\n✅ Data structure discovered!');
      
      // Now try a filtered query to see if we can find recent data
      const dateCol = columns.find(col => col.toLowerCase().includes('date')) || columns[0];
      console.log(`\nTrying filtered query with date column: ${dateCol}`);
      
      const filteredQuery = `
        SELECT *
        FROM \`${bigqueryConfig.projectId}.${bigqueryConfig.dataset}.${tables.sqpRaw}\`
        ORDER BY ${dateCol} DESC
        LIMIT 5
      `;
      
      const [filteredJob] = await bigquery.createQueryJob({ query: filteredQuery });
      const [filteredRows] = await filteredJob.getQueryResults();
      
      if (filteredRows && filteredRows.length > 0) {
        console.log('\nMost recent records:');
        filteredRows.forEach((row, i) => {
          const dateValue = row[dateCol] && typeof row[dateCol] === 'object' && row[dateCol].value 
            ? row[dateCol].value 
            : row[dateCol];
          console.log(`${i + 1}. Date: ${dateValue}`);
        });
      }

    } else {
      console.log('❌ No data found in table.');
    }

  } catch (error) {
    console.error('❌ Sync test failed:', error.message);
    
    if (error.message.includes('Unrecognized name')) {
      console.log('Column name issue. Available columns might be different.');
    }
  }
}

testSyncQuery().catch(console.error);