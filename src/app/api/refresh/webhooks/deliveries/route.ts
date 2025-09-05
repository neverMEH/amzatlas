import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const webhookId = searchParams.get('webhook_id')
    const status = searchParams.get('status')
    const eventType = searchParams.get('event_type')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))

    // Build query
    let query = supabase
      .from('webhook_deliveries')
      .select(`
        *,
        webhook_configs(id, name, url)
      `, { count: 'exact' })
    
    // Apply filters
    if (webhookId) {
      query = query.eq('webhook_config_id', parseInt(webhookId))
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (eventType) {
      query = query.eq('event_type', eventType)
    }

    // Get total count
    const { count } = await query

    // Get paginated data
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize - 1
    
    const { data: deliveries, error } = await query
      .order('created_at', { ascending: false })
      .range(startIndex, endIndex)

    if (error) {
      throw new Error(error.message)
    }

    // Process deliveries
    const processedDeliveries = deliveries?.map(delivery => ({
      id: delivery.id,
      webhook_name: delivery.webhook_configs?.name || 'Unknown',
      webhook_url: delivery.webhook_configs?.url || 'Unknown',
      event_type: delivery.event_type,
      status: delivery.status,
      attempt_count: delivery.attempt_count,
      next_retry_at: delivery.next_retry_at,
      created_at: delivery.created_at,
      delivered_at: delivery.delivered_at,
      response_status: delivery.response_status,
      error_message: delivery.error_message,
      event_data: delivery.event_data
    })) || []

    // Calculate summary statistics
    const summary = {
      total: count || 0,
      by_status: {
        pending: 0,
        success: 0,
        failed: 0,
        retrying: 0
      },
      by_event: {} as Record<string, number>
    }

    processedDeliveries.forEach(delivery => {
      summary.by_status[delivery.status as keyof typeof summary.by_status]++
      summary.by_event[delivery.event_type] = (summary.by_event[delivery.event_type] || 0) + 1
    })

    // Calculate pagination info
    const totalPages = Math.ceil((count || 0) / pageSize)
    
    const pagination = {
      page,
      pageSize,
      total: count || 0,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1
    }

    return NextResponse.json({
      deliveries: processedDeliveries,
      summary,
      pagination,
      filters: {
        webhook_id: webhookId,
        status,
        event_type: eventType
      }
    })

  } catch (error) {
    console.error('Error fetching webhook deliveries:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch webhook deliveries',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Retry failed webhook deliveries
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

    const { delivery_ids } = body

    if (!Array.isArray(delivery_ids) || delivery_ids.length === 0) {
      return NextResponse.json(
        { error: 'delivery_ids must be a non-empty array' },
        { status: 400 }
      )
    }

    // Reset failed deliveries to pending for retry
    const { data: updatedDeliveries, error } = await supabase
      .from('webhook_deliveries')
      .update({
        status: 'pending',
        attempt_count: 0,
        next_retry_at: null,
        error_message: null
      })
      .in('id', delivery_ids)
      .in('status', ['failed']) // Only retry failed deliveries
      .select()

    if (error) {
      throw new Error(error.message)
    }

    if (!updatedDeliveries || updatedDeliveries.length === 0) {
      return NextResponse.json(
        { error: 'No failed deliveries found with the provided IDs' },
        { status: 404 }
      )
    }

    // Trigger webhook processor to handle the retries
    await supabase.functions.invoke('webhook-processor')

    return NextResponse.json({
      success: true,
      message: `${updatedDeliveries.length} deliveries queued for retry`,
      delivery_ids: updatedDeliveries.map(d => d.id)
    })

  } catch (error) {
    console.error('Error retrying webhook deliveries:', error)
    return NextResponse.json(
      { 
        error: 'Failed to retry webhook deliveries',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}