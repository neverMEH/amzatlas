import { BigQuery } from '@google-cloud/bigquery'
import { getBigQueryConfig } from '@/config/bigquery.config'
import * as crypto from 'crypto'

let bigQueryClient: BigQuery | null = null

export function getBigQueryClient(): BigQuery {
  if (!bigQueryClient) {
    const config = getBigQueryConfig()
    
    // If credentials are provided in the config, use them
    if (config.credentials) {
      // Fix common issues with private key format
      if (config.credentials.private_key) {
        // Ensure the private key has proper line breaks
        // Sometimes the key comes with literal \n that need to be converted to actual newlines
        let privateKey = config.credentials.private_key
          .replace(/\\n/g, '\n')
          .replace(/\\\\n/g, '\n')
          
        // Ensure proper formatting
        if (!privateKey.includes('\n') || privateKey.split('\n').length < 3) {
          // If no newlines found or not enough lines, it might be a single-line key that needs formatting
          const keyMatch = privateKey.match(/-----BEGIN PRIVATE KEY-----(.*?)-----END PRIVATE KEY-----/)
          if (keyMatch) {
            const keyContent = keyMatch[1].trim().replace(/\s+/g, '')
            // Add newlines every 64 characters (standard PEM format)
            const formattedKey = keyContent.match(/.{1,64}/g)?.join('\n') || keyContent
            privateKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----\n`
          }
        }
        
        // Ensure the key ends with a newline
        if (!privateKey.endsWith('\n')) {
          privateKey += '\n'
        }
        
        // Test the key format
        try {
          // Try to create a sign object to validate the key format
          crypto.createSign('SHA256').update('test').sign(privateKey)
        } catch (error: any) {
          console.error('Private key validation failed:', error.message)
          // If the key is invalid, try to fix common issues
          if (error.code === 'ERR_OSSL_UNSUPPORTED') {
            // This might be a PKCS#1 key that needs to be converted to PKCS#8
            console.log('Attempting to handle key format issue...')
            // For now, we'll pass it through as-is and let the BigQuery client handle it
          }
        }
        
        config.credentials.private_key = privateKey
      }
      
      bigQueryClient = new BigQuery({
        projectId: config.projectId,
        credentials: config.credentials,
        location: config.location,
      })
    } else {
      // Fall back to default application credentials
      bigQueryClient = new BigQuery({
        projectId: config.projectId,
        location: config.location,
      })
    }
  }
  
  return bigQueryClient
}

export async function testBigQueryConnection(): Promise<boolean> {
  try {
    const client = getBigQueryClient()
    const [datasets] = await client.getDatasets({ maxResults: 1 })
    console.log('BigQuery connection successful')
    return true
  } catch (error) {
    console.error('BigQuery connection failed:', error)
    return false
  }
}