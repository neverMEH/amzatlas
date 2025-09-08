import { NextResponse } from 'next/server'
import { getFileBigQueryClient } from '@/config/bigquery-file-auth.config'
import { BigQuery } from '@google-cloud/bigquery'

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      BIGQUERY_PROJECT_ID: process.env.BIGQUERY_PROJECT_ID ? 'SET' : 'NOT SET',
      GOOGLE_APPLICATION_CREDENTIALS_JSON: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? `SET (${process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON.length} chars)` : 'NOT SET',
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || 'NOT SET',
    },
    tests: []
  }
  
  // Test 1: Parse credentials
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    try {
      const creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
      results.tests.push({
        name: 'Parse Credentials',
        success: true,
        details: {
          type: creds.type,
          project_id: creds.project_id,
          client_email: creds.client_email,
          has_private_key: !!creds.private_key,
          private_key_length: creds.private_key?.length
        }
      })
    } catch (error: any) {
      results.tests.push({
        name: 'Parse Credentials',
        success: false,
        error: error.message
      })
    }
  }
  
  // Test 2: File-based auth
  try {
    const client = getFileBigQueryClient()
    results.tests.push({
      name: 'Create File-Based Client',
      success: true
    })
    
    // Test 3: Simple query
    try {
      const query = `SELECT 1 as test_value`
      const [rows] = await client.query({ query })
      results.tests.push({
        name: 'Execute Test Query',
        success: true,
        result: rows[0]
      })
    } catch (error: any) {
      results.tests.push({
        name: 'Execute Test Query',
        success: false,
        error: error.message
      })
    }
    
    // Test 4: List datasets
    try {
      const [datasets] = await client.getDatasets({ maxResults: 3 })
      results.tests.push({
        name: 'List Datasets',
        success: true,
        count: datasets.length,
        datasets: datasets.map(d => d.id)
      })
    } catch (error: any) {
      results.tests.push({
        name: 'List Datasets',
        success: false,
        error: error.message
      })
    }
    
  } catch (error: any) {
    results.tests.push({
      name: 'Create File-Based Client',
      success: false,
      error: error.message
    })
  }
  
  // Test 5: Direct inline credentials
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && process.env.BIGQUERY_PROJECT_ID) {
    try {
      const creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
      creds.private_key = creds.private_key.replace(/\\n/g, '\n')
      
      const client = new BigQuery({
        projectId: process.env.BIGQUERY_PROJECT_ID,
        credentials: {
          type: creds.type,
          project_id: creds.project_id,
          private_key_id: creds.private_key_id,
          private_key: creds.private_key,
          client_email: creds.client_email,
          client_id: creds.client_id
        }
      })
      
      const query = `SELECT 1 as test_value`
      const [rows] = await client.query({ query })
      
      results.tests.push({
        name: 'Direct Inline Credentials',
        success: true,
        result: rows[0]
      })
    } catch (error: any) {
      results.tests.push({
        name: 'Direct Inline Credentials',
        success: false,
        error: error.message,
        stack: error.stack
      })
    }
  }
  
  // Summary
  results.summary = {
    total_tests: results.tests.length,
    successful: results.tests.filter((t: any) => t.success).length,
    failed: results.tests.filter((t: any) => !t.success).length
  }
  
  const allPassed = results.summary.failed === 0
  
  return NextResponse.json(results, { status: allPassed ? 200 : 500 })
}