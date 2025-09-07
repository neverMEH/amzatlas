export interface BigQueryConfig {
  projectId: string
  datasets: {
    production: string
    development?: string
    staging?: string
  }
  credentials?: any
  location: string
}

export const getBigQueryConfig = (): BigQueryConfig => {
  // Check if we're in a build environment
  const isBuildTime = typeof window === 'undefined' && 
                     !process.env.RAILWAY_ENVIRONMENT &&
                     !process.env.VERCEL &&
                     process.env.NODE_ENV === 'production'

  // During build time, return dummy values
  if (isBuildTime) {
    console.log('Build time detected, using placeholder BigQuery config')
    return {
      projectId: 'placeholder-project',
      datasets: {
        production: 'placeholder_dataset'
      },
      location: 'US'
    }
  }

  // Parse credentials from environment variable
  let credentials
  try {
    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    if (credsJson) {
      // Clean up common issues with JSON credentials
      const cleanedJson = credsJson
        .trim() // Remove leading/trailing whitespace
        .replace(/[\r\n\t]/g, '') // Remove actual newlines/tabs that might have been pasted
        .replace(/\\n/g, '\\n') // Ensure newlines in private key are properly escaped
      
      credentials = JSON.parse(cleanedJson)
      
      // Log success (without sensitive data)
      console.log('BigQuery credentials parsed successfully', {
        type: credentials.type,
        project_id: credentials.project_id,
        client_email: credentials.client_email
      })
    }
  } catch (error) {
    console.error('Failed to parse BigQuery credentials:', error)
    // Log the position where parsing failed for debugging
    if (error instanceof SyntaxError && error.message.includes('position')) {
      const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || ''
      console.error('Error position context:', credsJson.substring(150, 180))
    }
  }

  return {
    projectId: process.env.BIGQUERY_PROJECT_ID || 'amzatlas-2024',
    datasets: {
      production: process.env.BIGQUERY_DATASET || 'dataclient_amzatlas_agency_85',
      development: process.env.BIGQUERY_DATASET_DEV || 'sqp_data_dev',
      staging: process.env.BIGQUERY_DATASET_STAGING || 'sqp_data_staging'
    },
    credentials,
    location: process.env.BIGQUERY_LOCATION || 'US'
  }
}

// Validate BigQuery configuration
export const validateBigQueryConfig = (config: BigQueryConfig) => {
  const errors: string[] = []

  if (!config.projectId) {
    errors.push('Missing BigQuery project ID')
  }

  if (!config.datasets.production) {
    errors.push('Missing BigQuery production dataset')
  }

  if (!config.credentials && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    errors.push('Missing BigQuery credentials')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}