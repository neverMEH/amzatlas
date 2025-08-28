#!/usr/bin/env node

import { config } from 'dotenv';
import { BigQuery } from '@google-cloud/bigquery';
import { getBigQueryConfig, getTableNames } from '../config/bigquery.config';

// Load environment variables
config();

async function testBigQueryConnection() {
  console.log('Testing BigQuery connection and query...\n');

  // Get configuration
  const bigqueryConfig = getBigQueryConfig();
  const tables = getTableNames();

  try {

    console.log('BigQuery Config:', {
      projectId: bigqueryConfig.projectId,
      dataset: bigqueryConfig.dataset,
      table: tables.sqpRaw,
      hasCredentials: !!bigqueryConfig.credentials
    });

    // Initialize BigQuery client
    const bigquery = new BigQuery({
      projectId: bigqueryConfig.projectId,
      credentials: bigqueryConfig.credentials,
    });

    // First, let's check the table schema
    const schemaQuery = `
      SELECT column_name, data_type
      FROM \`${bigqueryConfig.projectId}.${bigqueryConfig.dataset}.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name = '${tables.sqpRaw.replace('-', '_')}'
      ORDER BY ordinal_position
      LIMIT 10
    `;

    console.log('Checking table schema...');
    console.log('Schema query:', schemaQuery);

    const [schemaJob] = await bigquery.createQueryJob({ query: schemaQuery });
    const [schemaRows] = await schemaJob.getQueryResults();

    if (schemaRows && schemaRows.length > 0) {
      console.log('\n✅ Table schema:');
      schemaRows.forEach(row => {
        console.log(`- ${row.column_name}: ${row.data_type}`);
      });
      
      // Now try a simple count query
      const testQuery = `
        SELECT 
          COUNT(*) as total_records
        FROM \`${bigqueryConfig.projectId}.${bigqueryConfig.dataset}.${tables.sqpRaw}\`
        LIMIT 1
      `;
      
      console.log('\nExecuting count query...');
      
      const [testJob] = await bigquery.createQueryJob({ query: testQuery });
      const [testRows] = await testJob.getQueryResults();
      
      if (testRows && testRows.length > 0) {
        console.log('✅ Total records:', testRows[0].total_records);
      }
    } else {
      // Fallback: try the original query with different possible column names
      const possibleDateColumns = ['startDate', 'start_date', 'date', 'query_date'];
      
      for (const dateCol of possibleDateColumns) {
        try {
          const testQuery = `
            SELECT 
              COUNT(*) as total_records,
              MIN(${dateCol}) as earliest_date,
              MAX(${dateCol}) as latest_date
            FROM \`${bigqueryConfig.projectId}.${bigqueryConfig.dataset}.${tables.sqpRaw}\`
            LIMIT 1
          `;
          
          console.log(`Trying with date column: ${dateCol}`);
          const [job] = await bigquery.createQueryJob({ query: testQuery });
          const [rows] = await job.getQueryResults();
          
          if (rows && rows.length > 0) {
            console.log(`✅ Success with column: ${dateCol}`);
            console.log('Results:', rows[0]);
            break;
          }
        } catch (error) {
          console.log(`❌ Failed with ${dateCol}:`, error instanceof Error ? error.message : String(error));
        }
      }
    }


  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ BigQuery connection failed:', errorMessage);
    
    if (errorMessage.includes('credentials')) {
      console.log('\nTroubleshooting:');
      console.log('1. Check that GOOGLE_APPLICATION_CREDENTIALS_JSON is set in .env');
      console.log('2. Verify the service account has BigQuery permissions');
      console.log('3. Ensure the project ID and dataset are correct');
    }
    
    if (errorMessage.includes('not found')) {
      console.log('\nTable not found. Check:');
      console.log('1. Project ID:', bigqueryConfig.projectId);
      console.log('2. Dataset:', bigqueryConfig.dataset);  
      console.log('3. Table:', tables.sqpRaw);
    }
  }
}

testBigQueryConnection().catch(console.error);