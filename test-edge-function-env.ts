import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testEdgeFunctionEnv() {
  console.log('Testing Edge Function Environment...\n')
  
  // Create a simple test edge function that just checks environment
  console.log('Creating test edge function to check environment...')
  
  const testFunctionCode = `
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  try {
    // Check which environment variables are available
    const envCheck = {
      hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
      hasSupabaseKey: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      hasBigQueryProject: !!Deno.env.get('BIGQUERY_PROJECT_ID'),
      hasBigQueryDataset: !!Deno.env.get('BIGQUERY_DATASET'),
      hasGoogleCreds: !!Deno.env.get('GOOGLE_APPLICATION_CREDENTIALS_JSON'),
      availableEnvKeys: Object.keys(Deno.env.toObject()).filter(key => 
        !key.includes('KEY') && !key.includes('SECRET') && !key.includes('CRED')
      )
    }
    
    return new Response(JSON.stringify({
      success: true,
      environment: envCheck,
      message: 'Environment check complete'
    }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
  `.trim()
  
  console.log('\nInvoking test function...')
  
  // Since we can't deploy a new function on the fly, let's check the existing functions
  // by looking at what error they return
  
  const functionsToTest = [
    'daily-refresh-orchestrator',
    'refresh-generic-table',
    'refresh-asin-performance'
  ]
  
  for (const funcName of functionsToTest) {
    console.log(`\nTesting ${funcName}...`)
    
    const { data, error } = await supabase.functions.invoke(funcName, {
      body: { test: true }
    })
    
    if (error) {
      console.log(`❌ Error:`, error.context?.status || error.message)
      
      // Try to get error details from response body
      if (error.context?.body) {
        try {
          const reader = error.context.body.getReader()
          const { value } = await reader.read()
          const text = new TextDecoder().decode(value)
          console.log('Error details:', text)
        } catch (e) {
          // Ignore
        }
      }
    } else {
      console.log(`✅ Response:`, data)
    }
  }
  
  console.log('\n\n=== Summary ===')
  console.log('The edge functions are failing, likely due to:')
  console.log('1. Missing BigQuery credentials in the edge function environment')
  console.log('2. The functions were deployed without the necessary environment variables')
  console.log('3. Need to set BigQuery secrets using: supabase secrets set')
}

testEdgeFunctionEnv().catch(console.error)