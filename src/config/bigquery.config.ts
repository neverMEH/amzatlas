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
      credentials = JSON.parse(credsJson)
    }
  } catch (error) {
    console.error('Failed to parse BigQuery credentials:', error)
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