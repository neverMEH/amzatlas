import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Health score thresholds
const HEALTH_THRESHOLDS = {
  critical_tables_max: 0,    // No critical tables should be failing
  stale_percentage_max: 20,  // Max 20% of tables can be stale
  failure_rate_max: 10,      // Max 10% failure rate
  sync_lag_hours_max: 48,    // Max 48 hours since last successful sync
}

interface HealthCheck {
  name: string
  status: 'pass' | 'warn' | 'fail'
  message: string
  details?: any
}

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const now = new Date()
    const healthChecks: HealthCheck[] = []
    
    // Check 1: Database connectivity
    const { data: configTest, error: configError } = await supabase
      .from('refresh_config')
      .select('count')
      .limit(1)
    
    healthChecks.push({
      name: 'database_connectivity',
      status: configError ? 'fail' : 'pass',
      message: configError ? 'Database connection failed' : 'Database connection successful',
      details: configError ? { error: configError.message } : undefined
    })
    
    if (configError) {
      // If we can't connect to database, return early with critical status
      return NextResponse.json({
        status: 'critical',
        health_score: 0,
        checks: healthChecks,
        timestamp: now.toISOString()
      }, { status: 503 })
    }
    
    // Get refresh configurations
    const { data: configs, error: configsError } = await supabase
      .from('refresh_config')
      .select('*')
      .eq('is_enabled', true)
    
    if (configsError) {
      healthChecks.push({
        name: 'refresh_config_access',
        status: 'fail',
        message: 'Failed to access refresh configurations',
        details: { error: configsError.message }
      })
    }
    
    // Check 2: Core tables configuration
    const coreTableNames = [
      'sync_log', 'search_query_performance', 'asin_performance_data',
      'data_quality_checks', 'brands', 'asin_brand_mapping'
    ]
    
    const configuredCoreTables = configs?.filter(c => 
      coreTableNames.includes(c.table_name)
    ) || []
    
    healthChecks.push({
      name: 'core_tables_configured',
      status: configuredCoreTables.length >= 4 ? 'pass' : 'warn',
      message: `${configuredCoreTables.length} of ${coreTableNames.length} core tables configured`,
      details: {
        configured: configuredCoreTables.map(c => c.table_name),
        missing: coreTableNames.filter(name => 
          !configuredCoreTables.some(c => c.table_name === name)
        )
      }
    })
    
    // Check 3: Recent sync activity
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recentSyncs, error: syncError } = await supabase
      .from('sync_log')
      .select('*')
      .gte('started_at', twentyFourHoursAgo)
      .order('started_at', { ascending: false })
    
    const syncActivityCheck: HealthCheck = {
      name: 'sync_activity',
      status: 'pass',
      message: 'Sync activity is normal'
    }
    
    if (syncError) {
      syncActivityCheck.status = 'warn'
      syncActivityCheck.message = 'Could not check sync activity'
      syncActivityCheck.details = { error: syncError.message }
    } else if (!recentSyncs || recentSyncs.length === 0) {
      syncActivityCheck.status = 'fail'
      syncActivityCheck.message = 'No sync activity in the last 24 hours'
    } else {
      const successfulSyncs = recentSyncs.filter(s => s.status === 'success').length
      const failureRate = ((recentSyncs.length - successfulSyncs) / recentSyncs.length) * 100
      
      if (failureRate > HEALTH_THRESHOLDS.failure_rate_max) {
        syncActivityCheck.status = 'fail'
        syncActivityCheck.message = `High sync failure rate: ${failureRate.toFixed(1)}%`
      }
      
      syncActivityCheck.details = {
        total_syncs: recentSyncs.length,
        successful: successfulSyncs,
        failed: recentSyncs.length - successfulSyncs,
        failure_rate: `${failureRate.toFixed(1)}%`
      }
    }
    
    healthChecks.push(syncActivityCheck)
    
    // Check 4: Data freshness
    const { data: latestData } = await supabase
      .from('asin_performance_data')
      .select('start_date')
      .order('start_date', { ascending: false })
      .limit(1)
    
    const dataFreshnessCheck: HealthCheck = {
      name: 'data_freshness',
      status: 'pass',
      message: 'Data is up to date'
    }
    
    if (latestData && latestData.length > 0) {
      const latestDate = new Date(latestData[0].start_date)
      const daysSinceLatest = (now.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24)
      
      if (daysSinceLatest > 7) {
        dataFreshnessCheck.status = 'fail'
        dataFreshnessCheck.message = `Data is ${Math.floor(daysSinceLatest)} days old`
      } else if (daysSinceLatest > 3) {
        dataFreshnessCheck.status = 'warn'
        dataFreshnessCheck.message = `Data is ${Math.floor(daysSinceLatest)} days old`
      }
      
      dataFreshnessCheck.details = {
        latest_data_date: latestData[0].start_date,
        days_old: Math.floor(daysSinceLatest)
      }
    } else {
      dataFreshnessCheck.status = 'fail'
      dataFreshnessCheck.message = 'No data found in core tables'
    }
    
    healthChecks.push(dataFreshnessCheck)
    
    // Check 5: Stale tables
    const staleConfigs = configs?.filter(c => {
      if (!c.last_refresh_at) return true
      const hoursSinceRefresh = (now.getTime() - new Date(c.last_refresh_at).getTime()) / (1000 * 60 * 60)
      return hoursSinceRefresh > (c.refresh_frequency_hours * 1.5)
    }) || []
    
    const stalePercentage = configs ? (staleConfigs.length / configs.length) * 100 : 0
    
    healthChecks.push({
      name: 'stale_tables',
      status: stalePercentage > HEALTH_THRESHOLDS.stale_percentage_max ? 'warn' : 'pass',
      message: `${staleConfigs.length} stale tables (${stalePercentage.toFixed(1)}%)`,
      details: {
        stale_tables: staleConfigs.map(c => c.table_name),
        threshold: `${HEALTH_THRESHOLDS.stale_percentage_max}%`
      }
    })
    
    // Check 6: Pipeline health views
    const { data: pipelineHealth } = await supabase
      .from('pipeline_health')
      .select('*')
      .limit(1)
    
    if (pipelineHealth && pipelineHealth.length > 0) {
      const health = pipelineHealth[0]
      healthChecks.push({
        name: 'pipeline_metrics',
        status: health.sync_success_rate >= 90 ? 'pass' : health.sync_success_rate >= 75 ? 'warn' : 'fail',
        message: `Pipeline success rate: ${health.sync_success_rate?.toFixed(1)}%`,
        details: {
          tables_synced_24h: health.tables_synced_24h,
          records_processed_24h: health.total_records_24h,
          avg_sync_duration_minutes: health.avg_sync_duration_minutes
        }
      })
    }
    
    // Calculate overall health score
    const scores = {
      pass: 100,
      warn: 70,
      fail: 0
    }
    
    const totalScore = healthChecks.reduce((sum, check) => sum + scores[check.status], 0)
    const healthScore = Math.round(totalScore / healthChecks.length)
    
    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'critical'
    if (healthScore >= 90) {
      overallStatus = 'healthy'
    } else if (healthScore >= 60) {
      overallStatus = 'degraded'
    } else {
      overallStatus = 'critical'
    }
    
    // Add recommendations
    const recommendations = []
    
    if (staleConfigs.length > 0) {
      recommendations.push({
        type: 'refresh_stale_tables',
        priority: 'high',
        message: 'Trigger refresh for stale tables',
        tables: staleConfigs.map(c => c.table_name)
      })
    }
    
    const failedChecks = healthChecks.filter(c => c.status === 'fail')
    if (failedChecks.length > 0) {
      recommendations.push({
        type: 'investigate_failures',
        priority: 'critical',
        message: 'Investigate and fix failing health checks',
        checks: failedChecks.map(c => c.name)
      })
    }
    
    return NextResponse.json({
      status: overallStatus,
      health_score: healthScore,
      checks: healthChecks,
      recommendations,
      timestamp: now.toISOString(),
      thresholds: HEALTH_THRESHOLDS
    })
    
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json({
      status: 'critical',
      health_score: 0,
      checks: [{
        name: 'system_error',
        status: 'fail',
        message: 'Health check system error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      }],
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}