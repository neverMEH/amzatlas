import { BigQuery } from '@google-cloud/bigquery'

let bigQueryClient: BigQuery | null = null

export function getSimpleBigQueryClient(): BigQuery {
  if (!bigQueryClient) {
    const projectId = process.env.BIGQUERY_PROJECT_ID
    
    if (!projectId) {
      throw new Error('BIGQUERY_PROJECT_ID environment variable is required')
    }
    
    // Option 1: If GOOGLE_APPLICATION_CREDENTIALS_JSON is set, write it to a file
    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    if (credsJson) {
      try {
        // Parse and validate the JSON
        const credentials = JSON.parse(credsJson)
        
        // Create BigQuery client with inline credentials
        bigQueryClient = new BigQuery({
          projectId: credentials.project_id || projectId,
          credentials: credentials,
          location: process.env.BIGQUERY_LOCATION || 'US'
        })
        
        console.log('BigQuery client created with inline credentials')
      } catch (error) {
        console.error('Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', error)
        
        // Fallback to default credentials
        bigQueryClient = new BigQuery({
          projectId: projectId,
          location: process.env.BIGQUERY_LOCATION || 'US'
        })
        
        console.log('BigQuery client created with default credentials (fallback)')
      }
    } else {
      // Option 2: Use default credentials (GOOGLE_APPLICATION_CREDENTIALS file or ADC)
      bigQueryClient = new BigQuery({
        projectId: projectId,
        location: process.env.BIGQUERY_LOCATION || 'US'
      })
      
      console.log('BigQuery client created with default credentials')
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