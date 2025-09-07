const { BigQuery } = require('@google-cloud/bigquery');

// Load environment variables
require('dotenv').config();

async function listDatasets() {
  console.log('Listing BigQuery datasets...');
  
  try {
    // Parse credentials
    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    const credentials = JSON.parse(credsJson);
    const projectId = process.env.BIGQUERY_PROJECT_ID || 'amazon-sp-report-loader';
    
    // Initialize BigQuery client
    const bigquery = new BigQuery({
      projectId: projectId,
      credentials: credentials
    });
    
    // List all datasets
    const [datasets] = await bigquery.getDatasets();
    
    console.log('\nAvailable datasets:');
    for (const dataset of datasets) {
      console.log(`- ${dataset.id} (location: ${dataset.metadata?.location || 'unknown'})`);
      
      // List tables in each dataset
      const [tables] = await dataset.getTables();
      if (tables.length > 0) {
        console.log('  Tables:');
        for (const table of tables.slice(0, 5)) {
          console.log(`    - ${table.id}`);
        }
        if (tables.length > 5) {
          console.log(`    ... and ${tables.length - 5} more tables`);
        }
      } else {
        console.log('  (No tables)');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

listDatasets();