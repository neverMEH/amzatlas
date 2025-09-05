import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const days = Math.min(30, Math.max(1, parseInt(searchParams.get('days') || '7')))
    const tableName = searchParams.get('table_name')
    
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    // Build query
    let query = supabase
      .from('refresh_audit_log')
      .select('*')
      .gte('refresh_started_at', startDate.toISOString())
      .not('refresh_completed_at', 'is', null)
    
    if (tableName) {
      query = query.eq('table_name', tableName)
    }
    
    const { data: logs, error } = await query.order('refresh_started_at', { ascending: true })
    
    if (error) {
      throw new Error(error.message)
    }
    
    // Calculate daily metrics
    const dailyMetrics: Record<string, any> = {}
    
    logs?.forEach(log => {
      const date = new Date(log.refresh_started_at).toISOString().split('T')[0]
      
      if (!dailyMetrics[date]) {
        dailyMetrics[date] = {
          date,
          total_refreshes: 0,
          successful: 0,
          failed: 0,
          total_rows: 0,
          total_duration_ms: 0,
          tables: new Set()
        }
      }
      
      dailyMetrics[date].total_refreshes++
      dailyMetrics[date][log.status]++
      
      if (log.rows_processed) {
        dailyMetrics[date].total_rows += log.rows_processed
      }
      
      if (log.execution_time_ms) {
        dailyMetrics[date].total_duration_ms += log.execution_time_ms
      }
      
      dailyMetrics[date].tables.add(log.table_name)
    })
    
    // Convert to array and calculate averages
    const dailyStats = Object.values(dailyMetrics).map(day => ({
      date: day.date,
      total_refreshes: day.total_refreshes,
      successful: day.successful || 0,
      failed: day.failed || 0,
      success_rate: day.total_refreshes > 0 
        ? Math.round((day.successful / day.total_refreshes) * 100) 
        : 0,
      total_rows: day.total_rows,
      average_duration_minutes: day.total_refreshes > 0
        ? Math.round(day.total_duration_ms / day.total_refreshes / 60000)
        : 0,
      unique_tables: day.tables.size
    }))
    
    // Calculate table-specific metrics
    const tableMetrics: Record<string, any> = {}
    
    logs?.forEach(log => {
      const table = log.table_name
      
      if (!tableMetrics[table]) {
        tableMetrics[table] = {
          table_name: table,
          total_refreshes: 0,
          successful: 0,
          failed: 0,
          total_rows: 0,
          total_duration_ms: 0,
          last_refresh: null,
          last_status: null,
          average_rows_per_refresh: 0,
          errors: []
        }
      }
      
      tableMetrics[table].total_refreshes++
      tableMetrics[table][log.status]++
      
      if (log.rows_processed) {
        tableMetrics[table].total_rows += log.rows_processed
      }
      
      if (log.execution_time_ms) {
        tableMetrics[table].total_duration_ms += log.execution_time_ms
      }
      
      // Track most recent refresh
      if (!tableMetrics[table].last_refresh || 
          new Date(log.refresh_completed_at) > new Date(tableMetrics[table].last_refresh)) {
        tableMetrics[table].last_refresh = log.refresh_completed_at
        tableMetrics[table].last_status = log.status
      }
      
      // Track errors
      if (log.status === 'failed' && log.error_message) {
        tableMetrics[table].errors.push({
          timestamp: log.refresh_started_at,
          error: log.error_message
        })
      }
    })
    
    // Calculate table averages and success rates
    const tableStats = Object.values(tableMetrics).map(table => ({
      table_name: table.table_name,
      total_refreshes: table.total_refreshes,
      success_rate: table.total_refreshes > 0
        ? Math.round((table.successful / table.total_refreshes) * 100)
        : 0,
      average_duration_minutes: table.total_refreshes > 0
        ? Math.round(table.total_duration_ms / table.total_refreshes / 60000)
        : 0,
      average_rows_per_refresh: table.successful > 0
        ? Math.round(table.total_rows / table.successful)
        : 0,
      total_rows_processed: table.total_rows,
      last_refresh: table.last_refresh,
      last_status: table.last_status,
      recent_errors: table.errors.slice(-3) // Last 3 errors
    }))
    
    // Overall summary
    const summary = {
      period_days: days,
      total_refreshes: logs?.length || 0,
      successful: logs?.filter(l => l.status === 'success').length || 0,
      failed: logs?.filter(l => l.status === 'failed').length || 0,
      overall_success_rate: logs?.length 
        ? Math.round((logs.filter(l => l.status === 'success').length / logs.length) * 100)
        : 0,
      total_rows_processed: logs?.reduce((sum, log) => sum + (log.rows_processed || 0), 0) || 0,
      average_refresh_time_minutes: logs?.length
        ? Math.round(
            logs.reduce((sum, log) => sum + (log.execution_time_ms || 0), 0) / 
            logs.length / 
            60000
          )
        : 0,
      busiest_day: dailyStats.reduce((max, day) => 
        day.total_refreshes > (max?.total_refreshes || 0) ? day : max,
        dailyStats[0]
      ),
      most_failed_table: tableStats.reduce((max, table) =>
        (table.total_refreshes - table.success_rate) > 
        ((max?.total_refreshes || 0) - (max?.success_rate || 0)) ? table : max,
        tableStats[0]
      )
    }
    
    return NextResponse.json({
      summary,
      daily_metrics: dailyStats,
      table_metrics: tableStats.sort((a, b) => b.total_refreshes - a.total_refreshes),
      period: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
        days
      }
    })
    
  } catch (error) {
    console.error('Error fetching refresh metrics:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch refresh metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}