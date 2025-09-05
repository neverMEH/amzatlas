import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Helper to create webhook signature
async function createWebhookSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(payload)
  const key = encoder.encode(secret)
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data)
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Parse request body
    let body
    try {
      body = await request.json()
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { webhook_id, event_type = 'refresh.completed' } = body

    if (!webhook_id || isNaN(parseInt(webhook_id))) {
      return NextResponse.json(
        { error: 'Invalid webhook_id' },
        { status: 400 }
      )
    }

    // Get webhook configuration
    const { data: webhook, error: fetchError } = await supabase
      .from('webhook_configs')
      .select('*')
      .eq('id', parseInt(webhook_id))
      .single()

    if (fetchError || !webhook) {
      return NextResponse.json(
        { error: 'Webhook not found' },
        { status: 404 }
      )
    }

    // Check if webhook is enabled
    if (!webhook.is_enabled) {
      return NextResponse.json(
        { error: 'Webhook is disabled' },
        { status: 400 }
      )
    }

    // Check if event type is subscribed
    if (!webhook.events.includes(event_type)) {
      return NextResponse.json(
        { error: `Webhook is not subscribed to ${event_type} events` },
        { status: 400 }
      )
    }

    // Prepare test payload
    const testPayload = {
      event: event_type,
      data: {
        test: true,
        audit_log_id: 'test-' + Date.now(),
        table_schema: 'sqp',
        table_name: 'test_table',
        status: event_type === 'refresh.failed' ? 'failed' : 'success',
        refresh_type: 'test',
        started_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: 300000,
        rows_processed: 1000,
        error_message: event_type === 'refresh.failed' ? 'Test error message' : null,
        function_name: 'test-function'
      },
      delivery_id: 'test-delivery-' + Date.now(),
      timestamp: new Date().toISOString()
    }

    const payload = JSON.stringify(testPayload)

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Supabase-Webhook/1.0',
      'X-Webhook-Event': event_type,
      'X-Webhook-Delivery': 'test',
      ...webhook.headers
    }

    // Add signature if secret is configured
    if (webhook.secret) {
      const signature = await createWebhookSignature(payload, webhook.secret)
      headers['X-Webhook-Signature'] = signature
    }

    // Make the test request
    const startTime = Date.now()
    
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: payload,
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })

      const responseTime = Date.now() - startTime
      const responseText = await response.text()
      
      // Parse response headers
      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      const result = {
        success: response.ok,
        webhook_name: webhook.name,
        webhook_url: webhook.url,
        event_type,
        request: {
          headers,
          body: testPayload
        },
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          body: responseText,
          time_ms: responseTime
        },
        signature_used: !!webhook.secret
      }

      return NextResponse.json(result)

    } catch (fetchError) {
      const error = fetchError as Error
      return NextResponse.json({
        success: false,
        webhook_name: webhook.name,
        webhook_url: webhook.url,
        event_type,
        error: {
          message: error.message,
          type: error.name,
          time_ms: Date.now() - startTime
        }
      })
    }

  } catch (error) {
    console.error('Error testing webhook:', error)
    return NextResponse.json(
      { 
        error: 'Failed to test webhook',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}