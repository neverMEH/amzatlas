#!/usr/bin/env node

import { config } from 'dotenv';
import { getBigQueryConfig, getTableNames } from '../config/bigquery.config';

// Load environment variables
config();

console.log('Testing BigQuery config parsing...\n');

try {
  const bigqueryConfig = getBigQueryConfig();
  const tables = getTableNames();

  console.log('BigQuery Config Details:');
  console.log('- Project ID:', bigqueryConfig.projectId);
  console.log('- Dataset:', bigqueryConfig.dataset);
  console.log('- Location:', bigqueryConfig.location);
  console.log('- Has credentials:', !!bigqueryConfig.credentials);
  
  if (bigqueryConfig.credentials) {
    const creds = bigqueryConfig.credentials as any;
    console.log('- Credentials type:', creds.type);
    console.log('- Credentials project_id:', creds.project_id);
    console.log('- Credentials client_email:', creds.client_email);
  }

  console.log('\nTable Names:');
  console.log('- sqpRaw:', tables.sqpRaw);
  console.log('- sqpProcessed:', tables.sqpProcessed);
  console.log('- sqpMetrics:', tables.sqpMetrics);

  console.log('\nFull table path:');
  console.log(`\`${bigqueryConfig.projectId}.${bigqueryConfig.dataset}.${tables.sqpRaw}\``);

} catch (error) {
  console.error('Error parsing BigQuery config:', error);
}