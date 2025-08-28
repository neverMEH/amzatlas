#!/usr/bin/env node

import { config } from 'dotenv';

// Load environment variables
config();

console.log('Testing credential parsing...\n');

const getCredentials = () => {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  console.log('Environment variable exists:', !!credentialsJson);
  console.log('Environment variable length:', credentialsJson?.length || 0);
  
  if (!credentialsJson) {
    console.log('❌ No credentials JSON found');
    return null;
  }
  
  console.log('✅ Credentials JSON found, attempting to parse...');
  
  try {
    const parsed = JSON.parse(credentialsJson);
    console.log('✅ JSON parsing successful');
    console.log('Parsed credential properties:');
    console.log('- type:', parsed.type);
    console.log('- project_id:', parsed.project_id);
    console.log('- client_email:', parsed.client_email);
    return parsed;
  } catch (error) {
    console.error('❌ JSON parsing failed:', error.message);
    return null;
  }
};

const credentials = getCredentials();
console.log('\nFinal result:', !!credentials ? 'SUCCESS' : 'FAILED');