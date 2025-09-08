import { BigQuery } from '@google-cloud/bigquery'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

let bigQueryClient: BigQuery | null = null

/**
 * Production-ready BigQuery client with multiple authentication strategies
 */
export function getProductionBigQueryClient(): BigQuery {
  if (!bigQueryClient) {
    const projectId = process.env.BIGQUERY_PROJECT_ID
    
    if (!projectId) {
      throw new Error('BIGQUERY_PROJECT_ID environment variable is required')
    }
    
    // Try multiple authentication strategies in order
    const strategies = [
      tryInlineCredentials,
      tryCredentialsFile,
      tryEnvironmentVariable,
      tryDefaultAuth
    ]
    
    let lastError: Error | null = null
    
    for (const strategy of strategies) {
      try {
        bigQueryClient = strategy(projectId)
        if (bigQueryClient) {
          console.log(`BigQuery client created successfully using ${strategy.name}`)
          return bigQueryClient
        }
      } catch (error: any) {
        console.error(`${strategy.name} failed:`, error.message)
        lastError = error
      }
    }
    
    throw new Error(`All BigQuery authentication strategies failed. Last error: ${lastError?.message}`)
  }
  
  return bigQueryClient
}

/**
 * Strategy 1: Try inline credentials from environment variable
 */
function tryInlineCredentials(projectId: string): BigQuery | null {
  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (!credsJson) {
    return null
  }
  
  console.log('Attempting authentication with inline credentials...')
  
  // Parse credentials
  const credentials = JSON.parse(credsJson)
  
  // Validate required fields
  const requiredFields = ['type', 'project_id', 'private_key', 'client_email']
  for (const field of requiredFields) {
    if (!credentials[field]) {
      throw new Error(`Missing required field: ${field}`)
    }
  }
  
  // Fix private key format
  let privateKey = credentials.private_key
  
  // Convert escaped newlines to actual newlines
  privateKey = privateKey.replace(/\\n/g, '\n')
  
  // Ensure proper PEM format
  if (!privateKey.startsWith('-----BEGIN')) {
    throw new Error('Invalid private key format: missing BEGIN marker')
  }
  
  if (!privateKey.endsWith('-----\n') && !privateKey.endsWith('-----')) {
    privateKey = privateKey.trimEnd() + '\n'
  }
  
  credentials.private_key = privateKey
  
  return new BigQuery({
    projectId: credentials.project_id || projectId,
    credentials: {
      type: credentials.type,
      project_id: credentials.project_id,
      private_key_id: credentials.private_key_id,
      private_key: credentials.private_key,
      client_email: credentials.client_email,
      client_id: credentials.client_id
    },
    location: process.env.BIGQUERY_LOCATION || 'US'
  })
}

/**
 * Strategy 2: Write credentials to a temporary file
 */
function tryCredentialsFile(projectId: string): BigQuery | null {
  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (!credsJson) {
    return null
  }
  
  console.log('Attempting authentication with temporary credentials file...')
  
  // Parse and fix credentials
  const credentials = JSON.parse(credsJson)
  
  // Fix private key format
  if (credentials.private_key) {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n')
  }
  
  // Write to temporary file
  const tempDir = os.tmpdir()
  const tempFile = path.join(tempDir, `bq-creds-${process.pid}.json`)
  
  fs.writeFileSync(tempFile, JSON.stringify(credentials, null, 2), 'utf8')
  
  // Create client with keyFilename
  const client = new BigQuery({
    projectId: credentials.project_id || projectId,
    keyFilename: tempFile,
    location: process.env.BIGQUERY_LOCATION || 'US'
  })
  
  // Schedule cleanup
  process.on('exit', () => {
    try {
      fs.unlinkSync(tempFile)
    } catch (e) {
      // Ignore cleanup errors
    }
  })
  
  return client
}

/**
 * Strategy 3: Use GOOGLE_APPLICATION_CREDENTIALS environment variable
 */
function tryEnvironmentVariable(projectId: string): BigQuery | null {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credPath) {
    return null
  }
  
  console.log('Attempting authentication with GOOGLE_APPLICATION_CREDENTIALS file...')
  
  if (!fs.existsSync(credPath)) {
    throw new Error(`Credentials file not found: ${credPath}`)
  }
  
  return new BigQuery({
    projectId: projectId,
    keyFilename: credPath,
    location: process.env.BIGQUERY_LOCATION || 'US'
  })
}

/**
 * Strategy 4: Use default application credentials (for local dev)
 */
function tryDefaultAuth(projectId: string): BigQuery | null {
  console.log('Attempting authentication with default application credentials...')
  
  return new BigQuery({
    projectId: projectId,
    location: process.env.BIGQUERY_LOCATION || 'US'
  })
}

/**
 * Test the BigQuery connection
 */
export async function testProductionBigQueryConnection(): Promise<boolean> {
  try {
    const client = getProductionBigQueryClient()
    
    // Simple test query
    const query = `SELECT 1 as test_value`
    const [rows] = await client.query({ query })
    
    if (rows && rows.length > 0 && rows[0].test_value === 1) {
      console.log('✅ BigQuery connection test successful')
      return true
    } else {
      console.error('❌ BigQuery test query returned unexpected result')
      return false
    }
  } catch (error: any) {
    console.error('❌ BigQuery connection test failed:', error.message)
    return false
  }
}