import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Webhook configuration schema
const webhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  secret: z.string().optional(),
  events: z.array(z.enum(['refresh.completed', 'refresh.failed', 'refresh.warning'])).min(1),
  is_enabled: z.boolean().optional().default(true),
  headers: z.record(z.string()).optional().default({}),
  retry_config: z.object({
    max_attempts: z.number().min(1).max(10).optional().default(3),
    backoff_seconds: z.array(z.number()).optional().default([5, 30, 300])
  }).optional()
})

const updateWebhookSchema = webhookSchema.partial().extend({
  id: z.number()
})

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get all webhook configurations with recent delivery stats
    const { data: webhooks, error } = await supabase
      .from('webhook_configs')
      .select(`
        *,
        recent_deliveries:webhook_deliveries(
          id,
          event_type,
          status,
          attempt_count,
          created_at,
          delivered_at
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(error.message)
    }

    // Calculate delivery statistics for each webhook
    const webhooksWithStats = webhooks?.map(webhook => {
      const deliveries = webhook.recent_deliveries || []
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const recentDeliveries = deliveries.filter(
        d => new Date(d.created_at) > last24h
      )

      return {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        enabled: webhook.is_enabled,
        headers: webhook.headers,
        retry_config: webhook.retry_config,
        created_at: webhook.created_at,
        updated_at: webhook.updated_at,
        statistics: {
          total_deliveries_24h: recentDeliveries.length,
          successful_24h: recentDeliveries.filter(d => d.status === 'success').length,
          failed_24h: recentDeliveries.filter(d => d.status === 'failed').length,
          pending_24h: recentDeliveries.filter(d => d.status === 'pending' || d.status === 'retrying').length,
          last_delivery: deliveries[0]?.created_at || null,
          last_status: deliveries[0]?.status || null
        }
      }
    }) || []

    return NextResponse.json({
      webhooks: webhooksWithStats,
      total: webhooksWithStats.length
    })

  } catch (error) {
    console.error('Error fetching webhooks:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch webhooks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Parse and validate request body
    let body
    try {
      body = await request.json()
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const validation = webhookSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid webhook configuration', details: validation.error.errors },
        { status: 400 }
      )
    }

    const webhookData = validation.data

    // Test the webhook URL is reachable (optional)
    try {
      const testResponse = await fetch(webhookData.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...webhookData.headers
        },
        body: JSON.stringify({
          test: true,
          message: 'Webhook configuration test from Supabase'
        }),
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })

      if (!testResponse.ok) {
        console.warn(`Webhook URL returned ${testResponse.status} during test`)
      }
    } catch (testError) {
      console.warn('Webhook URL test failed:', testError)
      // Don't fail the creation, just warn
    }

    // Create webhook configuration
    const { data: webhook, error } = await supabase
      .from('webhook_configs')
      .insert({
        name: webhookData.name,
        url: webhookData.url,
        secret: webhookData.secret,
        events: webhookData.events,
        is_enabled: webhookData.is_enabled,
        headers: webhookData.headers,
        retry_config: webhookData.retry_config
      })
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook created successfully',
      webhook: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        enabled: webhook.is_enabled
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating webhook:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create webhook',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Parse and validate request body
    let body
    try {
      body = await request.json()
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const validation = updateWebhookSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid update parameters', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { id, ...updates } = validation.data

    // Update webhook
    const { data: webhook, error } = await supabase
      .from('webhook_configs')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Webhook not found' },
          { status: 404 }
        )
      }
      throw new Error(error.message)
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook updated successfully',
      webhook: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        enabled: webhook.is_enabled
      }
    })

  } catch (error) {
    console.error('Error updating webhook:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update webhook',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json(
        { error: 'Invalid webhook ID' },
        { status: 400 }
      )
    }

    // Delete webhook (deliveries will cascade delete)
    const { error } = await supabase
      .from('webhook_configs')
      .delete()
      .eq('id', parseInt(id))

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Webhook not found' },
          { status: 404 }
        )
      }
      throw new Error(error.message)
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting webhook:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete webhook',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}