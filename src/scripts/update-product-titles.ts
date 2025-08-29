#!/usr/bin/env node

import { config } from 'dotenv';
import { getBigQueryConfig, getTableNames } from '../config/bigquery.config';
import { BigQuery } from '@google-cloud/bigquery';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

async function updateProductTitles() {
  console.log('Starting product title update...\n');

  // Initialize BigQuery
  const bigqueryConfig = getBigQueryConfig();
  const tables = getTableNames();
  
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  let credentials;
  if (credentialsJson) {
    try {
      credentials = JSON.parse(credentialsJson);
    } catch (error) {
      console.error('Failed to parse Google credentials:', error);
      return;
    }
  }

  const bigquery = new BigQuery({
    projectId: bigqueryConfig.projectId,
    credentials: credentials,
  });

  // Initialize Supabase
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get ASINs that need product titles
  console.log('Finding ASINs without product titles...');
  const { data: asinsWithoutTitles, error: asinError } = await supabase
    .from('asin_performance_data')
    .select('asin')
    .is('product_title', null)
    .limit(1000);

  if (asinError) {
    console.error('Error fetching ASINs:', asinError);
    return;
  }

  const uniqueAsins = [...new Set(asinsWithoutTitles?.map(r => r.asin) || [])];
  console.log(`Found ${uniqueAsins.length} unique ASINs without product titles`);

  if (uniqueAsins.length === 0) {
    console.log('All ASINs already have product titles!');
    return;
  }

  // Query BigQuery for product titles
  const asinList = uniqueAsins.map(asin => `'${asin}'`).join(',');
  const query = `
    SELECT DISTINCT
      \`Child ASIN\` as asin,
      \`Product Name\` as productName,
      \`Client Name\` as clientName
    FROM \`${bigqueryConfig.projectId}.${bigqueryConfig.dataset}.${tables.sqpRaw}\`
    WHERE \`Child ASIN\` IN (${asinList})
    AND \`Product Name\` IS NOT NULL
  `;

  console.log(`\nQuerying BigQuery for product information...`);
  const [job] = await bigquery.createQueryJob({ query });
  const [rows] = await job.getQueryResults();

  console.log(`Found product information for ${rows.length} ASINs`);

  // Update Supabase records
  let updatedCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    const { error } = await supabase
      .from('asin_performance_data')
      .update({ product_title: row.productName })
      .eq('asin', row.asin)
      .is('product_title', null); // Only update if currently null

    if (error) {
      console.error(`Error updating ASIN ${row.asin}:`, error.message);
      errorCount++;
    } else {
      updatedCount++;
      if (updatedCount % 10 === 0) {
        console.log(`Progress: ${updatedCount}/${rows.length} ASINs updated`);
      }
    }
  }

  console.log('\n=== UPDATE COMPLETE ===');
  console.log(`Successfully updated: ${updatedCount} ASINs`);
  console.log(`Errors: ${errorCount}`);

  // Verify results
  const { count } = await supabase
    .from('asin_performance_data')
    .select('*', { count: 'exact', head: true })
    .not('product_title', 'is', null);

  console.log(`\nTotal ASINs with product titles: ${count}`);
}

updateProductTitles().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});