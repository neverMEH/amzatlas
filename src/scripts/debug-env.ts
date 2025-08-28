#!/usr/bin/env node

import { config } from 'dotenv';

// Load environment variables
const result = config();

console.log('Environment variables loaded:', result.parsed ? 'success' : 'failed');

console.log('\nChecking BigQuery-related environment variables:');
console.log('- GOOGLE_APPLICATION_CREDENTIALS_JSON exists:', !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
console.log('- GOOGLE_APPLICATION_CREDENTIALS_JSON length:', process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.length || 0);

if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  console.log('- First 100 chars:', process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON.substring(0, 100));
  
  try {
    const parsed = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    console.log('- JSON parsing: success');
    console.log('- Service account type:', parsed.type);
    console.log('- Project ID:', parsed.project_id);
    console.log('- Client email:', parsed.client_email);
  } catch (error) {
    console.log('- JSON parsing: failed -', error instanceof Error ? error.message : String(error));
  }
}

console.log('\nBigQuery config:');
console.log('- BIGQUERY_PROJECT_ID:', process.env.BIGQUERY_PROJECT_ID);
console.log('- BIGQUERY_DATASET:', process.env.BIGQUERY_DATASET);
console.log('- BIGQUERY_LOCATION:', process.env.BIGQUERY_LOCATION);