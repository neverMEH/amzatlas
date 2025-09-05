import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from '@/config/supabase.config'

// Orchestrate sync for multiple tables
export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization')
    const supabaseConfig = getSupabaseConfig()
    const expectedToken = supabaseConfig.serviceRoleKey
    
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.substring(7) !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { 
      refreshType = 'scheduled',
      tables = [] // Optional: specific tables to sync
    } = await request.json()

    console.log(`Starting orchestrated sync (${refreshType})`)

    // Initialize Supabase client
    const supabase = createClient(
      supabaseConfig.url,
      supabaseConfig.serviceRoleKey || supabaseConfig.anonKey
    )

    // Get tables to refresh
    let query = supabase
      .from('refresh_config')
      .select('*')
      .eq('is_enabled', true)

    // If specific tables requested, filter by them
    if (tables.length > 0) {
      query = query.in('table_name', tables)
    } else {
      // Otherwise, get tables due for refresh
      query = query.lte('next_refresh_at', new Date().toISOString())
    }

    const { data: configs, error: configError } = await query

    if (configError || !configs || configs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No tables due for refresh',
        tablesProcessed: 0
      })
    }

    console.log(`Found ${configs.length} tables to refresh`)

    // Create orchestration log
    const { data: orchestrationLog } = await supabase
      .from('refresh_orchestration_log')
      .insert({
        refresh_type: refreshType,
        total_tables: configs.length,
        status: 'in_progress',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    const results = []
    let successCount = 0
    let failCount = 0
    let totalRows = 0

    // Process each table
    for (const config of configs) {
      try {
        console.log(`Processing ${config.table_name}...`)
        
        // Call sync API for each table
        const syncResponse = await fetch(`${request.nextUrl.origin}/api/sync/bigquery`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${expectedToken}`
          },
          body: JSON.stringify({
            tableName: config.table_name,
            tableSchema: config.table_schema,
            options: {
              batchSize: 1000,
              truncate: refreshType === 'full'
            }
          })
        })

        const syncResult = await syncResponse.json()
        
        if (syncResult.success) {
          successCount++
          totalRows += syncResult.rowsProcessed || 0
          results.push({
            table: config.table_name,
            status: 'success',
            rowsProcessed: syncResult.rowsProcessed,
            duration: syncResult.duration
          })
        } else {
          failCount++
          results.push({
            table: config.table_name,
            status: 'failed',
            error: syncResult.error || 'Unknown error'
          })
        }
        
      } catch (error) {
        failCount++
        console.error(`Failed to sync ${config.table_name}:`, error)
        results.push({
          table: config.table_name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      // Small delay between tables to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Update orchestration log
    if (orchestrationLog) {
      await supabase
        .from('refresh_orchestration_log')
        .update({
          status: failCount === 0 ? 'success' : 'partial',
          completed_at: new Date().toISOString(),
          successful_tables: successCount,
          failed_tables: failCount,
          total_rows_processed: totalRows
        })
        .eq('id', orchestrationLog.id)
    }

    // Trigger webhook if configured
    if (successCount > 0 || failCount > 0) {
      try {
        await fetch(`${request.nextUrl.origin}/api/sync/webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${expectedToken}`
          },
          body: JSON.stringify({
            event: 'sync_completed',
            orchestrationId: orchestrationLog?.id,
            summary: {
              totalTables: configs.length,
              successful: successCount,
              failed: failCount,
              totalRows: totalRows
            },
            results
          })
        })
      } catch (webhookError) {
        console.error('Failed to send webhook:', webhookError)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${configs.length} tables`,
      summary: {
        totalTables: configs.length,
        successful: successCount,
        failed: failCount,
        totalRows: totalRows
      },
      results,
      orchestrationId: orchestrationLog?.id
    })

  } catch (error) {
    console.error('Orchestration error:', error)
    return NextResponse.json(
      { 
        error: 'Orchestration failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check orchestration status
export async function GET(request: NextRequest) {
  try {
    const supabaseConfig = getSupabaseConfig()
    const supabase = createClient(
      supabaseConfig.url,
      supabaseConfig.serviceRoleKey || supabaseConfig.anonKey
    )

    // Get recent orchestration logs
    const { data: logs, error } = await supabase
      .from('refresh_orchestration_log')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      recentOrchestrations: logs
    })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to get orchestration status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}