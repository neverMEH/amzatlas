import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Request validation schema
const triggerSchema = z.object({
  table_name: z.string().optional(),
  force: z.boolean().optional().default(false)
})

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

    const validation = triggerSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { table_name, force } = validation.data

    // If no table specified, trigger full refresh
    if (!table_name) {
      const { data, error } = await supabase.functions.invoke('daily-refresh-orchestrator')
      
      if (error) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Failed to trigger refresh',
            details: error.message 
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Refresh triggered successfully',
        type: 'full',
        details: data
      })
    }

    // Single table refresh
    // Get table configuration
    const { data: config, error: configError } = await supabase
      .from('refresh_config')
      .select('*')
      .eq('table_name', table_name)
      .single()

    if (configError || !config) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Table configuration not found',
          table: table_name 
        },
        { status: 404 }
      )
    }

    // Check if table is enabled
    if (!config.is_enabled) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Table is disabled for refresh',
          table: table_name 
        },
        { status: 400 }
      )
    }

    // Check if refresh is needed (unless forced)
    if (!force && config.last_refresh_at) {
      const lastRefresh = new Date(config.last_refresh_at)
      const minInterval = 60 * 60 * 1000 // 1 hour minimum between refreshes
      const timeSinceLastRefresh = Date.now() - lastRefresh.getTime()
      
      if (timeSinceLastRefresh < minInterval) {
        const minutesUntilAllowed = Math.ceil((minInterval - timeSinceLastRefresh) / (60 * 1000))
        return NextResponse.json(
          { 
            success: false,
            error: `Table was recently refreshed. Please wait ${minutesUntilAllowed} minutes or use force=true`,
            table: table_name,
            last_refresh: config.last_refresh_at
          },
          { status: 429 }
        )
      }
    }

    // Create audit log entry
    const { data: auditLog, error: auditError } = await supabase
      .from('refresh_audit_log')
      .insert({
        table_schema: config.table_schema,
        table_name: config.table_name,
        refresh_type: 'manual',
        status: 'in_progress',
        refresh_started_at: new Date().toISOString(),
        function_name: config.function_name || 'refresh-generic-table'
      })
      .select()
      .single()

    if (auditError) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to create audit log',
          details: auditError.message 
        },
        { status: 500 }
      )
    }

    // Invoke the specific refresh function
    const functionName = config.function_name || 'refresh-generic-table'
    const { data: refreshData, error: refreshError } = await supabase.functions.invoke(
      functionName,
      {
        body: {
          config,
          auditLogId: auditLog.id
        }
      }
    )

    if (refreshError) {
      // Update audit log with failure
      await supabase
        .from('refresh_audit_log')
        .update({
          status: 'failed',
          error_message: refreshError.message,
          refresh_completed_at: new Date().toISOString()
        })
        .eq('id', auditLog.id)

      return NextResponse.json(
        { 
          success: false,
          error: 'Refresh function failed',
          details: refreshError.message,
          table: table_name
        },
        { status: 500 }
      )
    }

    // Update next refresh time
    const nextRefreshAt = new Date()
    nextRefreshAt.setHours(nextRefreshAt.getHours() + config.refresh_frequency_hours)
    
    await supabase
      .from('refresh_config')
      .update({
        last_refresh_at: new Date().toISOString(),
        next_refresh_at: nextRefreshAt.toISOString()
      })
      .eq('id', config.id)

    return NextResponse.json({
      success: true,
      message: `Refresh triggered for table: ${table_name}${force ? ' (forced)' : ''}`,
      type: 'single',
      table: table_name,
      audit_log_id: auditLog.id,
      function_invoked: functionName,
      details: refreshData
    })

  } catch (error) {
    console.error('Error triggering refresh:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}