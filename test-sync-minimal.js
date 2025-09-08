#!/usr/bin/env node

// Minimal sync test - check if we can connect to BigQuery and Supabase
require('dotenv').config();

const { BigQuery } = require('@google-cloud/bigquery');
const { createClient } = require('@supabase/supabase-js');

async function testMinimalSync() {
  console.log('🔍 Testing minimal sync setup...\n');
  
  try {
    // Test 1: BigQuery connection
    console.log('1. Testing BigQuery connection...');
    const projectId = process.env.BIGQUERY_PROJECT_ID || 'amazon-sp-report-loader';
    const dataset = (process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85').replace(/\.$/, '');
    
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    
    const bigquery = new BigQuery({
      projectId,
      credentials: {
        type: credentials.type,
        project_id: credentials.project_id,
        private_key_id: credentials.private_key_id,
        private_key: credentials.private_key,
        client_email: credentials.client_email,
        client_id: credentials.client_id
      }
    });
    
    const testQuery = `SELECT COUNT(*) as count FROM \`${projectId}.${dataset}.seller-search_query_performance\` LIMIT 1`;
    const [rows] = await bigquery.query({ query: testQuery });
    console.log(`   ✅ BigQuery connected! Found ${rows[0].count} total rows\n`);
    
    // Test 2: Supabase connection
    console.log('2. Testing Supabase connection...');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );
    
    const { count, error } = await supabase
      .from('asin_performance_data')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    console.log(`   ✅ Supabase connected! Found ${count} records in asin_performance_data\n`);
    
    // Test 3: Get sample data from BigQuery
    console.log('3. Getting sample data from BigQuery...');
    const sampleQuery = `
      SELECT 
        \`Date\`,
        \`ASIN\`,
        \`Parent ASIN\`,
        \`Search Query\`,
        \`ASIN Impression Count\`,
        \`ASIN Click Count\`,
        \`ASIN Purchase Count\`
      FROM \`${projectId}.${dataset}.seller-search_query_performance\`
      WHERE \`Date\` >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
      LIMIT 5
    `;
    
    const [sampleRows] = await bigquery.query({ query: sampleQuery });
    console.log(`   Found ${sampleRows.length} recent rows:`);
    sampleRows.forEach((row, i) => {
      console.log(`   ${i+1}. ASIN: ${row.ASIN || row['Parent ASIN']}, Query: "${row['Search Query']}"`);
    });
    
    console.log('\n✅ All connections successful! Ready to sync data.');
    console.log('\nTo perform the actual sync, use the sync API or script.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === 'ENOENT') {
      console.error('   Node modules might not be installed. Run: npm install');
    } else if (error.message.includes('Cannot find module')) {
      console.error('   Missing dependency. Check package.json and run: npm install');
    }
    process.exit(1);
  }
}

// Check environment
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  console.error('❌ Missing GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable');
  console.error('   Please check your .env file');
  process.exit(1);
}

testMinimalSync().catch(console.error);