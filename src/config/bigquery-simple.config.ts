import { BigQuery } from '@google-cloud/bigquery'

let bigQueryClient: BigQuery | null = null

export function getSimpleBigQueryClient(): BigQuery {
  if (!bigQueryClient) {
    const projectId = process.env.BIGQUERY_PROJECT_ID
    
    if (!projectId) {
      throw new Error('BIGQUERY_PROJECT_ID environment variable is required')
    }
    
    // Option 1: If GOOGLE_APPLICATION_CREDENTIALS_JSON is set, use it directly
    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    if (credsJson) {
      try {
        // Parse and validate the JSON
        const credentials = JSON.parse(credsJson)
        
        // Ensure the credentials have all required fields
        if (!credentials.private_key) {
          throw new Error('Missing private_key in credentials')
        }
        
        // Fix private key format if needed
        let privateKey = credentials.private_key
        if (!privateKey.includes('\n')) {
          // Replace escaped newlines with actual newlines
          privateKey = privateKey.replace(/\\n/g, '\n')
          credentials.private_key = privateKey
        }
        
        // Create BigQuery client with inline credentials
        // Important: Only include the fields that BigQuery expects
        bigQueryClient = new BigQuery({
          projectId: credentials.project_id || projectId,
          credentials: {
            type: credentials.type,
            project_id: credentials.project_id,
            private_key_id: credentials.private_key_id,
            private_key: credentials.private_key,
            client_email: credentials.client_email,
            client_id: credentials.client_id,
            // Note: auth_uri, token_uri, and other fields are not needed by the BigQuery client
          },
          location: process.env.BIGQUERY_LOCATION || 'US',
          // Disable auto-retry to see actual errors
          autoRetry: false,
          maxRetries: 0
        })
        
        console.log('BigQuery client created with inline credentials')
      } catch (error: any) {
        console.error('Failed to create BigQuery client with credentials:', error.message)
        
        // Don't fallback - throw the error so we can fix it
        throw new Error(`BigQuery authentication failed: ${error.message}`)
      }
    } else {
      // Option 2: Use default credentials (only for local development)
      console.log('No GOOGLE_APPLICATION_CREDENTIALS_JSON found, using default auth')
      
      bigQueryClient = new BigQuery({
        projectId: projectId,
        location: process.env.BIGQUERY_LOCATION || 'US'
      })
    }
  }
  
  return bigQueryClient
}

// Test function to verify connection
export async function testSimpleBigQueryConnection(): Promise<boolean> {
  try {
    const client = getSimpleBigQueryClient()
    
    // Try a simple query to test the connection
    const query = `SELECT 1 as test`
    const [rows] = await client.query({ query })
    
    console.log('BigQuery connection test successful:', rows)
    return true
  } catch (error) {
    console.error('BigQuery connection test failed:', error)
    return false
  }
}