#!/usr/bin/env node

require('dotenv').config();

console.log('🔍 Checking environment variables...\n');

// Check required vars
const required = [
  'BIGQUERY_PROJECT_ID',
  'BIGQUERY_DATASET',
  'GOOGLE_APPLICATION_CREDENTIALS_JSON',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];

let allPresent = true;

required.forEach(key => {
  const value = process.env[key];
  if (value) {
    console.log(`✅ ${key}: ${value.substring(0, 50)}...`);
  } else {
    console.log(`❌ ${key}: NOT SET`);
    allPresent = false;
  }
});

// Try to parse BigQuery credentials
console.log('\n🔍 Testing BigQuery credentials JSON...');
try {
  const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (creds) {
    // Check if it starts with a quote that needs to be removed
    let credsToParse = creds;
    if (creds.startsWith("'") && creds.endsWith("'")) {
      credsToParse = creds.slice(1, -1);
    }
    
    const parsed = JSON.parse(credsToParse);
    console.log('✅ JSON is valid');
    console.log(`   Type: ${parsed.type}`);
    console.log(`   Project ID: ${parsed.project_id}`);
    console.log(`   Client Email: ${parsed.client_email}`);
    console.log(`   Private Key: ${parsed.private_key ? 'Present' : 'Missing'}`);
  }
} catch (error) {
  console.log('❌ JSON parsing failed:', error.message);
  console.log('   First 100 chars:', process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.substring(0, 100));
}

console.log('\n' + (allPresent ? '✅ All required variables are set!' : '❌ Some variables are missing!'));