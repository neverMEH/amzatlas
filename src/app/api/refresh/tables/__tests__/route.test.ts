import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { createClient } from '@supabase/supabase-js'

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn()
  }))
}))

// Mock Next.js Request
class MockRequest extends Request {
  constructor(url: string) {
    super(`http://localhost:3000${url}`)
  }
}

describe('GET /api/refresh/tables', () => {
  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = {
      from: vi.fn()
    }
    ;(createClient as any).mockReturnValue(mockSupabase)
  })

  describe('Table Metrics', () => {
    it('should return metrics for all tables', async () => {
      const mockConfigs = [
        {
          table_name: 'sync_log',
          table_schema: 'public',
          is_enabled: true,
          last_refresh_at: new Date().toISOString(),
          next_refresh_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          refresh_frequency_hours: 24
        },
        {
          table_name: 'asin_performance_data',
          table_schema: 'sqp',
          is_enabled: true,
          last_refresh_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          next_refresh_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
          refresh_frequency_hours: 24
        }
      ]

      const mockSyncLogs = [
        {
          table_name: 'sync_log',
          started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          completed_at: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
          status: 'success',
          error_message: null
        }
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockResolvedValue({
              data: mockConfigs,
              error: null
            })
          }
        }
        if (table === 'sync_log') {
          return {
            select: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: mockSyncLogs,
                  error: null
                })
              }),
              head: false,
              count: 'exact'
            })
          }
        }
        if (table === 'refresh_audit_log') {
          return {
            select: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          }
        }
        // For table counts
        return {
          select: vi.fn().mockResolvedValue({
            count: 1000,
            error: null
          })
        }
      })

      const request = new MockRequest('/api/refresh/tables')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.tables).toBeInstanceOf(Array)
      expect(data.tables.length).toBe(2)
      expect(data.summary.total_tables).toBe(2)
      
      // Check first table metrics
      const syncLogMetrics = data.tables.find((t: any) => t.table_name === 'sync_log')
      expect(syncLogMetrics).toBeDefined()
      expect(syncLogMetrics.category).toBe('Data Pipeline')
      expect(syncLogMetrics.status).toBe('active')
      expect(syncLogMetrics.health_score).toBeGreaterThan(50)
    })

    it('should filter tables by category', async () => {
      const mockConfigs = [
        {
          table_name: 'sync_log',
          table_schema: 'public',
          is_enabled: true,
          refresh_frequency_hours: 24
        },
        {
          table_name: 'brands',
          table_schema: 'public',
          is_enabled: true,
          refresh_frequency_hours: 24
        },
        {
          table_name: 'asin_performance_data',
          table_schema: 'sqp',
          is_enabled: true,
          refresh_frequency_hours: 24
        }
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockResolvedValue({
              data: mockConfigs,
              error: null
            })
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null
              })
            }),
            head: true,
            count: 'exact'
          })
        }
      })

      const request = new MockRequest('/api/refresh/tables?category=brand_management')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.tables.length).toBe(1)
      expect(data.tables[0].table_name).toBe('brands')
      expect(data.tables[0].category).toBe('Brand Management')
    })

    it('should return metrics for a specific table', async () => {
      const mockConfig = {
        table_name: 'asin_performance_data',
        table_schema: 'sqp',
        is_enabled: true,
        last_refresh_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        refresh_frequency_hours: 24
      }

      const mockLogs = Array.from({ length: 5 }, (_, i) => ({
        table_name: 'asin_performance_data',
        started_at: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000).toISOString(),
        completed_at: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
        status: i === 2 ? 'failed' : 'success',
        error_message: i === 2 ? 'Timeout error' : null
      }))

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockResolvedValue({
              data: [mockConfig],
              error: null
            })
          }
        }
        if (table === 'sync_log') {
          return {
            select: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: mockLogs,
                  error: null
                })
              })
            })
          }
        }
        if (table === 'refresh_audit_log') {
          return {
            select: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null
                })
              })
            })
          }
        }
        return {
          select: vi.fn().mockResolvedValue({
            count: 50000,
            error: null
          })
        }
      })

      const request = new MockRequest('/api/refresh/tables?table=asin_performance_data')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.tables.length).toBe(1)
      
      const tableMetrics = data.tables[0]
      expect(tableMetrics.table_name).toBe('asin_performance_data')
      expect(tableMetrics.metrics.success_rate_7d).toBe(80) // 4 success out of 5
      expect(tableMetrics.metrics.avg_refresh_duration_minutes).toBe(30)
      expect(tableMetrics.metrics.last_error).toBe('Timeout error')
      expect(tableMetrics.metrics.data_freshness_hours).toBe(6)
      expect(tableMetrics.trends.refresh_times).toBeInstanceOf(Array)
      expect(tableMetrics.trends.success_rate).toBeInstanceOf(Array)
    })
  })

  describe('Table Status', () => {
    it('should mark disabled tables correctly', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockResolvedValue({
              data: [{
                table_name: 'test_table',
                table_schema: 'public',
                is_enabled: false,
                refresh_frequency_hours: 24
              }],
              error: null
            })
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        }
      })

      const request = new MockRequest('/api/refresh/tables')
      const response = await GET(request)
      const data = await response.json()

      expect(data.tables[0].status).toBe('disabled')
      expect(data.tables[0].health_score).toBe(0)
    })

    it('should mark stale tables correctly', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockResolvedValue({
              data: [{
                table_name: 'test_table',
                table_schema: 'public',
                is_enabled: true,
                last_refresh_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days old
                refresh_frequency_hours: 24
              }],
              error: null
            })
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        }
      })

      const request = new MockRequest('/api/refresh/tables')
      const response = await GET(request)
      const data = await response.json()

      expect(data.tables[0].status).toBe('stale')
      expect(data.tables[0].health_score).toBe(50)
    })

    it('should mark tables with recent errors correctly', async () => {
      const failedLog = {
        table_name: 'test_table',
        started_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        completed_at: new Date(Date.now() - 0.5 * 60 * 60 * 1000).toISOString(),
        status: 'failed',
        error_message: 'Connection timeout'
      }

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockResolvedValue({
              data: [{
                table_name: 'test_table',
                table_schema: 'public',
                is_enabled: true,
                refresh_frequency_hours: 24
              }],
              error: null
            })
          }
        }
        if (table === 'sync_log') {
          return {
            select: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [failedLog],
                  error: null
                })
              })
            })
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        }
      })

      const request = new MockRequest('/api/refresh/tables')
      const response = await GET(request)
      const data = await response.json()

      expect(data.tables[0].status).toBe('error')
      expect(data.tables[0].health_score).toBe(20)
      expect(data.tables[0].metrics.last_error).toBe('Connection timeout')
    })
  })

  describe('Category Grouping', () => {
    it('should group tables by category when not filtering', async () => {
      const mockConfigs = [
        { table_name: 'sync_log', table_schema: 'public', is_enabled: true, refresh_frequency_hours: 24 },
        { table_name: 'data_quality_checks', table_schema: 'public', is_enabled: true, refresh_frequency_hours: 24 },
        { table_name: 'brands', table_schema: 'public', is_enabled: true, refresh_frequency_hours: 24 },
        { table_name: 'asin_performance_data', table_schema: 'sqp', is_enabled: true, refresh_frequency_hours: 24 }
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockResolvedValue({
              data: mockConfigs,
              error: null
            })
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null
              })
            }),
            head: true,
            count: 'exact'
          })
        }
      })

      const request = new MockRequest('/api/refresh/tables')
      const response = await GET(request)
      const data = await response.json()

      expect(data.categories).toBeInstanceOf(Array)
      
      const pipelineCategory = data.categories.find((c: any) => c.key === 'data_pipeline')
      expect(pipelineCategory).toBeDefined()
      expect(pipelineCategory.table_count).toBe(2)
      expect(pipelineCategory.priority).toBe(100)
      
      const brandCategory = data.categories.find((c: any) => c.key === 'brand_management')
      expect(brandCategory).toBeDefined()
      expect(brandCategory.table_count).toBe(1)
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' }
        })
      }))

      const request = new MockRequest('/api/refresh/tables')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch table metrics')
      expect(data.details).toBe('Database connection failed')
    })
  })
})