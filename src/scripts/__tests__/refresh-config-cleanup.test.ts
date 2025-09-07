import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  delete: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  in: vi.fn(() => mockSupabase),
  order: vi.fn(() => mockSupabase),
  single: vi.fn(() => mockSupabase),
  data: null as any,
  error: null as any
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}))

// Types for refresh configuration
interface RefreshConfig {
  id?: number
  table_schema: string
  table_name: string
  is_enabled: boolean
  refresh_frequency_hours: number
  priority: number
  last_refresh_at?: string | null
  next_refresh_at?: string | null
  custom_sync_params?: Record<string, any>
  dependencies?: string[]
}

interface CleanupResult {
  removed: string[]
  added: string[]
  updated: string[]
  errors: string[]
}

// Refresh configuration cleanup implementation
class RefreshConfigurationCleaner {
  constructor(private supabase: any) {}

  async performCleanup(): Promise<CleanupResult> {
    const result: CleanupResult = {
      removed: [],
      added: [],
      updated: [],
      errors: []
    }

    try {
      // Step 1: Remove obsolete tables
      await this.removeObsoleteTables(result)
      
      // Step 2: Update existing core tables
      await this.updateCoreTables(result)
      
      // Step 3: Add missing critical tables
      await this.addCriticalTables(result)
      
      // Step 4: Setup dependencies
      await this.setupDependencies()
      
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
    }

    return result
  }

  private async removeObsoleteTables(result: CleanupResult): Promise<void> {
    const obsoleteTables = [
      'webhook_configs',
      'webhook_deliveries',
      'monthly_summary',
      'quarterly_summary',
      'weekly_summary',
      'yearly_summary',
      'daily_sqp_data',
      'search_performance_summary'
    ]

    // First handle foreign key constraints
    const { data: configs } = await this.supabase
      .from('refresh_config')
      .select('id, table_name')
      .in('table_name', obsoleteTables)

    if (configs && configs.length > 0) {
      const configIds = configs.map((c: any) => c.id)
      
      // Update audit logs to remove foreign key references
      await this.supabase
        .from('refresh_audit_log')
        .update({ refresh_config_id: null })
        .in('refresh_config_id', configIds)

      // Remove dependencies
      await this.supabase
        .from('refresh_dependencies')
        .delete()
        .or(`parent_config_id.in.(${configIds.join(',')}),dependent_config_id.in.(${configIds.join(',')})`)
    }

    // Now safe to delete
    const { data: deleted } = await this.supabase
      .from('refresh_config')
      .delete()
      .in('table_name', obsoleteTables)
      .select('table_name')

    if (deleted) {
      result.removed = deleted.map((d: any) => d.table_name)
    }
  }

  private async updateCoreTables(result: CleanupResult): Promise<void> {
    // Update search_query_performance priority and frequency
    const { error: sqpError } = await this.supabase
      .from('refresh_config')
      .update({ 
        priority: 95, 
        refresh_frequency_hours: 12 
      })
      .eq('table_name', 'search_query_performance')

    if (!sqpError) {
      result.updated.push('search_query_performance')
    }

    // Update asin_performance_data priority
    const { error: asinError } = await this.supabase
      .from('refresh_config')
      .update({ 
        priority: 90, 
        refresh_frequency_hours: 24 
      })
      .eq('table_name', 'asin_performance_data')

    if (!asinError) {
      result.updated.push('asin_performance_data')
    }
  }

  private async addCriticalTables(result: CleanupResult): Promise<void> {
    const criticalTables: RefreshConfig[] = [
      {
        table_schema: 'sqp',
        table_name: 'sync_log',
        is_enabled: true,
        refresh_frequency_hours: 6,
        priority: 99,
        custom_sync_params: {
          monitor_type: 'pipeline_health',
          alert_on_failure: true
        },
        dependencies: []
      },
      {
        table_schema: 'sqp',
        table_name: 'data_quality_checks',
        is_enabled: true,
        refresh_frequency_hours: 8,
        priority: 95,
        custom_sync_params: {
          monitor_type: 'data_quality',
          alert_on_threshold: true
        },
        dependencies: ['sync_log']
      },
      {
        table_schema: 'sqp',
        table_name: 'brands',
        is_enabled: true,
        refresh_frequency_hours: 24,
        priority: 80,
        custom_sync_params: {
          monitor_type: 'business_data'
        },
        dependencies: []
      },
      {
        table_schema: 'sqp',
        table_name: 'asin_brand_mapping',
        is_enabled: true,
        refresh_frequency_hours: 24,
        priority: 78,
        custom_sync_params: {
          monitor_type: 'business_data'
        },
        dependencies: ['brands']
      },
      {
        table_schema: 'sqp',
        table_name: 'product_type_mapping',
        is_enabled: true,
        refresh_frequency_hours: 48,
        priority: 75,
        custom_sync_params: {
          monitor_type: 'reference_data'
        },
        dependencies: []
      }
    ]

    for (const table of criticalTables) {
      // Check if table already exists
      const { data: existing } = await this.supabase
        .from('refresh_config')
        .select('id')
        .eq('table_name', table.table_name)
        .single()

      if (!existing) {
        const { error } = await this.supabase
          .from('refresh_config')
          .insert({
            ...table,
            next_refresh_at: new Date(Date.now() + table.refresh_frequency_hours * 60 * 60 * 1000).toISOString()
          })

        if (!error) {
          result.added.push(table.table_name)
        }
      }
    }
  }

  private async setupDependencies(): Promise<void> {
    // Clear existing dependencies
    await this.supabase.from('refresh_dependencies').delete()

    // Get config IDs for dependency setup
    const { data: configs } = await this.supabase
      .from('refresh_config')
      .select('id, table_name')

    if (!configs) return

    const configMap = new Map(configs.map((c: any) => [c.table_name, c.id]))

    // Define dependencies
    const dependencies = [
      { parent: 'sync_log', children: ['data_quality_checks', 'asin_performance_data', 'search_query_performance'] },
      { parent: 'brands', children: ['asin_brand_mapping'] }
    ]

    for (const dep of dependencies) {
      const parentId = configMap.get(dep.parent)
      if (!parentId) continue

      for (const child of dep.children) {
        const childId = configMap.get(child)
        if (!childId) continue

        await this.supabase
          .from('refresh_dependencies')
          .insert({
            parent_config_id: parentId,
            dependent_config_id: childId,
            dependency_type: 'hard'
          })
      }
    }
  }

  async validateCleanup(): Promise<{
    isValid: boolean
    issues: string[]
  }> {
    const issues: string[] = []

    // Check that obsolete tables are removed
    const { data: remaining } = await this.supabase
      .from('refresh_config')
      .select('table_name')
      .in('table_name', [
        'webhook_configs', 'webhook_deliveries',
        'monthly_summary', 'quarterly_summary',
        'weekly_summary', 'yearly_summary',
        'daily_sqp_data', 'search_performance_summary'
      ])

    if (remaining && remaining.length > 0) {
      issues.push(`Obsolete tables still present: ${remaining.map((r: any) => r.table_name).join(', ')}`)
    }

    // Check that critical tables are added
    const criticalTables = ['sync_log', 'data_quality_checks', 'brands', 'asin_brand_mapping', 'product_type_mapping']
    const { data: critical } = await this.supabase
      .from('refresh_config')
      .select('table_name')
      .in('table_name', criticalTables)

    const presentTables = critical ? critical.map((c: any) => c.table_name) : []
    const missingTables = criticalTables.filter(t => !presentTables.includes(t))

    if (missingTables.length > 0) {
      issues.push(`Critical tables missing: ${missingTables.join(', ')}`)
    }

    // Check priorities are correct
    const { data: priorities } = await this.supabase
      .from('refresh_config')
      .select('table_name, priority')
      .in('table_name', ['sync_log', 'search_query_performance', 'asin_performance_data'])

    if (priorities) {
      const priorityMap = new Map(priorities.map((p: any) => [p.table_name, p.priority]))
      
      if (priorityMap.get('sync_log') !== 99) {
        issues.push('sync_log should have priority 99')
      }
      if (priorityMap.get('search_query_performance') !== 95) {
        issues.push('search_query_performance should have priority 95')
      }
      if (priorityMap.get('asin_performance_data') !== 90) {
        issues.push('asin_performance_data should have priority 90')
      }
    }

    return {
      isValid: issues.length === 0,
      issues
    }
  }
}

describe('Refresh Configuration Cleanup', () => {
  let cleaner: RefreshConfigurationCleaner

  beforeEach(() => {
    vi.clearAllMocks()
    cleaner = new RefreshConfigurationCleaner(mockSupabase)
  })

  describe('performCleanup', () => {
    it('should remove obsolete tables from refresh_config', async () => {
      // Mock existing obsolete configs
      mockSupabase.data = [
        { id: 1, table_name: 'webhook_configs' },
        { id: 2, table_name: 'webhook_deliveries' }
      ]
      mockSupabase.error = null

      const result = await cleaner.performCleanup()

      expect(mockSupabase.delete).toHaveBeenCalled()
      expect(mockSupabase.in).toHaveBeenCalledWith('table_name', expect.arrayContaining(['webhook_configs', 'webhook_deliveries']))
    })

    it('should handle foreign key constraints before deletion', async () => {
      // Mock configs with foreign key references
      const mockConfigs = [
        { id: 9, table_name: 'webhook_configs' },
        { id: 10, table_name: 'webhook_deliveries' }
      ]

      let callCount = 0
      mockSupabase.data = null
      vi.mocked(mockSupabase.from).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          mockSupabase.data = mockConfigs
        }
        return mockSupabase
      })

      await cleaner.performCleanup()

      // Should update audit logs first
      expect(mockSupabase.update).toHaveBeenCalledWith({ refresh_config_id: null })
      
      // Then delete dependencies
      expect(mockSupabase.delete).toHaveBeenCalled()
    })

    it('should update core table priorities and frequencies', async () => {
      mockSupabase.error = null

      const result = await cleaner.performCleanup()

      // Check search_query_performance update
      expect(mockSupabase.update).toHaveBeenCalledWith({
        priority: 95,
        refresh_frequency_hours: 12
      })

      // Check asin_performance_data update
      expect(mockSupabase.update).toHaveBeenCalledWith({
        priority: 90,
        refresh_frequency_hours: 24
      })
    })

    it('should add missing critical tables', async () => {
      // Mock that sync_log doesn't exist
      mockSupabase.data = null
      mockSupabase.error = null

      const result = await cleaner.performCleanup()

      // Should attempt to insert critical tables
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          table_name: 'sync_log',
          priority: 99,
          refresh_frequency_hours: 6
        })
      )

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          table_name: 'data_quality_checks',
          priority: 95
        })
      )
    })

    it('should not add tables that already exist', async () => {
      // Mock that sync_log already exists
      mockSupabase.data = { id: 1, table_name: 'sync_log' }
      mockSupabase.error = null

      const result = await cleaner.performCleanup()

      // Should check for existing table
      expect(mockSupabase.eq).toHaveBeenCalledWith('table_name', 'sync_log')
      expect(mockSupabase.single).toHaveBeenCalled()
    })

    it('should setup dependencies correctly', async () => {
      // Mock config data for dependency setup
      mockSupabase.data = [
        { id: 1, table_name: 'sync_log' },
        { id: 2, table_name: 'data_quality_checks' },
        { id: 3, table_name: 'brands' },
        { id: 4, table_name: 'asin_brand_mapping' }
      ]

      await cleaner.performCleanup()

      // Should clear existing dependencies
      expect(mockSupabase.delete).toHaveBeenCalled()

      // Should insert new dependencies
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          dependency_type: 'hard'
        })
      )
    })
  })

  describe('validateCleanup', () => {
    it('should detect remaining obsolete tables', async () => {
      // Mock that obsolete tables still exist
      mockSupabase.data = [
        { table_name: 'webhook_configs' }
      ]

      const validation = await cleaner.validateCleanup()

      expect(validation.isValid).toBe(false)
      expect(validation.issues).toContain('Obsolete tables still present: webhook_configs')
    })

    it('should detect missing critical tables', async () => {
      // First call returns empty (no obsolete), second returns partial critical tables
      let callCount = 0
      vi.mocked(mockSupabase.from).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          mockSupabase.data = []
        } else if (callCount === 2) {
          mockSupabase.data = [
            { table_name: 'sync_log' },
            { table_name: 'brands' }
            // Missing: data_quality_checks, asin_brand_mapping, product_type_mapping
          ]
        }
        return mockSupabase
      })

      const validation = await cleaner.validateCleanup()

      expect(validation.isValid).toBe(false)
      expect(validation.issues[0]).toContain('Critical tables missing')
      expect(validation.issues[0]).toContain('data_quality_checks')
    })

    it('should validate correct priorities', async () => {
      // Setup mock for three sequential calls
      let callCount = 0
      vi.mocked(mockSupabase.from).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          mockSupabase.data = [] // No obsolete tables
        } else if (callCount === 2) {
          mockSupabase.data = [ // All critical tables present
            { table_name: 'sync_log' },
            { table_name: 'data_quality_checks' },
            { table_name: 'brands' },
            { table_name: 'asin_brand_mapping' },
            { table_name: 'product_type_mapping' }
          ]
        } else if (callCount === 3) {
          mockSupabase.data = [ // Wrong priorities
            { table_name: 'sync_log', priority: 80 },
            { table_name: 'search_query_performance', priority: 85 },
            { table_name: 'asin_performance_data', priority: 90 }
          ]
        }
        return mockSupabase
      })

      const validation = await cleaner.validateCleanup()

      expect(validation.isValid).toBe(false)
      expect(validation.issues).toContain('sync_log should have priority 99')
      expect(validation.issues).toContain('search_query_performance should have priority 95')
    })

    it('should return valid when cleanup is successful', async () => {
      // Setup perfect state
      let callCount = 0
      vi.mocked(mockSupabase.from).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          mockSupabase.data = [] // No obsolete tables
        } else if (callCount === 2) {
          mockSupabase.data = [ // All critical tables
            { table_name: 'sync_log' },
            { table_name: 'data_quality_checks' },
            { table_name: 'brands' },
            { table_name: 'asin_brand_mapping' },
            { table_name: 'product_type_mapping' }
          ]
        } else if (callCount === 3) {
          mockSupabase.data = [ // Correct priorities
            { table_name: 'sync_log', priority: 99 },
            { table_name: 'search_query_performance', priority: 95 },
            { table_name: 'asin_performance_data', priority: 90 }
          ]
        }
        return mockSupabase
      })

      const validation = await cleaner.validateCleanup()

      expect(validation.isValid).toBe(true)
      expect(validation.issues).toHaveLength(0)
    })
  })
})