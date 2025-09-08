#!/usr/bin/env npx tsx
import { getProductionBigQueryClient, testProductionBigQueryConnection } from '../config/bigquery-production.config'
import { getSimpleBigQueryClient } from '../config/bigquery-simple.config'
import { BigQuery } from '@google-cloud/bigquery'

async function diagnoseBigQueryAuth() {
  console.log('🔍 Diagnosing BigQuery Authentication Issues\n')
  
  // Check environment variables
  console.log('Environment Variables:')
  console.log('='.repeat(50))
  console.log(`BIGQUERY_PROJECT_ID: ${process.env.BIGQUERY_PROJECT_ID ? '✅ Set' : '❌ Missing'}`)
  console.log(`BIGQUERY_LOCATION: ${process.env.BIGQUERY_LOCATION || 'US (default)'}`)
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`)
  console.log(`GOOGLE_APPLICATION_CREDENTIALS_JSON: ${
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON 
      ? `✅ Set (${process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON.length} chars)` 
      : '❌ Missing'
  }`)
  console.log(`GOOGLE_APPLICATION_CREDENTIALS: ${
    process.env.GOOGLE_APPLICATION_CREDENTIALS ? '✅ Set' : '❌ Not set'
  }\n`)
  
  // Check credentials format
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    console.log('Credentials Validation:')
    console.log('='.repeat(50))
    
    try {
      const creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
      console.log(`✅ Valid JSON`)
      console.log(`  Type: ${creds.type}`)
      console.log(`  Project ID: ${creds.project_id}`)
      console.log(`  Client Email: ${creds.client_email}`)
      console.log(`  Private Key: ${creds.private_key ? '✅ Present' : '❌ Missing'}`)
      
      if (creds.private_key) {
        const keyLines = creds.private_key.split(/\\n|\n/)
        console.log(`  Key Lines: ${keyLines.length}`)
        console.log(`  Has BEGIN: ${creds.private_key.includes('BEGIN') ? '✅' : '❌'}`)
        console.log(`  Has END: ${creds.private_key.includes('END') ? '✅' : '❌'}`)
      }
    } catch (error: any) {
      console.log(`❌ Invalid JSON: ${error.message}`)
    }
    console.log()
  }
  
  // Test different authentication methods
  console.log('Testing Authentication Methods:')
  console.log('='.repeat(50))
  
  // Test 1: Production client
  console.log('\n1. Testing Production Client...')
  try {
    const connected = await testProductionBigQueryConnection()
    if (connected) {
      console.log('✅ Production client authentication successful!')
      
      // Try a real query
      const client = getProductionBigQueryClient()
      const [datasets] = await client.getDatasets({ maxResults: 3 })
      console.log(`   Found ${datasets.length} datasets`)
    } else {
      console.log('❌ Production client authentication failed')
    }
  } catch (error: any) {
    console.log(`❌ Production client error: ${error.message}`)
  }
  
  // Test 2: Simple client
  console.log('\n2. Testing Simple Client...')
  try {
    const client = getSimpleBigQueryClient()
    const [datasets] = await client.getDatasets({ maxResults: 1 })
    console.log('✅ Simple client authentication successful!')
  } catch (error: any) {
    console.log(`❌ Simple client error: ${error.message}`)
  }
  
  // Test 3: Direct BigQuery client
  console.log('\n3. Testing Direct Client...')
  try {
    const projectId = process.env.BIGQUERY_PROJECT_ID
    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    
    if (projectId && credsJson) {
      const creds = JSON.parse(credsJson)
      
      // Fix private key
      if (creds.private_key) {
        creds.private_key = creds.private_key.replace(/\\n/g, '\n')
      }
      
      const client = new BigQuery({
        projectId: projectId,
        credentials: creds,
        location: 'US'
      })
      
      const query = `SELECT 1 as test`
      const [rows] = await client.query({ query })
      console.log('✅ Direct client authentication successful!')
    } else {
      console.log('⚠️  Missing required environment variables')
    }
  } catch (error: any) {
    console.log(`❌ Direct client error: ${error.message}`)
    console.log(`   Error details: ${JSON.stringify(error, null, 2)}`)
  }
  
  // Provide recommendations
  console.log('\n\nRecommendations:')
  console.log('='.repeat(50))
  
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    console.log('1. Set GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable')
    console.log('   Example: GOOGLE_APPLICATION_CREDENTIALS_JSON=\'{"type":"service_account",...}\'')
  }
  
  if (!process.env.BIGQUERY_PROJECT_ID) {
    console.log('2. Set BIGQUERY_PROJECT_ID environment variable')
  }
  
  console.log('\nIf authentication still fails:')
  console.log('- Ensure the service account has BigQuery Data Viewer and Job User roles')
  console.log('- Check that the project ID matches the service account\'s project')
  console.log('- Verify the private key is properly formatted (PEM format)')
  console.log('- Try regenerating the service account key if needed')
}

diagnoseBigQueryAuth().catch(console.error)