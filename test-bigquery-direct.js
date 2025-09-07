const { BigQuery } = require('@google-cloud/bigquery');

// Load environment variables
require('dotenv').config();

async function testBigQuery() {
  console.log('Testing BigQuery connection...');
  
  try {
    // Parse credentials
    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credsJson) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON not found in environment');
    }
    
    const credentials = JSON.parse(credsJson);
    const projectId = process.env.BIGQUERY_PROJECT_ID || 'amazon-sp-report-loader';
    const location = process.env.BIGQUERY_LOCATION || 'US';
    
    console.log('Project ID:', projectId);
    console.log('Location:', location);
    console.log('Service Account:', credentials.client_email);
    
    // Initialize BigQuery client
    const bigquery = new BigQuery({
      projectId: projectId,
      credentials: credentials,
      location: location
    });
    
    // Test query
    const query = `
      SELECT COUNT(*) as count
      FROM \`${projectId}.dataclient_amzatlas_agency_85.\`seller-search_query_performance\`\`
      LIMIT 1
    `;
    
    console.log('\nExecuting test query...');
    const [rows] = await bigquery.query({
      query: query,
      location: location
    });
    
    console.log('Query successful! Row count:', rows[0].count);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.errors) {
      console.error('Detailed errors:', error.errors);
    }
  }
}

testBigQuery();