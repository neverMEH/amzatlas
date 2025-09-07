import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  order: vi.fn(() => mockSupabase),
  gte: vi.fn(() => mockSupabase),
  limit: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  data: null as any,
  error: null as any
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}))

// Types for refresh infrastructure analysis
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
  recommendation: 'keep' | 'remove' | 'add' | 'update_frequency'
}

// Infrastructure audit functions to be implemented
class RefreshInfrastructureAuditor {
  constructor(private supabase: any) {}

  async getCurrentRefreshConfig(): Promise<RefreshConfig[]> {
    const { data, error } = await this.supabase
      .from('refresh_config')
      .select('*')
      .order('priority', { ascending: false })
    
    if (error) throw error
    return data || []
  }

  async getRecentSyncActivity(daysBack: number = 30): Promise<SyncLogEntry[]> {
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()
    
    const { data, error } = await this.supabase
      .from('sync_log')
      .select('*')
      .gte('started_at', cutoffDate)
      .order('started_at', { ascending: false })
    
    if (error) throw error
    return data || []
  }

  async identifyCoreTables(): Promise<string[]> {
    // Core tables that drive the SQP Intelligence pipeline
    return [
      'asin_performance_data',
      'search_query_performance',
      'sync_log',
      'data_quality_checks',
      'brands',
      'asin_brand_mapping',
      'product_type_mapping'
    ]
  }

  async analyzeTableUsage(): Promise<TableUsageAnalysis[]> {
    const refreshConfigs = await this.getCurrentRefreshConfig()
    const syncActivity = await this.getRecentSyncActivity(30)
    const coreTables = await this.identifyCoreTables()
    
    const configuredTables = new Set(refreshConfigs.map(c => c.table_name))
    const activeTables = new Set(syncActivity.map(s => s.target_table))
    const coreTableSet = new Set(coreTables)
    
    const allTables = new Set([...configuredTables, ...activeTables, ...coreTableSet])
    
    return Array.from(allTables).map(tableName => {
      const config = refreshConfigs.find(c => c.table_name === tableName)
      const hasActivity = activeTables.has(tableName)
      const isCore = coreTableSet.has(tableName)
      
      let recommendation: TableUsageAnalysis['recommendation'] = 'keep'
      
      if (isCore && !configuredTables.has(tableName)) {
        recommendation = 'add'
      } else if (!isCore && !hasActivity && configuredTables.has(tableName)) {
        recommendation = 'remove'
      } else if (isCore && config && config.refresh_frequency_hours > 24) {
        recommendation = 'update_frequency'
      }
      
      return {
        table_name: tableName,
        schema: config?.table_schema || 'sqp',
        in_refresh_config: configuredTables.has(tableName),
        has_recent_activity: hasActivity,
        is_core_table: isCore,
        sync_frequency: config?.refresh_frequency_hours || 0,
        recommendation
      }
    })
  }

  async identifyStaleConfigurations(): Promise<RefreshConfig[]> {
    const configs = await this.getCurrentRefreshConfig()
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    return configs.filter(config => {
      // Consider stale if no refresh in 30+ days or never refreshed
      if (!config.last_refresh_at) return true
      
      const lastRefresh = new Date(config.last_refresh_at)
      return lastRefresh < thirtyDaysAgo
    })
  }

  async generateCleanupPlan(): Promise<{
    toRemove: string[]
    toAdd: TableUsageAnalysis[]
    toUpdate: TableUsageAnalysis[]
  }> {
    const analysis = await this.analyzeTableUsage()
    
    return {
      toRemove: analysis
        .filter(t => t.recommendation === 'remove')
        .map(t => t.table_name),
      toAdd: analysis.filter(t => t.recommendation === 'add'),
      toUpdate: analysis.filter(t => t.recommendation === 'update_frequency')
    }
  }
}

describe('Refresh Infrastructure Audit', () => {
  let auditor: RefreshInfrastructureAuditor
  
  beforeEach(() => {
    vi.clearAllMocks()
    auditor = new RefreshInfrastructureAuditor(mockSupabase)
  })

  describe('getCurrentRefreshConfig', () => {
    it('should fetch current refresh configurations ordered by priority', async () => {
      const mockConfigs: RefreshConfig[] = [
        {
          id: 1,
          table_schema: 'sqp',
          table_name: 'asin_performance_data',
          is_enabled: true,
          refresh_frequency_hours: 24,
          priority: 90,
          last_refresh_at: '2025-09-05T17:25:03.119Z',
          next_refresh_at: '2025-09-06T17:25:03.119Z'
        },
        {
          id: 2,
          table_schema: 'sqp',
          table_name: 'webhook_configs',
          is_enabled: true,
          refresh_frequency_hours: 24,
          priority: 100,
          last_refresh_at: null,
          next_refresh_at: '2025-09-06T16:27:10.285Z'
        }
      ]
      
      mockSupabase.data = mockConfigs
      mockSupabase.error = null
      
      const result = await auditor.getCurrentRefreshConfig()
      
      expect(mockSupabase.from).toHaveBeenCalledWith('refresh_config')
      expect(mockSupabase.select).toHaveBeenCalledWith('*')
      expect(mockSupabase.order).toHaveBeenCalledWith('priority', { ascending: false })
      expect(result).toEqual(mockConfigs)
    })

    it('should handle database errors gracefully', async () => {
      mockSupabase.error = new Error('Database connection failed')
      
      await expect(auditor.getCurrentRefreshConfig()).rejects.toThrow('Database connection failed')
    })
  })

  describe('getRecentSyncActivity', () => {
    it('should fetch recent sync log entries within specified days', async () => {
      const mockSyncLogs: SyncLogEntry[] = [
        {
          id: 1,
          sync_type: 'bigquery_sync',
          sync_status: 'success',
          started_at: '2025-09-05T10:00:00Z',
          completed_at: '2025-09-05T10:30:00Z',
          target_table: 'asin_performance_data',
          records_processed: 1000
        }
      ]
      
      mockSupabase.data = mockSyncLogs
      mockSupabase.error = null
      
      const result = await auditor.getRecentSyncActivity(7)
      
      expect(mockSupabase.from).toHaveBeenCalledWith('sync_log')
      expect(mockSupabase.select).toHaveBeenCalledWith('*')
      expect(mockSupabase.gte).toHaveBeenCalled()
      expect(result).toEqual(mockSyncLogs)
    })
  })

  describe('identifyCoreTables', () => {
    it('should return list of core tables for SQP Intelligence pipeline', async () => {
      const coreTables = await auditor.identifyCoreTables()
      
      expect(coreTables).toContain('asin_performance_data')
      expect(coreTables).toContain('search_query_performance')
      expect(coreTables).toContain('sync_log')
      expect(coreTables).toContain('data_quality_checks')
      expect(coreTables).toContain('brands')
      expect(coreTables).toContain('asin_brand_mapping')
      expect(coreTables).not.toContain('webhook_configs')
      expect(coreTables.length).toBeGreaterThan(5)
    })
  })

  describe('analyzeTableUsage', () => {
    it('should analyze table usage and provide recommendations', async () => {
      // Mock refresh config data
      const mockConfigs: RefreshConfig[] = [
        {
          id: 1,
          table_schema: 'sqp',
          table_name: 'asin_performance_data',
          is_enabled: true,
          refresh_frequency_hours: 24,
          priority: 90,
          last_refresh_at: '2025-09-05T17:25:03.119Z',
          next_refresh_at: '2025-09-06T17:25:03.119Z'
        },
        {
          id: 2,
          table_schema: 'sqp',
          table_name: 'webhook_configs',
          is_enabled: true,
          refresh_frequency_hours: 24,
          priority: 100,
          last_refresh_at: null,
          next_refresh_at: '2025-09-06T16:27:10.285Z'
        }
      ]

      // Mock sync activity data
      const mockSyncActivity: SyncLogEntry[] = [
        {
          id: 1,
          sync_type: 'bigquery_sync',
          sync_status: 'success',
          started_at: '2025-09-05T10:00:00Z',
          completed_at: '2025-09-05T10:30:00Z',
          target_table: 'asin_performance_data',
          records_processed: 1000
        }
      ]

      // Setup mocks for sequential calls
      let callCount = 0
      mockSupabase.data = null
      vi.mocked(mockSupabase.from).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // First call - getCurrentRefreshConfig
          mockSupabase.data = mockConfigs
        } else if (callCount === 2) {
          // Second call - getRecentSyncActivity
          mockSupabase.data = mockSyncActivity
        }
        return mockSupabase
      })

      const analysis = await auditor.analyzeTableUsage()
      
      expect(analysis).toBeInstanceOf(Array)
      expect(analysis.length).toBeGreaterThan(0)
      
      // Should recommend adding core table that's missing from config
      const addRecommendation = analysis.find(t => t.recommendation === 'add')
      expect(addRecommendation).toBeTruthy()
      
      // Should recommend removing non-core table with no activity
      const removeRecommendation = analysis.find(t => t.recommendation === 'remove')
      expect(removeRecommendation?.table_name).toBe('webhook_configs')
    })
  })

  describe('identifyStaleConfigurations', () => {
    it('should identify configurations that have not refreshed recently', async () => {
      const mockConfigs: RefreshConfig[] = [
        {
          id: 1,
          table_schema: 'sqp',
          table_name: 'active_table',
          is_enabled: true,
          refresh_frequency_hours: 24,
          priority: 90,
          last_refresh_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
          next_refresh_at: '2025-09-06T17:25:03.119Z'
        },
        {
          id: 2,
          table_schema: 'sqp',
          table_name: 'stale_table',
          is_enabled: true,
          refresh_frequency_hours: 24,
          priority: 100,
          last_refresh_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days ago
          next_refresh_at: '2025-09-06T16:27:10.285Z'
        },
        {
          id: 3,
          table_schema: 'sqp',
          table_name: 'never_refreshed',
          is_enabled: true,
          refresh_frequency_hours: 24,
          priority: 80,
          last_refresh_at: null,
          next_refresh_at: '2025-09-06T15:00:00.000Z'
        }
      ]
      
      mockSupabase.data = mockConfigs
      mockSupabase.error = null
      
      const staleConfigs = await auditor.identifyStaleConfigurations()
      
      expect(staleConfigs).toHaveLength(2)
      expect(staleConfigs.map(c => c.table_name)).toContain('stale_table')
      expect(staleConfigs.map(c => c.table_name)).toContain('never_refreshed')
      expect(staleConfigs.map(c => c.table_name)).not.toContain('active_table')
    })
  })

  describe('generateCleanupPlan', () => {
    it('should generate comprehensive cleanup plan with categorized actions', async () => {
      // Setup mock data for a realistic scenario
      const mockConfigs: RefreshConfig[] = [
        {
          id: 1,
          table_schema: 'sqp',
          table_name: 'asin_performance_data',
          is_enabled: true,
          refresh_frequency_hours: 24,
          priority: 90,
          last_refresh_at: '2025-09-05T17:25:03.119Z',
          next_refresh_at: '2025-09-06T17:25:03.119Z'
        },
        {
          id: 2,
          table_schema: 'sqp',
          table_name: 'webhook_configs',
          is_enabled: true,
          refresh_frequency_hours: 24,
          priority: 100,
          last_refresh_at: null,
          next_refresh_at: '2025-09-06T16:27:10.285Z'
        }
      ]

      const mockSyncActivity: SyncLogEntry[] = [
        {
          id: 1,
          sync_type: 'bigquery_sync',
          sync_status: 'success',
          started_at: '2025-09-05T10:00:00Z',
          completed_at: '2025-09-05T10:30:00Z',
          target_table: 'asin_performance_data',
          records_processed: 1000
        }
      ]

      let callCount = 0
      vi.mocked(mockSupabase.from).mockImplementation(() => {
        callCount++
        if (callCount <= 2) {
          mockSupabase.data = callCount === 1 ? mockConfigs : mockSyncActivity
        }
        return mockSupabase
      })

      const plan = await auditor.generateCleanupPlan()
      
      expect(plan).toHaveProperty('toRemove')
      expect(plan).toHaveProperty('toAdd')
      expect(plan).toHaveProperty('toUpdate')
      
      expect(plan.toRemove).toBeInstanceOf(Array)
      expect(plan.toAdd).toBeInstanceOf(Array)
      expect(plan.toUpdate).toBeInstanceOf(Array)
      
      // Should recommend removing webhook_configs (no activity, not core)
      expect(plan.toRemove).toContain('webhook_configs')
      
      // Should recommend adding missing core tables
      expect(plan.toAdd.length).toBeGreaterThan(0)
      expect(plan.toAdd.some(t => ['sync_log', 'brands', 'data_quality_checks'].includes(t.table_name))).toBe(true)
    })
  })
})