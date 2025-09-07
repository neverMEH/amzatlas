import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Core tables categorization
const TABLE_CATEGORIES = {
  data_pipeline: {
    name: 'Data Pipeline',
    tables: ['sync_log', 'data_quality_checks'],
    priority: 100
  },
  core_data: {
    name: 'Core Data',
    tables: ['asin_performance_data', 'search_query_performance'],
    priority: 90
  },
  brand_management: {
    name: 'Brand Management',
    tables: ['brands', 'asin_brand_mapping', 'product_type_mapping'],
    priority: 70
  },
  reporting: {
    name: 'Reporting',
    tables: ['report_configurations', 'report_execution_history'],
    priority: 50
  },
  deprecated: {
    name: 'Deprecated',
    tables: ['weekly_summary', 'monthly_summary', 'quarterly_summary', 'yearly_summary'],
    priority: 10
  }
}

interface TableMetrics {
  table_name: string
  schema: string
  category: string
  status: 'active' | 'stale' | 'error' | 'disabled'
  health_score: number
  metrics: {
    last_refresh: string | null
    next_refresh: string | null
    refresh_frequency_hours: number
    rows_count?: number
    avg_refresh_duration_minutes?: number
    success_rate_7d?: number
    last_error?: string
    data_freshness_hours?: number
  }
  trends: {
    refresh_times: Array<{ date: string; duration_minutes: number }>
    success_rate: Array<{ date: string; rate: number }>
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const tableName = searchParams.get('table')
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get all table configurations
    const { data: configs, error: configError } = await supabase
      .from('refresh_config')
      .select('*')
    
    if (configError) {
      throw new Error(configError.message)
    }
    
    // Get sync logs for the past 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: syncLogs, error: syncError } = await supabase
      .from('sync_log')
      .select('*')
      .gte('started_at', sevenDaysAgo)
      .order('started_at', { ascending: false })
    
    if (syncError) {
      console.error('Error fetching sync logs:', syncError)
    }
    
    // Get refresh audit logs for the past 7 days
    const { data: auditLogs, error: auditError } = await supabase
      .from('refresh_audit_log')
      .select('*')
      .gte('refresh_started_at', sevenDaysAgo)
      .order('refresh_started_at', { ascending: false })
    
    if (auditError) {
      console.error('Error fetching audit logs:', auditError)
    }
    
    // Get table row counts (sample from key tables)
    const tableCounts: Record<string, number> = {}
    for (const cat of Object.values(TABLE_CATEGORIES)) {
      if (cat.priority >= 70) { // Only check important tables
        for (const table of cat.tables) {
          try {
            const { count } = await supabase
              .from(table)
              .select('*', { count: 'exact', head: true })
            
            if (count !== null) {
              tableCounts[table] = count
            }
          } catch (e) {
            // Table might not exist in this environment
            console.log(`Could not get count for ${table}`)
          }
        }
      }
    }
    
    // Process table metrics
    const tableMetrics: TableMetrics[] = []
    
    for (const config of configs || []) {
      // Find category
      let tableCategory = 'other'
      let categoryPriority = 0
      
      for (const [catKey, catValue] of Object.entries(TABLE_CATEGORIES)) {
        if (catValue.tables.includes(config.table_name)) {
          tableCategory = catKey
          categoryPriority = catValue.priority
          break
        }
      }
      
      // Skip if filtering by category and doesn't match
      if (category && tableCategory !== category) continue
      
      // Skip if filtering by specific table and doesn't match
      if (tableName && config.table_name !== tableName) continue
      
      // Calculate metrics
      const tableSyncLogs = syncLogs?.filter(log => log.table_name === config.table_name) || []
      const tableAuditLogs = auditLogs?.filter(log => 
        log.table_name === config.table_name && log.table_schema === config.table_schema
      ) || []
      
      // Combine logs for metrics
      const allLogs = [
        ...tableSyncLogs.map(log => ({
          started_at: log.started_at,
          completed_at: log.completed_at,
          status: log.status,
          error: log.error_message,
          source: 'sync_log'
        })),
        ...tableAuditLogs.map(log => ({
          started_at: log.refresh_started_at,
          completed_at: log.refresh_completed_at,
          status: log.status,
          error: log.error_message,
          source: 'audit_log'
        }))
      ].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      
      // Calculate success rate
      const successfulLogs = allLogs.filter(log => log.status === 'success').length
      const successRate = allLogs.length > 0 ? (successfulLogs / allLogs.length) * 100 : null
      
      // Calculate average duration
      const durationsMinutes = allLogs
        .filter(log => log.completed_at && log.status === 'success')
        .map(log => {
          const start = new Date(log.started_at).getTime()
          const end = new Date(log.completed_at!).getTime()
          return Math.round((end - start) / (1000 * 60))
        })
        .filter(d => d > 0)
      
      const avgDuration = durationsMinutes.length > 0
        ? Math.round(durationsMinutes.reduce((a, b) => a + b) / durationsMinutes.length)
        : undefined
      
      // Get last error
      const lastError = allLogs.find(log => log.status === 'failed')?.error
      
      // Calculate data freshness
      let dataFreshnessHours: number | undefined
      if (config.last_refresh_at) {
        dataFreshnessHours = Math.round(
          (new Date().getTime() - new Date(config.last_refresh_at).getTime()) / (1000 * 60 * 60)
        )
      }
      
      // Determine status
      let status: TableMetrics['status'] = 'active'
      if (!config.is_enabled) {
        status = 'disabled'
      } else if (lastError && allLogs[0]?.status === 'failed') {
        status = 'error'
      } else if (dataFreshnessHours && dataFreshnessHours > config.refresh_frequency_hours * 1.5) {
        status = 'stale'
      }
      
      // Calculate health score
      let healthScore = 100
      if (status === 'disabled') healthScore = 0
      else if (status === 'error') healthScore = 20
      else if (status === 'stale') healthScore = 50
      else if (successRate !== null) {
        healthScore = Math.round(successRate * 0.7 + (status === 'active' ? 30 : 0))
      }
      
      // Build trends data
      const refreshTimes = allLogs
        .filter(log => log.completed_at && log.status === 'success')
        .slice(0, 10)
        .map(log => ({
          date: log.started_at,
          duration_minutes: Math.round(
            (new Date(log.completed_at!).getTime() - new Date(log.started_at).getTime()) / (1000 * 60)
          )
        }))
      
      // Daily success rates for the past 7 days
      const dailyRates: Array<{ date: string; rate: number }> = []
      for (let i = 0; i < 7; i++) {
        const dayStart = new Date()
        dayStart.setDate(dayStart.getDate() - i)
        dayStart.setHours(0, 0, 0, 0)
        
        const dayEnd = new Date(dayStart)
        dayEnd.setDate(dayEnd.getDate() + 1)
        
        const dayLogs = allLogs.filter(log => {
          const logDate = new Date(log.started_at)
          return logDate >= dayStart && logDate < dayEnd
        })
        
        if (dayLogs.length > 0) {
          const daySuccess = dayLogs.filter(log => log.status === 'success').length
          dailyRates.push({
            date: dayStart.toISOString(),
            rate: Math.round((daySuccess / dayLogs.length) * 100)
          })
        }
      }
      
      tableMetrics.push({
        table_name: config.table_name,
        schema: config.table_schema,
        category: TABLE_CATEGORIES[tableCategory as keyof typeof TABLE_CATEGORIES]?.name || 'Other',
        status,
        health_score: healthScore,
        metrics: {
          last_refresh: config.last_refresh_at,
          next_refresh: config.next_refresh_at,
          refresh_frequency_hours: config.refresh_frequency_hours,
          rows_count: tableCounts[config.table_name],
          avg_refresh_duration_minutes: avgDuration,
          success_rate_7d: successRate !== null ? Math.round(successRate) : undefined,
          last_error: lastError,
          data_freshness_hours: dataFreshnessHours
        },
        trends: {
          refresh_times: refreshTimes,
          success_rate: dailyRates
        }
      })
    }
    
    // Sort by priority (category priority, then health score)
    tableMetrics.sort((a, b) => {
      const aCatPriority = Object.entries(TABLE_CATEGORIES)
        .find(([_, cat]) => cat.name === a.category)?.[1].priority || 0
      const bCatPriority = Object.entries(TABLE_CATEGORIES)
        .find(([_, cat]) => cat.name === b.category)?.[1].priority || 0
      
      if (aCatPriority !== bCatPriority) {
        return bCatPriority - aCatPriority
      }
      return b.health_score - a.health_score
    })
    
    // Group by category if no specific table requested
    const response: any = {
      tables: tableMetrics,
      summary: {
        total_tables: tableMetrics.length,
        by_status: {
          active: tableMetrics.filter(t => t.status === 'active').length,
          stale: tableMetrics.filter(t => t.status === 'stale').length,
          error: tableMetrics.filter(t => t.status === 'error').length,
          disabled: tableMetrics.filter(t => t.status === 'disabled').length
        },
        avg_health_score: Math.round(
          tableMetrics.reduce((sum, t) => sum + t.health_score, 0) / tableMetrics.length
        )
      }
    }
    
    // Add category grouping if not filtering by specific table
    if (!tableName) {
      response.categories = Object.entries(TABLE_CATEGORIES).map(([key, cat]) => {
        const categoryTables = tableMetrics.filter(t => t.category === cat.name)
        return {
          key,
          name: cat.name,
          priority: cat.priority,
          table_count: categoryTables.length,
          avg_health_score: categoryTables.length > 0
            ? Math.round(categoryTables.reduce((sum, t) => sum + t.health_score, 0) / categoryTables.length)
            : 0
        }
      }).filter(cat => cat.table_count > 0)
    }
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('Error fetching table metrics:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch table metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}