#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { BigQuery } = require('@google-cloud/bigquery');
require('dotenv').config();

async function checkColumns() {
  console.log('🔍 Checking BigQuery table columns...\n');
  
  let credentialsPath = null;
  
  try {
    // Get credentials from environment
    const credsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credsEnv) {
      throw new Error('No GOOGLE_APPLICATION_CREDENTIALS_JSON found in environment');
    }
    
    // Create a temporary directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcp-creds-'));
    credentialsPath = path.join(tempDir, 'credentials.json');
    
    // Process the credentials
    let credsString = credsEnv;
    
    // Remove outer quotes if present
    if (credsString.startsWith("'")) credsString = credsString.slice(1);
    if (credsString.endsWith("'")) credsString = credsString.slice(0, -1);
    
    // Try to parse
    let credentials;
    try {
      credentials = JSON.parse(credsString);
    } catch (e) {
      credsString = credsString.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      credentials = JSON.parse(credsString);
    }
    
    // Fix private key newlines
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    
    // Write to file
    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
    
    // Set environment variable
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
    
    // Initialize BigQuery
    const projectId = process.env.BIGQUERY_PROJECT_ID || credentials.project_id;
    const dataset = (process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85').replace(/\.$/, '');
    
    console.log(`Project: ${projectId}`);
    console.log(`Dataset: ${dataset}`);
    console.log(`Table: seller-search_query_performance\n`);
    
    const bigquery = new BigQuery({
      projectId: projectId,
      keyFilename: credentialsPath
    });
    
    // Get column names
    console.log('1. Getting column names...');
    const query = `
      SELECT * 
      FROM \`${projectId}.${dataset}.seller-search_query_performance\`
      LIMIT 1
    `;
    
    const [rows] = await bigquery.query({ query });
    
    if (rows.length > 0) {
      const columns = Object.keys(rows[0]);
      console.log(`\nFound ${columns.length} columns:\n`);
      
      columns.forEach((col, index) => {
        console.log(`${index + 1}. "${col}"`);
      });
      
      // Check specific columns
      console.log('\n2. Checking for ASIN-related columns:');
      const asinColumns = columns.filter(col => col.toUpperCase().includes('ASIN'));
      asinColumns.forEach(col => console.log(`   - "${col}"`));
      
      console.log('\n3. Testing queries with different column formats:');
      
      // Test different ways to reference columns
      const tests = [
        { name: 'Backticks with ASIN', query: `SELECT \`ASIN\` FROM \`${projectId}.${dataset}.seller-search_query_performance\` LIMIT 1` },
        { name: 'No backticks', query: `SELECT ASIN FROM \`${projectId}.${dataset}.seller-search_query_performance\` LIMIT 1` },
        { name: 'Double quotes', query: `SELECT "ASIN" FROM \`${projectId}.${dataset}.seller-search_query_performance\` LIMIT 1` }
      ];
      
      // If we have actual column names, test them
      const actualAsinCol = columns.find(col => col === 'ASIN' || col === 'Asin' || col === 'asin');
      if (actualAsinCol) {
        tests.push({
          name: `Exact match "${actualAsinCol}"`,
          query: `SELECT \`${actualAsinCol}\` FROM \`${projectId}.${dataset}.seller-search_query_performance\` LIMIT 1`
        });
      }
      
      for (const test of tests) {
        try {
          console.log(`\n   Testing: ${test.name}`);
          console.log(`   Query: ${test.query}`);
          const [result] = await bigquery.query({ query: test.query });
          console.log(`   ✅ Success! Got ${result.length} rows`);
        } catch (error) {
          console.log(`   ❌ Failed: ${error.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Clean up
    if (credentialsPath && fs.existsSync(credentialsPath)) {
      fs.unlinkSync(credentialsPath);
      const tempDir = path.dirname(credentialsPath);
      fs.rmdirSync(tempDir);
    }
  }
}

checkColumns().catch(console.error);