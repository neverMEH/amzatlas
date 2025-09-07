import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from '@/config/supabase.config'
import crypto from 'crypto'

// Process webhook notifications
export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization')
    const supabaseConfig = getSupabaseConfig()
    const expectedToken = supabaseConfig.serviceRoleKey
    
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.substring(7) !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await request.json()
    const { event, orchestrationId, summary, results } = payload

    console.log(`Processing webhook: ${event}`)

    // Initialize Supabase client
    const supabase = createClient(
      supabaseConfig.url,
      supabaseConfig.serviceRoleKey || supabaseConfig.anonKey
    )

    // Get active webhook configurations
    const { data: webhookConfigs, error: configError } = await supabase
      .from('webhook_config')
      .select('*')
      .eq('is_active', true)
      .contains('events', [event])

    if (configError || !webhookConfigs || webhookConfigs.length === 0) {
      console.log('No active webhooks configured for this event')
      return NextResponse.json({
        success: true,
        message: 'No webhooks to process'
      })
    }

    const deliveryResults = []

    // Process each webhook
    for (const config of webhookConfigs) {
      const deliveryId = crypto.randomBytes(16).toString('hex')
      
      // Create delivery log
      const { data: deliveryLog } = await supabase
        .from('webhook_delivery_log')
        .insert({
          webhook_config_id: config.id,
          delivery_id: deliveryId,
          endpoint_url: config.endpoint_url,
          event_type: event,
          payload: payload,
          status: 'pending'
        })
        .select()
        .single()

      try {
        // Prepare webhook payload
        const webhookPayload = {
          id: deliveryId,
          timestamp: new Date().toISOString(),
          event: event,
          data: {
            orchestrationId,
            summary,
            results: results?.slice(0, 10) // Limit results for webhook
          }
        }

        // Calculate signature if secret is configured
        const headers: any = {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event,
          'X-Webhook-Delivery': deliveryId
        }

        if (config.secret) {
          const signature = crypto
            .createHmac('sha256', config.secret)
            .update(JSON.stringify(webhookPayload))
            .digest('hex')
          headers['X-Webhook-Signature'] = `sha256=${signature}`
        }

        // Send webhook
        console.log(`Sending webhook to ${config.endpoint_url}`)
        const startTime = Date.now()
        
        const response = await fetch(config.endpoint_url, {
          method: 'POST',
          headers,
          body: JSON.stringify(webhookPayload),
          signal: AbortSignal.timeout(30000) // 30 second timeout
        })

        const responseTime = Date.now() - startTime
        const responseBody = await response.text()

        // Update delivery log
        await supabase
          .from('webhook_delivery_log')
          .update({
            status: response.ok ? 'delivered' : 'failed',
            http_status_code: response.status,
            response_body: responseBody.substring(0, 1000), // Limit response size
            response_time_ms: responseTime,
            delivered_at: new Date().toISOString()
          })
          .eq('id', deliveryLog?.id)

        deliveryResults.push({
          endpoint: config.endpoint_url,
          status: response.ok ? 'delivered' : 'failed',
          httpStatus: response.status,
          responseTime: responseTime
        })

        // Update webhook config stats
        await supabase.rpc('increment_webhook_stats', {
          p_webhook_id: config.id,
          p_success: response.ok
        })

      } catch (error) {
        console.error(`Webhook delivery failed for ${config.endpoint_url}:`, error)
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        // Update delivery log with error
        await supabase
          .from('webhook_delivery_log')
          .update({
            status: 'failed',
            error_message: errorMessage,
            delivered_at: new Date().toISOString()
          })
          .eq('id', deliveryLog?.id)

        deliveryResults.push({
          endpoint: config.endpoint_url,
          status: 'failed',
          error: errorMessage
        })

        // Update webhook config failure count
        await supabase.rpc('increment_webhook_stats', {
          p_webhook_id: config.id,
          p_success: false
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${webhookConfigs.length} webhooks`,
      deliveries: deliveryResults
    })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check webhook delivery status
export async function GET(request: NextRequest) {
  try {
    const supabaseConfig = getSupabaseConfig()
    const supabase = createClient(
      supabaseConfig.url,
      supabaseConfig.serviceRoleKey || supabaseConfig.anonKey
    )

    const url = new URL(request.url)
    const deliveryId = url.searchParams.get('deliveryId')
    
    if (deliveryId) {
      // Get specific delivery
      const { data, error } = await supabase
        .from('webhook_delivery_log')
        .select(`
          *,
          webhook_config (
            name,
            endpoint_url
          )
        `)
        .eq('delivery_id', deliveryId)
        .single()

      if (error) {
        throw error
      }

      return NextResponse.json({
        success: true,
        delivery: data
      })
    } else {
      // Get recent deliveries
      const { data, error } = await supabase
        .from('webhook_delivery_log')
        .select(`
          delivery_id,
          endpoint_url,
          event_type,
          status,
          http_status_code,
          response_time_ms,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        throw error
      }

      return NextResponse.json({
        success: true,
        recentDeliveries: data
      })
    }

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to get webhook status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}