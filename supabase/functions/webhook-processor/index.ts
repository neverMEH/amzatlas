import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createErrorResponse, createSuccessResponse } from '../_shared/utils.ts'

const FUNCTION_TIMEOUT = 540000 // 9 minutes

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

// Helper to wait with exponential backoff
function getBackoffDelay(attempt: number, backoffConfig: number[]): number {
  if (attempt >= backoffConfig.length) {
    return backoffConfig[backoffConfig.length - 1] * 1000
  }
  return backoffConfig[attempt] * 1000
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Webhook processor starting...')
    const startTime = Date.now()

    // Get pending webhook deliveries
    const { data: pendingDeliveries, error: fetchError } = await supabase
      .from('webhook_deliveries')
      .select(`
        *,
        webhook_configs!inner(*)
      `)
      .in('status', ['pending', 'retrying'])
      .lte('next_retry_at', new Date().toISOString())
      .or('next_retry_at.is.null')
      .order('created_at', { ascending: true })
      .limit(10) // Process up to 10 webhooks at a time

    if (fetchError) {
      return createErrorResponse('Failed to fetch pending deliveries', fetchError)
    }

    if (!pendingDeliveries || pendingDeliveries.length === 0) {
      console.log('No pending webhook deliveries')
      return createSuccessResponse({ processed: 0 }, 'No pending deliveries')
    }

    console.log(`Found ${pendingDeliveries.length} pending deliveries`)

    const results = []
    
    for (const delivery of pendingDeliveries) {
      // Check timeout
      if (Date.now() - startTime > FUNCTION_TIMEOUT) {
        console.log('Approaching timeout, scheduling continuation...')
        await supabase.functions.invoke('webhook-processor')
        break
      }

      const config = delivery.webhook_configs
      
      try {
        console.log(`Processing delivery ${delivery.id} for webhook ${config.name}`)
        
        // Prepare request body
        const payload = JSON.stringify({
          event: delivery.event_type,
          data: delivery.event_data,
          delivery_id: delivery.id,
          timestamp: new Date().toISOString()
        })

        // Prepare headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'User-Agent': 'Supabase-Webhook/1.0',
          'X-Webhook-Event': delivery.event_type,
          'X-Webhook-Delivery': delivery.id.toString(),
          ...config.headers
        }

        // Add signature if secret is configured
        if (config.secret) {
          const signature = await createWebhookSignature(payload, config.secret)
          headers['X-Webhook-Signature'] = signature
        }

        // Make the request
        const response = await fetch(config.url, {
          method: 'POST',
          headers,
          body: payload,
          signal: AbortSignal.timeout(30000) // 30 second timeout per request
        })

        const responseText = await response.text()
        
        // Update delivery record
        if (response.ok) {
          await supabase
            .from('webhook_deliveries')
            .update({
              status: 'success',
              attempt_count: delivery.attempt_count + 1,
              request_headers: headers,
              request_body: JSON.parse(payload),
              response_status: response.status,
              response_headers: Object.fromEntries(response.headers.entries()),
              response_body: responseText,
              delivered_at: new Date().toISOString()
            })
            .eq('id', delivery.id)

          results.push({ delivery_id: delivery.id, status: 'success' })
          console.log(`Delivery ${delivery.id} successful`)
        } else {
          throw new Error(`HTTP ${response.status}: ${responseText}`)
        }

      } catch (error) {
        console.error(`Delivery ${delivery.id} failed:`, error)
        
        const newAttemptCount = delivery.attempt_count + 1
        const maxAttempts = config.retry_config?.max_attempts || 3
        
        // Determine if we should retry
        if (newAttemptCount < maxAttempts) {
          const backoffSeconds = config.retry_config?.backoff_seconds || [5, 30, 300]
          const delay = getBackoffDelay(newAttemptCount - 1, backoffSeconds)
          const nextRetryAt = new Date(Date.now() + delay)
          
          await supabase
            .from('webhook_deliveries')
            .update({
              status: 'retrying',
              attempt_count: newAttemptCount,
              next_retry_at: nextRetryAt.toISOString(),
              error_message: error.message
            })
            .eq('id', delivery.id)

          results.push({ 
            delivery_id: delivery.id, 
            status: 'retrying', 
            next_retry: nextRetryAt.toISOString() 
          })
        } else {
          // Max attempts reached, mark as failed
          await supabase
            .from('webhook_deliveries')
            .update({
              status: 'failed',
              attempt_count: newAttemptCount,
              error_message: error.message,
              delivered_at: new Date().toISOString()
            })
            .eq('id', delivery.id)

          results.push({ 
            delivery_id: delivery.id, 
            status: 'failed', 
            reason: 'max_attempts_reached' 
          })
        }
      }
    }

    // Summary
    const summary = {
      processed: results.length,
      successful: results.filter(r => r.status === 'success').length,
      retrying: results.filter(r => r.status === 'retrying').length,
      failed: results.filter(r => r.status === 'failed').length
    }

    console.log(`Webhook processing completed:`, summary)

    // Schedule another run if there might be more pending
    if (pendingDeliveries.length === 10) {
      console.log('More deliveries might be pending, scheduling another run...')
      await supabase.functions.invoke('webhook-processor')
    }

    return createSuccessResponse({
      summary,
      results
    })

  } catch (error) {
    console.error('Webhook processor error:', error)
    return createErrorResponse('Webhook processor failed', error.message)
  }
})