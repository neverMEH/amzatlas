import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Update configuration schema
const updateConfigSchema = z.object({
  id: z.number(),
  is_enabled: z.boolean().optional(),
  refresh_frequency_hours: z.number().min(1).max(168).optional(), // 1 hour to 7 days
  priority: z.number().min(0).max(1000).optional(),
  custom_sync_params: z.record(z.string(), z.any()).optional(),
  dependencies: z.array(z.string()).optional()
})

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get all refresh configurations
    const { data: configurations, error } = await supabase
      .from('refresh_config')
      .select('*')
      .order('priority', { ascending: false })

    if (error) {
      throw new Error(error.message)
    }

    // Process configurations
    const processedConfigs = configurations?.map(config => ({
      id: config.id,
      table_name: config.table_name,
      table_schema: config.table_schema,
      enabled: config.is_enabled,
      frequency_hours: config.refresh_frequency_hours,
      priority: config.priority,
      function_name: config.function_name,
      dependencies: config.dependencies || [],
      custom_sync_params: config.custom_sync_params || {},
      last_refresh: config.last_refresh_at,
      next_refresh: config.next_refresh_at,
      created_at: config.created_at,
      updated_at: config.updated_at
    })) || []

    // Calculate summary statistics
    const summary = {
      total_tables: processedConfigs.length,
      enabled_tables: processedConfigs.filter(c => c.enabled).length,
      disabled_tables: processedConfigs.filter(c => !c.enabled).length,
      average_frequency_hours: 0,
      highest_priority_table: null as string | null,
      lowest_priority_table: null as string | null
    }

    if (processedConfigs.length > 0) {
      const frequencies = processedConfigs.map(c => c.frequency_hours)
      summary.average_frequency_hours = 
        Math.round(frequencies.reduce((a, b) => a + b, 0) / frequencies.length * 10) / 10
      
      summary.highest_priority_table = processedConfigs[0].table_name
      summary.lowest_priority_table = processedConfigs[processedConfigs.length - 1].table_name
    }

    return NextResponse.json({
      configurations: processedConfigs,
      summary
    })

  } catch (error) {
    console.error('Error fetching refresh configurations:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch refresh configurations',
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

    const validation = updateConfigSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid update parameters', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { id, ...updates } = validation.data as any

    // Check if there are fields to update
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Additional validations
    if (updates.refresh_frequency_hours && updates.refresh_frequency_hours < 1) {
      return NextResponse.json(
        { error: 'Refresh frequency must be at least 1 hour' },
        { status: 400 }
      )
    }

    if (updates.priority !== undefined && (updates.priority < 0 || updates.priority > 1000)) {
      return NextResponse.json(
        { error: 'Priority must be between 0 and 1000' },
        { status: 400 }
      )
    }

    if (updates.custom_sync_params) {
      // Validate custom parameters based on expected keys
      const { batch_size } = updates.custom_sync_params as any
      if (batch_size !== undefined && (batch_size < 1 || batch_size > 10000)) {
        return NextResponse.json(
          { error: 'Invalid custom sync parameters: batch_size must be between 1 and 10000' },
          { status: 400 }
        )
      }
    }

    if (updates.dependencies) {
      // Could add validation to ensure dependencies exist
      // For now, just ensure it's an array of strings
      if (!Array.isArray(updates.dependencies) || 
          !updates.dependencies.every((dep: any) => typeof dep === 'string')) {
        return NextResponse.json(
          { error: 'Invalid dependencies: must be an array of table names' },
          { status: 400 }
        )
      }
    }

    // Get current configuration
    const { data: currentConfig, error: fetchError } = await supabase
      .from('refresh_config')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !currentConfig) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      )
    }

    // Update next_refresh_at if frequency changes
    if (updates.refresh_frequency_hours && 
        updates.refresh_frequency_hours !== currentConfig.refresh_frequency_hours &&
        currentConfig.last_refresh_at) {
      const lastRefresh = new Date(currentConfig.last_refresh_at)
      const nextRefresh = new Date(lastRefresh.getTime() + updates.refresh_frequency_hours * 60 * 60 * 1000)
      updates.next_refresh_at = nextRefresh.toISOString() as any
    }

    // Add updated_at timestamp
    updates.updated_at = new Date().toISOString() as any

    // Update configuration
    const { data: updatedConfig, error: updateError } = await supabase
      .from('refresh_config')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      throw new Error(updateError.message)
    }

    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully',
      configuration: {
        id: updatedConfig.id,
        table_name: updatedConfig.table_name,
        table_schema: updatedConfig.table_schema,
        enabled: updatedConfig.is_enabled,
        frequency_hours: updatedConfig.refresh_frequency_hours,
        priority: updatedConfig.priority,
        function_name: updatedConfig.function_name,
        dependencies: updatedConfig.dependencies || [],
        custom_sync_params: updatedConfig.custom_sync_params || {},
        last_refresh: updatedConfig.last_refresh_at,
        next_refresh: updatedConfig.next_refresh_at,
        updated_at: updatedConfig.updated_at
      },
      changes: Object.keys(updates).filter(k => k !== 'updated_at')
    })

  } catch (error) {
    console.error('Error updating refresh configuration:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}