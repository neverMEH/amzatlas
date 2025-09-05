import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get all refresh configurations
    const { data: configs, error: configError } = await supabase
      .from('refresh_config')
      .select('*')
      .order('priority', { ascending: false })

    if (configError) {
      throw new Error(configError.message)
    }

    // Get recent refresh logs (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recentLogs, error: logError } = await supabase
      .from('refresh_audit_log')
      .select('*')
      .gte('refresh_started_at', twentyFourHoursAgo)
      .order('refresh_started_at', { ascending: false })
      .limit(100)

    if (logError) {
      throw new Error(logError.message)
    }

    // Process configurations to determine status
    const now = new Date()
    const tables = configs?.map(config => {
      const nextRefresh = config.next_refresh_at ? new Date(config.next_refresh_at) : null
      const lastRefresh = config.last_refresh_at ? new Date(config.last_refresh_at) : null
      
      const hoursUntilRefresh = nextRefresh 
        ? (nextRefresh.getTime() - now.getTime()) / (1000 * 60 * 60)
        : null

      // Find most recent log for this table
      const recentLog = recentLogs?.find(log => 
        log.table_name === config.table_name && 
        log.table_schema === config.table_schema
      )

      // Determine table status
      let status = 'pending'
      if (recentLog) {
        status = recentLog.status
      } else if (hoursUntilRefresh !== null && hoursUntilRefresh < 0) {
        status = 'overdue'
      } else if (!config.is_enabled) {
        status = 'disabled'
      }

      // Check if table is stale (hasn't refreshed within frequency + buffer)
      const isStale = lastRefresh && 
        (now.getTime() - lastRefresh.getTime()) > 
        (config.refresh_frequency_hours * 60 * 60 * 1000 * 1.5)

      return {
        table_name: config.table_name,
        schema: config.table_schema,
        enabled: config.is_enabled,
        status,
        is_stale: isStale,
        last_refresh: config.last_refresh_at,
        next_refresh: config.next_refresh_at,
        hours_until_refresh: hoursUntilRefresh,
        frequency_hours: config.refresh_frequency_hours,
        priority: config.priority,
        recent_error: recentLog?.status === 'failed' ? recentLog.error_message : null
      }
    }) || []

    // Calculate statistics
    const stats = {
      total_tables: tables.length,
      enabled_tables: tables.filter(t => t.enabled).length,
      disabled_tables: tables.filter(t => !t.enabled).length,
      successful_today: recentLogs?.filter(log => log.status === 'success').length || 0,
      failed_today: recentLogs?.filter(log => log.status === 'failed').length || 0,
      running_now: recentLogs?.filter(log => log.status === 'running').length || 0,
      stale_tables: tables.filter(t => t.is_stale).length,
      overdue_tables: tables.filter(t => t.status === 'overdue').length
    }

    // Determine overall system status
    let overallStatus = 'healthy'
    if (stats.failed_today > 0 || stats.overdue_tables > tables.length / 2) {
      overallStatus = 'error'
    } else if (stats.stale_tables > 0 || stats.overdue_tables > 0) {
      overallStatus = 'warning'
    }

    // Process recent activity
    const recentActivity = recentLogs?.slice(0, 10).map(log => {
      const startTime = new Date(log.refresh_started_at)
      const endTime = log.refresh_completed_at ? new Date(log.refresh_completed_at) : null
      const durationMinutes = endTime 
        ? Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))
        : null

      return {
        id: log.id,
        table_name: log.table_name,
        status: log.status,
        started_at: log.refresh_started_at,
        completed_at: log.refresh_completed_at,
        duration_minutes: durationMinutes,
        rows_processed: log.rows_processed,
        error: log.error_message
      }
    }) || []

    return NextResponse.json({
      overall_status: overallStatus,
      statistics: stats,
      tables,
      recent_activity: recentActivity,
      last_updated: now.toISOString()
    })

  } catch (error) {
    console.error('Error fetching refresh status:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch refresh status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}