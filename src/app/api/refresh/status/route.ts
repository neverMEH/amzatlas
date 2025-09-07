import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Core tables that should be monitored (based on migration 048)
const CORE_TABLES = [
  { name: 'sync_log', priority: 99, schema: 'public' },
  { name: 'search_query_performance', priority: 95, schema: 'sqp' },
  { name: 'asin_performance_data', priority: 90, schema: 'sqp' },
  { name: 'data_quality_checks', priority: 80, schema: 'public' },
  { name: 'brands', priority: 75, schema: 'public' },
  { name: 'asin_brand_mapping', priority: 70, schema: 'public' },
  { name: 'product_type_mapping', priority: 65, schema: 'public' }
]

// Calculate freshness score based on last refresh time and frequency
function calculateFreshnessScore(lastRefresh: Date | null, frequencyHours: number): number {
  if (!lastRefresh) return 0
  
  const now = new Date()
  const hoursSinceRefresh = (now.getTime() - lastRefresh.getTime()) / (1000 * 60 * 60)
  const freshnessRatio = 1 - (hoursSinceRefresh / frequencyHours)
  
  return Math.max(0, Math.min(100, Math.round(freshnessRatio * 100)))
}

// Alert types
interface Alert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  type: string
  message: string
  table_name?: string
  details?: any
  timestamp: string
}

// Generate alerts based on system state
function generateAlerts(
  tables: any[], 
  stats: any, 
  syncLogs: any[],
  now: Date
): Alert[] {
  const alerts: Alert[] = []
  
  // Critical: Core tables failing
  const failingCoreTables = tables.filter(t => 
    t.is_core && 
    t.status === 'error' && 
    t.priority >= 80
  )
  
  if (failingCoreTables.length > 0) {
    failingCoreTables.forEach(table => {
      alerts.push({
        id: `core-table-error-${table.table_name}`,
        severity: 'critical',
        type: 'core_table_failure',
        message: `Critical table ${table.table_name} is failing`,
        table_name: table.table_name,
        details: {
          last_error: table.recent_error,
          priority: table.priority,
          hours_since_refresh: table.hours_until_refresh ? -table.hours_until_refresh : null
        },
        timestamp: now.toISOString()
      })
    })
  }
  
  // Critical: sync_log not updating (most important table)
  const syncLogTable = tables.find(t => t.table_name === 'sync_log')
  if (syncLogTable && syncLogTable.freshness_score < 50) {
    alerts.push({
      id: 'sync-log-stale',
      severity: 'critical',
      type: 'pipeline_monitoring_failure',
      message: 'Data pipeline monitoring (sync_log) is not updating',
      table_name: 'sync_log',
      details: {
        freshness_score: syncLogTable.freshness_score,
        last_refresh: syncLogTable.last_refresh
      },
      timestamp: now.toISOString()
    })
  }
  
  // Warning: High failure rate
  if (stats.failed_today > 5 && stats.successful_today > 0) {
    const failureRate = (stats.failed_today / (stats.failed_today + stats.successful_today)) * 100
    if (failureRate > 30) {
      alerts.push({
        id: 'high-failure-rate',
        severity: 'warning',
        type: 'high_failure_rate',
        message: `High sync failure rate: ${failureRate.toFixed(1)}%`,
        details: {
          failed_count: stats.failed_today,
          success_count: stats.successful_today,
          failure_rate: `${failureRate.toFixed(1)}%`
        },
        timestamp: now.toISOString()
      })
    }
  }
  
  // Warning: Multiple tables stale
  if (stats.stale_tables > 3) {
    const staleTableNames = tables
      .filter(t => t.is_stale)
      .map(t => t.table_name)
      .slice(0, 5)
    
    alerts.push({
      id: 'multiple-stale-tables',
      severity: 'warning',
      type: 'multiple_stale_tables',
      message: `${stats.stale_tables} tables are stale and need refresh`,
      details: {
        stale_count: stats.stale_tables,
        sample_tables: staleTableNames,
        total_tables: stats.total_tables
      },
      timestamp: now.toISOString()
    })
  }
  
  // Info: No recent sync activity
  if (syncLogs && syncLogs.length === 0) {
    const lastActivity = tables
      .filter(t => t.last_refresh)
      .sort((a, b) => new Date(b.last_refresh).getTime() - new Date(a.last_refresh).getTime())[0]
    
    alerts.push({
      id: 'no-recent-activity',
      severity: 'info',
      type: 'no_recent_activity',
      message: 'No sync activity detected in the last 24 hours',
      details: {
        last_known_refresh: lastActivity?.last_refresh,
        last_known_table: lastActivity?.table_name
      },
      timestamp: now.toISOString()
    })
  }
  
  // Critical: Data freshness issue for primary tables
  const primaryDataTables = tables.filter(t => 
    ['asin_performance_data', 'search_query_performance'].includes(t.table_name)
  )
  
  primaryDataTables.forEach(table => {
    if (table.freshness_score < 30) {
      alerts.push({
        id: `data-freshness-${table.table_name}`,
        severity: 'critical',
        type: 'data_freshness_critical',
        message: `Primary data table ${table.table_name} is critically out of date`,
        table_name: table.table_name,
        details: {
          freshness_score: table.freshness_score,
          last_refresh: table.last_refresh,
          expected_frequency_hours: table.frequency_hours
        },
        timestamp: now.toISOString()
      })
    }
  })
  
  return alerts
}

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get all refresh configurations, focusing on core tables
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
    
    // Get sync_log data for pipeline activity (last 24 hours)
    const { data: syncLogs, error: syncError } = await supabase
      .from('sync_log')
      .select('*')
      .gte('started_at', twentyFourHoursAgo)
      .order('started_at', { ascending: false })
      .limit(50)
      
    if (syncError) {
      console.error('Error fetching sync logs:', syncError)
      // Don't throw, just log - sync_log might not exist in all environments
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
      
      // Calculate freshness score
      const freshnessScore = calculateFreshnessScore(lastRefresh, config.refresh_frequency_hours)
      
      // Determine if this is a core table
      const isCore = CORE_TABLES.some(t => t.name === config.table_name && t.schema === config.table_schema)

      return {
        table_name: config.table_name,
        schema: config.table_schema,
        enabled: config.is_enabled,
        status,
        is_stale: isStale,
        is_core: isCore,
        last_refresh: config.last_refresh_at,
        next_refresh: config.next_refresh_at,
        hours_until_refresh: hoursUntilRefresh,
        frequency_hours: config.refresh_frequency_hours,
        priority: config.priority,
        freshness_score: freshnessScore,
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

    // Identify critical tables that need attention
    const criticalTables = tables.filter(t => {
      if (!t.enabled) return false
      
      const reasons = []
      if (t.is_stale && t.priority >= 80) reasons.push('stale high-priority table')
      if (t.status === 'overdue' && t.is_core) reasons.push('overdue core table')
      if (t.recent_error && t.is_core) reasons.push('core table with errors')
      if (t.freshness_score < 30 && t.priority >= 90) reasons.push('critical freshness')
      
      if (reasons.length > 0) {
        return { ...t, reason: reasons.join(', ') }
      }
      return false
    }).filter(Boolean)
    
    // Determine overall system status
    let overallStatus = 'healthy'
    if (criticalTables.length > 0 || stats.failed_today > 5) {
      overallStatus = 'error'
    } else if (stats.stale_tables > 0 || stats.overdue_tables > 0) {
      overallStatus = 'warning'
    }

    // Process recent activity from refresh logs
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
        error: log.error_message,
        source: 'refresh_log'
      }
    }) || []
    
    // Process pipeline activity from sync_log
    const pipelineActivity = syncLogs?.map(log => {
      const startTime = new Date(log.started_at)
      const endTime = log.completed_at ? new Date(log.completed_at) : null
      const durationMinutes = endTime 
        ? Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))
        : null
        
      return {
        id: log.id,
        operation_type: log.operation_type,
        table_name: log.table_name,
        status: log.status,
        started_at: log.started_at,
        completed_at: log.completed_at,
        duration_minutes: durationMinutes,
        records_processed: log.records_processed,
        error: log.error_message,
        source: 'sync_log'
      }
    }) || []

    // Generate alerts based on current system state
    const alerts = generateAlerts(tables, stats, syncLogs || [], now)
    
    // Update overall status if critical alerts exist
    const hasCriticalAlerts = alerts.some(a => a.severity === 'critical')
    if (hasCriticalAlerts && overallStatus !== 'error') {
      overallStatus = 'error'
    }
    
    return NextResponse.json({
      overall_status: overallStatus,
      statistics: stats,
      tables,
      recent_activity: recentActivity,
      pipeline_activity: pipelineActivity,
      critical_tables: criticalTables,
      alerts,
      alert_summary: {
        critical: alerts.filter(a => a.severity === 'critical').length,
        warning: alerts.filter(a => a.severity === 'warning').length,
        info: alerts.filter(a => a.severity === 'info').length
      },
      last_updated: now.toISOString(),
      core_tables_reference: CORE_TABLES
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