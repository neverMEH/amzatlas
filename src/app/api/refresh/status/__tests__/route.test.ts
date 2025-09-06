import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { createClient } from '@supabase/supabase-js'

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn()
  }))
}))

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
        },
        {
          table_name: 'search_query_performance',
          is_enabled: true,
          last_refresh_at: new Date().toISOString(), // Recently refreshed
          next_refresh_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Not due yet
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
})