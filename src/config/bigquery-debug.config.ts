import { BigQuery } from '@google-cloud/bigquery'

/**
 * Debug version of BigQuery client with extensive logging
 */
export function getDebugBigQueryClient(): BigQuery {
  console.log('=== BigQuery Client Initialization Debug ===')
  
  // Log all relevant environment variables
  console.log('Environment variables:')
  console.log(`  NODE_ENV: ${process.env.NODE_ENV}`)
  console.log(`  BIGQUERY_PROJECT_ID: ${process.env.BIGQUERY_PROJECT_ID ? 'SET' : 'NOT SET'}`)
  console.log(`  GOOGLE_APPLICATION_CREDENTIALS_JSON length: ${process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.length || 0}`)
  console.log(`  GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS || 'NOT SET'}`)
  
  const projectId = process.env.BIGQUERY_PROJECT_ID
  if (!projectId) {
    throw new Error('BIGQUERY_PROJECT_ID is required but not set')
  }
  
  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (!credsJson) {
    console.error('GOOGLE_APPLICATION_CREDENTIALS_JSON is not set!')
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON is required but not set')
  }
  
  console.log('\nParsing credentials JSON...')
  let credentials: any
  try {
    credentials = JSON.parse(credsJson)
    console.log('✅ Successfully parsed credentials JSON')
    console.log(`  Credential type: ${credentials.type}`)
    console.log(`  Project ID in creds: ${credentials.project_id}`)
    console.log(`  Client email: ${credentials.client_email}`)
    console.log(`  Has private key: ${!!credentials.private_key}`)
  } catch (error: any) {
    console.error('❌ Failed to parse credentials JSON:', error.message)
    throw error
  }
  
  // Fix private key format
  if (credentials.private_key) {
    console.log('\nProcessing private key...')
    const originalLength = credentials.private_key.length
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n')
    console.log(`  Original length: ${originalLength}`)
    console.log(`  After processing: ${credentials.private_key.length}`)
    console.log(`  Starts with BEGIN: ${credentials.private_key.startsWith('-----BEGIN')}`);
    console.log(`  Ends with END: ${credentials.private_key.includes('-----END')}`);
  }
  
  console.log('\nCreating BigQuery client with inline credentials...')
  
  try {
    const client = new BigQuery({
      projectId: credentials.project_id || projectId,
      credentials: {
        type: credentials.type,
        project_id: credentials.project_id,
        private_key_id: credentials.private_key_id,
        private_key: credentials.private_key,
        client_email: credentials.client_email,
        client_id: credentials.client_id
      },
      location: process.env.BIGQUERY_LOCATION || 'US',
      autoRetry: false,
      maxRetries: 0
    })
    
    console.log('✅ BigQuery client created successfully')
    return client
  } catch (error: any) {
    console.error('❌ Failed to create BigQuery client:', error)
    throw error
  }
}