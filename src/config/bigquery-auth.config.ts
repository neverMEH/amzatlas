import { BigQuery } from '@google-cloud/bigquery'
import { getBigQueryConfig } from './bigquery.config'
import * as fs from 'fs'
import * as path from 'path'

let bigQueryClient: BigQuery | null = null

export function getBigQueryClientWithAuth(): BigQuery {
  if (!bigQueryClient) {
    const config = getBigQueryConfig()
    
    try {
      // Option 1: Try using credentials from config
      if (config.credentials && config.credentials.private_key) {
        console.log('Attempting to use inline credentials...')
        
        bigQueryClient = new BigQuery({
          projectId: config.projectId,
          credentials: config.credentials,
          location: config.location,
        })
      } 
      // Option 2: Try using a temporary credentials file
      else if (config.credentials) {
        console.log('Creating temporary credentials file...')
        
        // Create a temporary file for credentials
        const tempDir = process.env.TMPDIR || '/tmp'
        const tempFile = path.join(tempDir, 'bigquery-creds.json')
        
        // Write credentials to temp file
        fs.writeFileSync(tempFile, JSON.stringify(config.credentials, null, 2))
        
        // Set the environment variable to point to the temp file
        process.env.GOOGLE_APPLICATION_CREDENTIALS = tempFile
        
        bigQueryClient = new BigQuery({
          projectId: config.projectId,
          location: config.location,
          keyFilename: tempFile
        })
        
        // Clean up the temp file after a delay
        setTimeout(() => {
          try {
            fs.unlinkSync(tempFile)
          } catch (e) {
            // Ignore cleanup errors
          }
        }, 5000)
      }
      // Option 3: Use default application credentials
      else {
        console.log('Using default application credentials...')
        
        bigQueryClient = new BigQuery({
          projectId: config.projectId,
          location: config.location,
        })
      }
    } catch (error) {
      console.error('Failed to initialize BigQuery client:', error)
      
      // Fallback: Try without credentials and hope for implicit auth
      console.log('Falling back to implicit authentication...')
      bigQueryClient = new BigQuery({
        projectId: config.projectId,
        location: config.location,
      })
    }
  }
  
  return bigQueryClient
}

// Export as the default client getter
export { getBigQueryClientWithAuth as getBigQueryClient }