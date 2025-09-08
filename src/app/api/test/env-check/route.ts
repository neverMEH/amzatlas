import { NextResponse } from 'next/server'

export async function GET() {
  // Only show non-sensitive environment info
  const envCheck = {
    timestamp: new Date().toISOString(),
    node_env: process.env.NODE_ENV,
    railway_environment: process.env.RAILWAY_ENVIRONMENT,
    bigquery: {
      project_id: process.env.BIGQUERY_PROJECT_ID || 'NOT SET',
      dataset: process.env.BIGQUERY_DATASET || 'NOT SET (default: dataclient_amzatlas_agency_85)',
      dataset_dev: process.env.BIGQUERY_DATASET_DEV || 'NOT SET (default: sqp_data_dev)',
      dataset_staging: process.env.BIGQUERY_DATASET_STAGING || 'NOT SET (default: sqp_data_staging)',
      location: process.env.BIGQUERY_LOCATION || 'NOT SET (default: US)',
      credentials_json_length: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.length || 0,
      credentials_file: process.env.GOOGLE_APPLICATION_CREDENTIALS || 'NOT SET'
    },
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET',
      anon_key_length: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
      service_key_length: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0
    }
  }
  
  // Check which values are missing
  const missing: string[] = []
  
  if (!process.env.BIGQUERY_PROJECT_ID) missing.push('BIGQUERY_PROJECT_ID')
  if (!process.env.BIGQUERY_DATASET) missing.push('BIGQUERY_DATASET')
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) missing.push('GOOGLE_APPLICATION_CREDENTIALS_JSON')
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  
  return NextResponse.json({
    ...envCheck,
    missing_required: missing,
    status: missing.length === 0 ? 'OK' : 'MISSING_ENV_VARS'
  })
}