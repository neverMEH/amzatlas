#!/usr/bin/env node
require('dotenv').config();

const { BigQuery } = require('@google-cloud/bigquery');

async function testBigQueryConnection() {
  console.log('Testing BigQuery Connection...\n');
  
  try {
    // Parse credentials from environment
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    const projectId = process.env.BIGQUERY_PROJECT_ID || 'amazon-sp-report-loader';
    const datasetId = process.env.BIGQUERY_DATASET || 'sqp_data';
    
    console.log('Project:', projectId);
    console.log('Dataset:', datasetId);
    console.log('Service Account:', credentials.client_email);
    
    // Initialize BigQuery client
    const bigquery = new BigQuery({
      projectId,
      credentials
    });
    
    // Test 1: List datasets
    console.log('\n1. Testing dataset access...');
    const [datasets] = await bigquery.getDatasets();
    console.log(`   ✓ Found ${datasets.length} datasets`);
    datasets.forEach(dataset => {
      console.log(`     - ${dataset.id}`);
    });
    
    // Test 2: Get tables in dataset
    console.log('\n2. Testing table access...');
    const dataset = bigquery.dataset(datasetId);
    const [tables] = await dataset.getTables();
    console.log(`   ✓ Found ${tables.length} tables in ${datasetId}:`);
    tables.forEach(table => {
      console.log(`     - ${table.id}`);
    });
    
    // Test 3: Get table schema
    console.log('\n3. Testing table schema...');
    const [metadata] = await bigquery.dataset(datasetId).table('seller-search_query_performance').getMetadata();
    console.log(`   ✓ Table schema fields:`);
    metadata.schema.fields.forEach(field => {
      console.log(`     - ${field.name} (${field.type})`);
    });
    
    // Test 4: Query a sample of data
    console.log('\n4. Testing query execution...');
    const query = `
      SELECT *
      FROM \`${projectId}.${datasetId}.seller-search_query_performance\`
      LIMIT 1
    `;
    
    const [rows] = await bigquery.query(query);
    console.log(`   ✓ Sample row fields:`, Object.keys(rows[0] || {}));
    
    console.log('\n✅ BigQuery connection test successful!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check that GOOGLE_APPLICATION_CREDENTIALS_JSON is set correctly');
    console.error('2. Verify the service account has BigQuery access');
    console.error('3. Ensure the dataset name is correct');
  }
}

// Run the test
testBigQueryConnection();