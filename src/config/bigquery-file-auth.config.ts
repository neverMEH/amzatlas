import { BigQuery } from '@google-cloud/bigquery'
import * as fs from 'fs'
import * as path from 'path'

let bigQueryClient: BigQuery | null = null
let credentialsFilePath: string | null = null

/**
 * BigQuery client that writes credentials to a file for authentication
 * This approach often works better in containerized environments
 */
export function getFileBigQueryClient(): BigQuery {
  if (!bigQueryClient) {
    console.log('Initializing BigQuery client with file-based auth...')
    
    const projectId = process.env.BIGQUERY_PROJECT_ID
    if (!projectId) {
      throw new Error('BIGQUERY_PROJECT_ID is required')
    }
    
    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    if (!credsJson) {
      console.log('No GOOGLE_APPLICATION_CREDENTIALS_JSON found, using default auth')
      bigQueryClient = new BigQuery({
        projectId: projectId,
        location: process.env.BIGQUERY_LOCATION || 'US'
      })
      return bigQueryClient
    }
    
    try {
      // Parse and validate credentials
      const credentials = JSON.parse(credsJson)
      
      // Fix private key format
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n')
      }
      
      // Write credentials to a file
      const tempDir = process.env.TEMP || process.env.TMP || '/tmp'
      credentialsFilePath = path.join(tempDir, `gcp-creds-${process.pid}.json`)
      
      console.log(`Writing credentials to: ${credentialsFilePath}`)
      fs.writeFileSync(credentialsFilePath, JSON.stringify(credentials, null, 2), 'utf8')
      
      // Set the environment variable
      process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsFilePath
      
      // Create client using the file
      bigQueryClient = new BigQuery({
        projectId: credentials.project_id || projectId,
        keyFilename: credentialsFilePath,
        location: process.env.BIGQUERY_LOCATION || 'US'
      })
      
      console.log('BigQuery client created with file-based auth')
      
      // Clean up on exit
      process.on('exit', cleanupCredentialsFile)
      process.on('SIGINT', cleanupCredentialsFile)
      process.on('SIGTERM', cleanupCredentialsFile)
      
    } catch (error: any) {
      console.error('Failed to create file-based BigQuery client:', error.message)
      throw error
    }
  }
  
  return bigQueryClient
}

function cleanupCredentialsFile() {
  if (credentialsFilePath && fs.existsSync(credentialsFilePath)) {
    try {
      fs.unlinkSync(credentialsFilePath)
      console.log('Cleaned up credentials file')
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

export async function testFileBigQueryConnection(): Promise<boolean> {
  try {
    const client = getFileBigQueryClient()
    const query = `SELECT 1 as test_value`
    const [rows] = await client.query({ query })
    return rows && rows.length > 0 && rows[0].test_value === 1
  } catch (error) {
    console.error('BigQuery connection test failed:', error)
    return false
  }
}