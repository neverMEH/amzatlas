import { BigQuery } from '@google-cloud/bigquery'
import { getBigQueryConfig } from '@/config/bigquery.config'

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
        config.credentials.private_key = config.credentials.private_key
          .replace(/\\n/g, '\n')
          .replace(/\\\\n/g, '\n')
          
        // Ensure proper formatting
        if (!config.credentials.private_key.includes('\n')) {
          // If no newlines found, it might be a single-line key that needs formatting
          const key = config.credentials.private_key
          const keyMatch = key.match(/-----BEGIN PRIVATE KEY-----(.*?)-----END PRIVATE KEY-----/)
          if (keyMatch) {
            const keyContent = keyMatch[1].trim()
            // Add newlines every 64 characters (standard PEM format)
            const formattedKey = keyContent.match(/.{1,64}/g)?.join('\n') || keyContent
            config.credentials.private_key = `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----\n`
          }
        }
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