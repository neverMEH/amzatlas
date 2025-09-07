import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { createClient } from '@supabase/supabase-js'

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn()
  }))
}))

// Core tables that should be monitored based on migration 048
const CORE_TABLES = [
  { name: 'sync_log', priority: 99, schema: 'public' },
  { name: 'search_query_performance', priority: 95, schema: 'sqp' },
  { name: 'asin_performance_data', priority: 90, schema: 'sqp' },
  { name: 'data_quality_checks', priority: 80, schema: 'public' },
  { name: 'brands', priority: 75, schema: 'public' },
  { name: 'asin_brand_mapping', priority: 70, schema: 'public' },
  { name: 'product_type_mapping', priority: 65, schema: 'public' }
]

describe('GET /api/refresh/status', () => {
  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = {
      from: vi.fn()
    }
    ;(createClient as any).mockReturnValue(mockSupabase)
  })

  describe('Overall Status', () => {
    it('should return healthy status when all tables refreshed recently', async () => {
      const mockConfigs = [
        {
          table_name: 'asin_performance_data',
          is_enabled: true,
          last_refresh_at: new Date().toISOString(),
          next_refresh_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          refresh_frequency_hours: 24
        },
        {
          table_name: 'search_query_performance',
          is_enabled: true,
          last_refresh_at: new Date().toISOString(),
          next_refresh_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          refresh_frequency_hours: 24
        }
      ]

      const mockRecentLogs = [
        {
          table_name: 'asin_performance_data',
          status: 'success',
          refresh_completed_at: new Date().toISOString(),
          rows_processed: 1000
        },
        {
          table_name: 'search_query_performance',
          status: 'success',
          refresh_completed_at: new Date().toISOString(),
          rows_processed: 5000
        }
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockConfigs,
                error: null
              })
            })
          }
        }
        if (table === 'refresh_audit_log') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: mockRecentLogs,
                  error: null
                })
              })
            })
          }
        }
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.overall_status).toBe('healthy')
      expect(data.statistics.total_tables).toBe(2)
      expect(data.statistics.enabled_tables).toBe(2)
      expect(data.statistics.successful_today).toBe(2)
    })

    it('should return warning status when some tables are stale', async () => {
      const mockConfigs = [
        {
          table_name: 'asin_performance_data',
          is_enabled: true,
          last_refresh_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days old
          next_refresh_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Past due
          refresh_frequency_hours: 24
        }
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockConfigs,
                error: null
              })
            })
          }
        }
        if (table === 'refresh_audit_log') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          }
        }
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.overall_status).toBe('warning')
      expect(data.statistics.stale_tables).toBe(1)
    })

    it('should return error status when refresh failures detected', async () => {
      const mockRecentLogs = [
        {
          table_name: 'asin_performance_data',
          status: 'failed',
          error_message: 'BigQuery connection failed',
          refresh_completed_at: new Date().toISOString()
        }
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          }
        }
        if (table === 'refresh_audit_log') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: mockRecentLogs,
                  error: null
                })
              })
            })
          }
        }
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.overall_status).toBe('error')
      expect(data.statistics.failed_today).toBe(1)
    })
  })

  describe('Table Status Details', () => {
    it('should include detailed status for each table', async () => {
      const mockConfigs = [
        {
          id: 1,
          table_name: 'asin_performance_data',
          table_schema: 'sqp',
          is_enabled: true,
          last_refresh_at: new Date().toISOString(),
          next_refresh_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
          refresh_frequency_hours: 24,
          priority: 100
        }
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockConfigs,
                error: null
              })
            })
          }
        }
        if (table === 'refresh_audit_log') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          }
        }
      })

      const response = await GET()
      const data = await response.json()

      expect(data.tables).toHaveLength(1)
      expect(data.tables[0]).toMatchObject({
        table_name: 'asin_performance_data',
        schema: 'sqp',
        enabled: true,
        priority: 100,
        frequency_hours: 24,
        status: 'pending'
      })
      expect(data.tables[0].last_refresh).toBeDefined()
      expect(data.tables[0].next_refresh).toBeDefined()
      expect(data.tables[0].hours_until_refresh).toBeGreaterThan(0)
    })

    it('should mark overdue tables appropriately', async () => {
      const mockConfigs = [
        {
          table_name: 'asin_performance_data',
          is_enabled: true,
          last_refresh_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
          next_refresh_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours overdue
          refresh_frequency_hours: 24
        }
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockConfigs,
                error: null
              })
            })
          }
        }
        if (table === 'refresh_audit_log') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          }
        }
      })

      const response = await GET()
      const data = await response.json()

      expect(data.tables[0].status).toBe('overdue')
      expect(data.tables[0].hours_until_refresh).toBeLessThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database connection failed' }
          })
        })
      }))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch refresh status')
      expect(data.details).toBe('Database connection failed')
    })
  })

  describe('Recent Activity', () => {
    it('should include recent refresh activity', async () => {
      const mockRecentLogs = [
        {
          id: 1,
          table_name: 'asin_performance_data',
          status: 'success',
          refresh_started_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          refresh_completed_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          rows_processed: 1000,
          execution_time_ms: 1800000
        },
        {
          id: 2,
          table_name: 'search_query_performance',
          status: 'failed',
          refresh_started_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
          refresh_completed_at: new Date(Date.now() - 115 * 60 * 1000).toISOString(),
          error_message: 'Timeout'
        }
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          }
        }
        if (table === 'refresh_audit_log') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: mockRecentLogs,
                  error: null
                })
              })
            })
          }
        }
      })

      const response = await GET()
      const data = await response.json()

      expect(data.recent_activity).toHaveLength(2)
      expect(data.recent_activity[0]).toMatchObject({
        table_name: 'asin_performance_data',
        status: 'success',
        rows_processed: 1000,
        duration_minutes: 30
      })
      expect(data.recent_activity[1]).toMatchObject({
        table_name: 'search_query_performance',
        status: 'failed',
        error: 'Timeout'
      })
    })
  })

  describe('Core Tables Focus', () => {
    it('should prioritize core tables over deprecated ones', async () => {
      const mockConfigs = [
        // Core tables
        ...CORE_TABLES.map(table => ({
          table_name: table.name,
          table_schema: table.schema,
          is_enabled: true,
          priority: table.priority,
          last_refresh_at: new Date().toISOString(),
          next_refresh_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          refresh_frequency_hours: 24
        })),
        // Deprecated tables that should be deprioritized
        {
          table_name: 'weekly_summary',
          table_schema: 'sqp',
          is_enabled: false,
          priority: 10,
          last_refresh_at: null,
          next_refresh_at: null,
          refresh_frequency_hours: 168
        }
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockConfigs,
                error: null
              })
            })
          }
        }
        if (table === 'refresh_audit_log') {
          return {
            select: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [],
                    error: null
                  })
                })
              })
            })
          }
        }
      })

      const response = await GET()
      const data = await response.json()

      // Should include all core tables
      const coreTableNames = CORE_TABLES.map(t => t.name)
      const returnedCoreTablesCount = data.tables.filter((t: any) => 
        coreTableNames.includes(t.table_name) && t.enabled
      ).length
      
      expect(returnedCoreTablesCount).toBe(CORE_TABLES.length)
      
      // Core tables should have higher priority
      const coreTables = data.tables.filter((t: any) => coreTableNames.includes(t.table_name))
      const deprecatedTables = data.tables.filter((t: any) => !coreTableNames.includes(t.table_name))
      
      if (coreTables.length > 0 && deprecatedTables.length > 0) {
        const minCorePriority = Math.min(...coreTables.map((t: any) => t.priority))
        const maxDeprecatedPriority = Math.max(...deprecatedTables.map((t: any) => t.priority))
        expect(minCorePriority).toBeGreaterThan(maxDeprecatedPriority)
      }
    })
  })

  describe('Sync Log Integration', () => {
    it('should include sync_log data in pipeline activity', async () => {
      const mockSyncLogs = [
        {
          id: 1,
          operation_type: 'full_sync',
          table_name: 'asin_performance_data',
          started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          completed_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          status: 'success',
          records_processed: 50000,
          error_message: null
        },
        {
          id: 2,
          operation_type: 'incremental_sync',
          table_name: 'search_query_performance',
          started_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          completed_at: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
          status: 'failed',
          records_processed: 0,
          error_message: 'BigQuery timeout'
        }
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          }
        }
        if (table === 'refresh_audit_log') {
          return {
            select: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [],
                    error: null
                  })
                })
              })
            })
          }
        }
        if (table === 'sync_log') {
          return {
            select: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: mockSyncLogs,
                    error: null
                  })
                })
              })
            })
          }
        }
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      // Verify sync log data is included in pipeline activity
      expect(data).toHaveProperty('pipeline_activity')
      expect(data.pipeline_activity).toBeInstanceOf(Array)
      expect(data.pipeline_activity.length).toBeGreaterThan(0)
    })
  })

  describe('Data Freshness Scoring', () => {
    it('should calculate data freshness scores based on sync patterns', async () => {
      const mockConfigs = CORE_TABLES.slice(0, 3).map(table => ({
        table_name: table.name,
        table_schema: table.schema,
        is_enabled: true,
        priority: table.priority,
        last_refresh_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
        next_refresh_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        refresh_frequency_hours: 24
      }))

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockConfigs,
                error: null
              })
            })
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          })
        }
      })

      const response = await GET()
      const data = await response.json()

      // Tables should include freshness scores
      expect(data.tables[0]).toHaveProperty('freshness_score')
      // Freshness score should be between 0 and 100
      data.tables.forEach((table: any) => {
        if (table.last_refresh) {
          expect(table.freshness_score).toBeGreaterThanOrEqual(0)
          expect(table.freshness_score).toBeLessThanOrEqual(100)
        }
      })
    })
  })

  describe('Critical Table Monitoring', () => {
    it('should identify critical tables that need immediate attention', async () => {
      const mockConfigs = [
        {
          table_name: 'sync_log',
          table_schema: 'public',
          is_enabled: true,
          priority: 99,
          last_refresh_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days old (critical!)
          next_refresh_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          refresh_frequency_hours: 24
        },
        {
          table_name: 'asin_performance_data',
          table_schema: 'sqp',
          is_enabled: true,
          priority: 90,
          last_refresh_at: new Date().toISOString(), // Just refreshed
          next_refresh_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          refresh_frequency_hours: 24
        }
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockConfigs,
                error: null
              })
            })
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          })
        }
      })

      const response = await GET()
      const data = await response.json()

      // Should have critical tables section
      expect(data).toHaveProperty('critical_tables')
      expect(data.critical_tables).toBeInstanceOf(Array)
      
      // sync_log should be marked as critical due to staleness
      const criticalSyncLog = data.critical_tables.find((t: any) => t.table_name === 'sync_log')
      expect(criticalSyncLog).toBeDefined()
      expect(criticalSyncLog.reason).toContain('stale')
    })
  })

  describe('Alerts System', () => {
    it('should generate critical alerts for failing core tables', async () => {
      const mockConfigs = [
        {
          table_name: 'asin_performance_data',
          table_schema: 'sqp',
          is_enabled: true,
          priority: 90,
          last_refresh_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          refresh_frequency_hours: 24
        }
      ]

      const mockRecentLogs = [
        {
          table_name: 'asin_performance_data',
          table_schema: 'sqp',
          status: 'failed',
          error_message: 'BigQuery connection timeout',
          refresh_started_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          refresh_completed_at: new Date(Date.now() - 0.5 * 60 * 60 * 1000).toISOString()
        }
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockConfigs,
                error: null
              })
            })
          }
        }
        if (table === 'refresh_audit_log') {
          return {
            select: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: mockRecentLogs,
                    error: null
                  })
                })
              })
            })
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          })
        }
      })

      const response = await GET()
      const data = await response.json()

      expect(data).toHaveProperty('alerts')
      expect(data.alerts).toBeInstanceOf(Array)
      
      // Should have a critical alert for the failing core table
      const criticalAlert = data.alerts.find((a: any) => 
        a.severity === 'critical' && a.type === 'core_table_failure'
      )
      expect(criticalAlert).toBeDefined()
      expect(criticalAlert.table_name).toBe('asin_performance_data')
      expect(criticalAlert.details.last_error).toBe('BigQuery connection timeout')
      
      // Overall status should be error due to critical alert
      expect(data.overall_status).toBe('error')
    })

    it('should generate warning alerts for high failure rates', async () => {
      const mockConfigs = [
        { table_name: 'test1', table_schema: 'public', is_enabled: true, refresh_frequency_hours: 24 },
        { table_name: 'test2', table_schema: 'public', is_enabled: true, refresh_frequency_hours: 24 }
      ]

      // 10 logs: 7 failed, 3 success = 70% failure rate
      const mockLogs = [
        ...Array(7).fill(null).map((_, i) => ({
          table_name: `test${i % 2 + 1}`,
          status: 'failed',
          refresh_started_at: new Date(Date.now() - i * 60 * 60 * 1000).toISOString()
        })),
        ...Array(3).fill(null).map((_, i) => ({
          table_name: `test${i % 2 + 1}`,
          status: 'success',
          refresh_started_at: new Date(Date.now() - (i + 7) * 60 * 60 * 1000).toISOString()
        }))
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockConfigs,
                error: null
              })
            })
          }
        }
        if (table === 'refresh_audit_log') {
          return {
            select: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: mockLogs,
                    error: null
                  })
                })
              })
            })
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          })
        }
      })

      const response = await GET()
      const data = await response.json()

      // Should have high failure rate warning
      const warningAlert = data.alerts.find((a: any) => 
        a.severity === 'warning' && a.type === 'high_failure_rate'
      )
      expect(warningAlert).toBeDefined()
      expect(warningAlert.details.failure_rate).toBe('70.0%')
    })

    it('should generate info alerts for no recent activity', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  { 
                    table_name: 'old_table',
                    is_enabled: true,
                    last_refresh_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
                    refresh_frequency_hours: 24
                  }
                ],
                error: null
              })
            })
          }
        }
        // No recent logs in any table
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          })
        }
      })

      const response = await GET()
      const data = await response.json()

      // Should have info alert for no recent activity
      const infoAlert = data.alerts.find((a: any) => 
        a.severity === 'info' && a.type === 'no_recent_activity'
      )
      expect(infoAlert).toBeDefined()
      expect(infoAlert.message).toContain('No sync activity detected')
    })

    it('should include alert summary', async () => {
      // Create scenario with mixed alerts
      const mockConfigs = [
        // Stale sync_log (critical)
        {
          table_name: 'sync_log',
          table_schema: 'public',
          is_enabled: true,
          priority: 99,
          last_refresh_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
          refresh_frequency_hours: 24
        },
        // Multiple stale tables (warning)
        ...Array(4).fill(null).map((_, i) => ({
          table_name: `stale_table_${i}`,
          table_schema: 'public',
          is_enabled: true,
          priority: 50,
          last_refresh_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
          refresh_frequency_hours: 24
        }))
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockConfigs,
                error: null
              })
            })
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          })
        }
      })

      const response = await GET()
      const data = await response.json()

      expect(data).toHaveProperty('alert_summary')
      expect(data.alert_summary.critical).toBeGreaterThan(0) // sync_log critical
      expect(data.alert_summary.warning).toBeGreaterThan(0) // multiple stale tables
      expect(data.alert_summary.info).toBeGreaterThanOrEqual(0)
    })
  })
})