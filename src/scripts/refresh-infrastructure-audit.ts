#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config()

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Types
interface RefreshConfig {
  id: number
  table_schema: string
  table_name: string
  is_enabled: boolean
  refresh_frequency_hours: number
  priority: number
  last_refresh_at: string | null
  next_refresh_at: string | null
}

interface SyncLogEntry {
  id: number
  sync_type: string
  sync_status: string
  started_at: string
  completed_at: string | null
  target_table: string
  records_processed: number
}

interface TableUsageAnalysis {
  table_name: string
  schema: string
  in_refresh_config: boolean
  has_recent_activity: boolean
  is_core_table: boolean
  sync_frequency: number
  last_refresh_at: string | null
  recommendation: 'keep' | 'remove' | 'add' | 'update_frequency'
  reason: string
}

class RefreshInfrastructureAuditor {
  constructor(private supabase: ReturnType<typeof createClient>) {}

  async getCurrentRefreshConfig(): Promise<RefreshConfig[]> {
    console.log('📋 Fetching current refresh configurations...')
    
    const { data, error } = await this.supabase
      .from('refresh_config')
      .select('*')
      .order('priority', { ascending: false })
    
    if (error) {
      throw new Error(`Failed to fetch refresh config: ${error.message}`)
    }
    
    console.log(`✅ Found ${data?.length || 0} refresh configurations`)
    return data || []
  }

  async getRecentSyncActivity(daysBack: number = 30): Promise<SyncLogEntry[]> {
    console.log(`📊 Analyzing sync activity over the last ${daysBack} days...`)
    
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()
    
    const { data, error } = await this.supabase
      .from('sync_log')
      .select('*')
      .gte('started_at', cutoffDate)
      .order('started_at', { ascending: false })
    
    if (error) {
      throw new Error(`Failed to fetch sync activity: ${error.message}`)
    }
    
    console.log(`✅ Found ${data?.length || 0} sync operations`)
    return data || []
  }

  async identifyCoreTables(): Promise<string[]> {
    // Core tables that drive the SQP Intelligence pipeline
    return [
      'asin_performance_data',      // Main ASIN performance data
      'search_query_performance',   // Detailed search query metrics
      'sync_log',                   // Tracks data synchronization
      'data_quality_checks',        // Data quality validation
      'brands',                     // Brand master data
      'asin_brand_mapping',         // ASIN to brand mappings
      'product_type_mapping',       // Product categorization
      'report_configurations',      // Report system configs
      'report_execution_history'    // Report generation history
    ]
  }

  async analyzeTableUsage(): Promise<TableUsageAnalysis[]> {
    console.log('🔍 Analyzing table usage patterns...')
    
    const [refreshConfigs, syncActivity, coreTables] = await Promise.all([
      this.getCurrentRefreshConfig(),
      this.getRecentSyncActivity(30),
      this.identifyCoreTables()
    ])
    
    const configuredTables = new Map(refreshConfigs.map(c => [c.table_name, c]))
    const activeTables = new Set(syncActivity.map(s => s.target_table))
    const coreTableSet = new Set(coreTables)
    
    // Get all unique table names
    const allTables = new Set([
      ...configuredTables.keys(),
      ...activeTables,
      ...coreTableSet
    ])
    
    const analysis: TableUsageAnalysis[] = Array.from(allTables).map(tableName => {
      const config = configuredTables.get(tableName)
      const hasActivity = activeTables.has(tableName)
      const isCore = coreTableSet.has(tableName)
      
      let recommendation: TableUsageAnalysis['recommendation'] = 'keep'
      let reason = 'Table is properly configured and active'
      
      if (isCore && !config) {
        recommendation = 'add'
        reason = 'Core table missing from refresh configuration'
      } else if (!isCore && !hasActivity && config) {
        recommendation = 'remove'
        reason = 'Non-core table with no recent activity'
      } else if (isCore && config && config.refresh_frequency_hours > 24) {
        recommendation = 'update_frequency'
        reason = 'Core table should refresh more frequently than 24 hours'
      } else if (config && !config.last_refresh_at) {
        if (isCore) {
          recommendation = 'update_frequency'
          reason = 'Core table has never been refreshed - needs immediate attention'
        } else {
          recommendation = 'remove'
          reason = 'Table configured but never refreshed - likely obsolete'
        }
      }
      
      return {
        table_name: tableName,
        schema: config?.table_schema || 'sqp',
        in_refresh_config: !!config,
        has_recent_activity: hasActivity,
        is_core_table: isCore,
        sync_frequency: config?.refresh_frequency_hours || 0,
        last_refresh_at: config?.last_refresh_at || null,
        recommendation,
        reason
      }
    })
    
    console.log(`✅ Analyzed ${analysis.length} tables`)
    return analysis.sort((a, b) => {
      // Sort by: core tables first, then by recommendation priority
      if (a.is_core_table !== b.is_core_table) return a.is_core_table ? -1 : 1
      const priorityOrder = { 'add': 0, 'update_frequency': 1, 'remove': 2, 'keep': 3 }
      return priorityOrder[a.recommendation] - priorityOrder[b.recommendation]
    })
  }

  async identifyStaleConfigurations(): Promise<RefreshConfig[]> {
    console.log('🕰️ Identifying stale configurations...')
    
    const configs = await this.getCurrentRefreshConfig()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    const stale = configs.filter(config => {
      // Consider stale if no refresh in 30+ days or never refreshed
      if (!config.last_refresh_at) return true
      
      const lastRefresh = new Date(config.last_refresh_at)
      return lastRefresh < thirtyDaysAgo
    })
    
    console.log(`⚠️ Found ${stale.length} stale configurations`)
    return stale
  }

  async generateReport(): Promise<void> {
    console.log('\n🔍 REFRESH INFRASTRUCTURE AUDIT REPORT')
    console.log('=====================================\n')
    
    try {
      const analysis = await this.analyzeTableUsage()
      const staleConfigs = await this.identifyStaleConfigurations()
      
      // Summary statistics
      const stats = {
        total_tables: analysis.length,
        core_tables: analysis.filter(t => t.is_core_table).length,
        configured_tables: analysis.filter(t => t.in_refresh_config).length,
        active_tables: analysis.filter(t => t.has_recent_activity).length,
        stale_configs: staleConfigs.length
      }
      
      console.log('📊 SUMMARY STATISTICS')
      console.log('--------------------')
      console.log(`Total tables analyzed: ${stats.total_tables}`)
      console.log(`Core tables identified: ${stats.core_tables}`)
      console.log(`Tables in refresh_config: ${stats.configured_tables}`)
      console.log(`Tables with recent activity: ${stats.active_tables}`)
      console.log(`Stale configurations: ${stats.stale_configs}`)
      
      // Recommendations by category
      const recommendations = {
        add: analysis.filter(t => t.recommendation === 'add'),
        remove: analysis.filter(t => t.recommendation === 'remove'),
        update_frequency: analysis.filter(t => t.recommendation === 'update_frequency'),
        keep: analysis.filter(t => t.recommendation === 'keep')
      }
      
      console.log('\n🎯 RECOMMENDATIONS SUMMARY')
      console.log('---------------------------')
      console.log(`Tables to ADD to monitoring: ${recommendations.add.length}`)
      console.log(`Tables to REMOVE from monitoring: ${recommendations.remove.length}`)
      console.log(`Tables needing frequency UPDATE: ${recommendations.update_frequency.length}`)
      console.log(`Tables to KEEP as-is: ${recommendations.keep.length}`)
      
      // Detailed recommendations
      if (recommendations.add.length > 0) {
        console.log('\n➕ TABLES TO ADD TO REFRESH_CONFIG')
        console.log('----------------------------------')
        recommendations.add.forEach(table => {
          console.log(`  • ${table.table_name} (${table.schema})`)
          console.log(`    Reason: ${table.reason}`)
          console.log(`    Suggested frequency: ${table.is_core_table ? '6-12 hours' : '24 hours'}`)
          console.log('')
        })
      }
      
      if (recommendations.remove.length > 0) {
        console.log('\n➖ TABLES TO REMOVE FROM REFRESH_CONFIG')
        console.log('---------------------------------------')
        recommendations.remove.forEach(table => {
          console.log(`  • ${table.table_name} (${table.schema})`)
          console.log(`    Reason: ${table.reason}`)
          console.log(`    Last refresh: ${table.last_refresh_at || 'Never'}`)
          console.log('')
        })
      }
      
      if (recommendations.update_frequency.length > 0) {
        console.log('\n🔄 TABLES NEEDING FREQUENCY UPDATES')
        console.log('-----------------------------------')
        recommendations.update_frequency.forEach(table => {
          console.log(`  • ${table.table_name} (${table.schema})`)
          console.log(`    Current frequency: ${table.sync_frequency} hours`)
          console.log(`    Reason: ${table.reason}`)
          console.log(`    Suggested frequency: ${table.is_core_table ? '6-12 hours' : '24 hours'}`)
          console.log('')
        })
      }
      
      // Stale configurations detail
      if (staleConfigs.length > 0) {
        console.log('\n🕰️ STALE CONFIGURATIONS DETAIL')
        console.log('-------------------------------')
        staleConfigs.forEach(config => {
          const daysSinceRefresh = config.last_refresh_at 
            ? Math.floor((Date.now() - new Date(config.last_refresh_at).getTime()) / (1000 * 60 * 60 * 24))
            : 'Never'
          
          console.log(`  • ${config.table_name} (${config.table_schema})`)
          console.log(`    Days since last refresh: ${daysSinceRefresh}`)
          console.log(`    Priority: ${config.priority}`)
          console.log(`    Frequency: ${config.refresh_frequency_hours} hours`)
          console.log('')
        })
      }
      
      console.log('\n✅ AUDIT COMPLETE')
      console.log('=================')
      console.log('Next steps:')
      console.log('1. Review recommendations above')
      console.log('2. Run cleanup migration to implement changes')
      console.log('3. Update refresh monitor UI to focus on core tables')
      console.log('4. Set up proper monitoring for data pipeline health')
      
    } catch (error) {
      console.error('❌ Audit failed:', error)
      process.exit(1)
    }
  }
}

async function main() {
  console.log('🚀 Starting Refresh Infrastructure Audit...\n')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const auditor = new RefreshInfrastructureAuditor(supabase)
  
  await auditor.generateReport()
}

if (require.main === module) {
  main().catch(console.error)
}

export { RefreshInfrastructureAuditor }