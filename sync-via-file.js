#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { BigQuery } = require('@google-cloud/bigquery');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function syncViaFile() {
  console.log('🚀 Running sync using file-based authentication...\n');
  
  let credentialsPath = null;
  
  try {
    // Get credentials from environment
    const credsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credsEnv) {
      throw new Error('No GOOGLE_APPLICATION_CREDENTIALS_JSON found in environment');
    }
    
    console.log('1. Processing credentials...');
    
    // Create a temporary directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcp-creds-'));
    credentialsPath = path.join(tempDir, 'credentials.json');
    
    // Process the credentials
    let credsString = credsEnv;
    
    // Remove outer quotes if present
    if (credsString.startsWith("'")) {
      credsString = credsString.slice(1);
    }
    if (credsString.endsWith("'")) {
      credsString = credsString.slice(0, -1);
    }
    if (credsString.startsWith('"')) {
      credsString = credsString.slice(1);
    }
    if (credsString.endsWith('"')) {
      credsString = credsString.slice(0, -1);
    }
    
    // Try to parse and reformat
    let credentials;
    try {
      // First attempt: direct parse
      credentials = JSON.parse(credsString);
    } catch (e) {
      // Second attempt: unescape and parse
      credsString = credsString.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      try {
        credentials = JSON.parse(credsString);
      } catch (e2) {
        // Third attempt: assume it's malformed and try to extract key parts
        console.log('   Standard parsing failed, attempting extraction...');
        
        // Extract key fields using regex
        const typeMatch = credsString.match(/"type":\s*"([^"]+)"/);
        const projectMatch = credsString.match(/"project_id":\s*"([^"]+)"/);
        const privateKeyIdMatch = credsString.match(/"private_key_id":\s*"([^"]+)"/);
        const privateKeyMatch = credsString.match(/"private_key":\s*"([^"]+)"/);
        const clientEmailMatch = credsString.match(/"client_email":\s*"([^"]+)"/);
        const clientIdMatch = credsString.match(/"client_id":\s*"([^"]+)"/);
        
        if (projectMatch && clientEmailMatch) {
          credentials = {
            type: typeMatch ? typeMatch[1] : "service_account",
            project_id: projectMatch[1],
            private_key_id: privateKeyIdMatch ? privateKeyIdMatch[1] : "",
            private_key: privateKeyMatch ? privateKeyMatch[1] : "",
            client_email: clientEmailMatch[1],
            client_id: clientIdMatch ? clientIdMatch[1] : "",
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
            client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmailMatch[1])}`
          };
        } else {
          throw new Error('Could not extract required fields from credentials');
        }
      }
    }
    
    // Fix private key newlines
    if (credentials.private_key) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }
    
    // Write to file
    fs.writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
    console.log(`   ✅ Credentials written to: ${credentialsPath}`);
    
    // Set environment variable
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
    
    // Initialize BigQuery with file auth
    const projectId = process.env.BIGQUERY_PROJECT_ID || credentials.project_id;
    const dataset = (process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85').replace(/\.$/, '');
    
    console.log(`   Project: ${projectId}`);
    console.log(`   Dataset: ${dataset}`);
    console.log(`   Email: ${credentials.client_email}\n`);
    
    const bigquery = new BigQuery({
      projectId: projectId,
      keyFilename: credentialsPath
    });
    
    // Test connection
    console.log('2. Testing BigQuery connection...');
    const testQuery = `SELECT 1 as test`;
    const [testResult] = await bigquery.query({ query: testQuery });
    console.log('   ✅ Basic connection successful\n');
    
    // Get data stats
    console.log('3. Checking data availability...');
    const statsQuery = `
      SELECT 
        COUNT(*) as total_rows,
        MIN("Date") as earliest_date,
        MAX("Date") as latest_date
      FROM \`${projectId}.${dataset}.seller-search_query_performance\`
    `;
    
    const [stats] = await bigquery.query({ query: statsQuery });
    const dataStats = stats[0];
    console.log(`   Total rows: ${dataStats.total_rows}`);
    console.log(`   Date range: ${dataStats.earliest_date} to ${dataStats.latest_date}\n`);
    
    // Initialize Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Perform minimal sync
    console.log('4. Starting minimal data sync...');
    
    // Get 10 recent records
    const dataQuery = `
      SELECT 
        "Date",
        "Child ASIN",
        "Parent ASIN",
        "Search Query",
        "ASIN Impression Count",
        "ASIN Click Count",
        "ASIN Cart Add Count",
        "ASIN Purchase Count"
      FROM \`${projectId}.${dataset}.seller-search_query_performance\`
      WHERE "Parent ASIN" IS NOT NULL
      ORDER BY "Date" DESC
      LIMIT 10
    `;
    
    const [dataRows] = await bigquery.query({ query: dataQuery });
    console.log(`   Found ${dataRows.length} rows to sync\n`);
    
    // Process parent records
    const uniqueParents = new Map();
    dataRows.forEach(row => {
      const dateStr = row.Date.value ? row.Date.value.split('T')[0] : row.Date.split('T')[0];
      const asin = row['Parent ASIN'];
      const key = `${asin}_${dateStr}`;
      if (!uniqueParents.has(key)) {
        uniqueParents.set(key, { asin, date: dateStr });
      }
    });
    
    console.log(`5. Inserting ${uniqueParents.size} parent records...`);
    let parentsInserted = 0;
    
    for (const [key, record] of uniqueParents) {
      const { data: existing } = await supabase
        .from('asin_performance_data')
        .select('id')
        .eq('asin', record.asin)
        .eq('start_date', record.date)
        .eq('end_date', record.date)
        .single();
      
      if (!existing) {
        const { data, error } = await supabase
          .from('asin_performance_data')
          .insert({
            asin: record.asin,
            start_date: record.date,
            end_date: record.date
          })
          .select()
          .single();
        
        if (!error) {
          parentsInserted++;
          console.log(`   ✅ Inserted parent: ${record.asin} on ${record.date}`);
        }
      }
    }
    
    console.log(`   Total inserted: ${parentsInserted}\n`);
    
    console.log('✅ Sync test completed successfully!');
    console.log('\nTo perform a full sync, increase the LIMIT in the queries above.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Clean up
    if (credentialsPath && fs.existsSync(credentialsPath)) {
      fs.unlinkSync(credentialsPath);
      const tempDir = path.dirname(credentialsPath);
      fs.rmdirSync(tempDir);
      console.log('\n🧹 Cleaned up temporary files');
    }
  }
}

// Check required environment variables
const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'BIGQUERY_PROJECT_ID', 'BIGQUERY_DATASET'];
const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(key => console.error(`   - ${key}`));
  process.exit(1);
}

syncViaFile().catch(console.error);