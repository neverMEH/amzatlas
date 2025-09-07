import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { createClient } from '@supabase/supabase-js'

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn()
  }))
}))

describe('GET /api/refresh/health', () => {
  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = {
      from: vi.fn()
    }
    ;(createClient as any).mockReturnValue(mockSupabase)
  })

  describe('Health Score Calculation', () => {
    it('should return healthy status when all checks pass', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [{}],
                error: null
              }),
              eq: vi.fn().mockReturnValue({
                data: [
                  { table_name: 'sync_log', is_enabled: true, last_refresh_at: new Date().toISOString(), refresh_frequency_hours: 24 },
                  { table_name: 'asin_performance_data', is_enabled: true, last_refresh_at: new Date().toISOString(), refresh_frequency_hours: 24 },
                  { table_name: 'search_query_performance', is_enabled: true, last_refresh_at: new Date().toISOString(), refresh_frequency_hours: 24 },
                  { table_name: 'brands', is_enabled: true, last_refresh_at: new Date().toISOString(), refresh_frequency_hours: 24 }
                ],
                error: null
              })
            })
          }
        }
        if (table === 'sync_log') {
          return {
            select: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    { status: 'success', started_at: new Date().toISOString() },
                    { status: 'success', started_at: new Date().toISOString() }
                  ],
                  error: null
                })
              })
            })
          }
        }
        if (table === 'asin_performance_data') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [{ start_date: new Date().toISOString() }],
                  error: null
                })
              })
            })
          }
        }
        if (table === 'pipeline_health') {
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [{
                  sync_success_rate: 95,
                  tables_synced_24h: 10,
                  total_records_24h: 50000,
                  avg_sync_duration_minutes: 15
                }],
                error: null
              })
            })
          }
        }
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('healthy')
      expect(data.health_score).toBeGreaterThanOrEqual(90)
      expect(data.checks).toBeInstanceOf(Array)
      expect(data.checks.every((c: any) => c.status === 'pass' || c.status === 'warn')).toBe(true)
    })

    it('should return degraded status when some checks fail', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [{}],
                error: null
              }),
              eq: vi.fn().mockReturnValue({
                data: [
                  { table_name: 'sync_log', is_enabled: true, last_refresh_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), refresh_frequency_hours: 24 }
                ],
                error: null
              })
            })
          }
        }
        if (table === 'sync_log') {
          return {
            select: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    { status: 'failed', started_at: new Date().toISOString() },
                    { status: 'success', started_at: new Date().toISOString() }
                  ],
                  error: null
                })
              })
            })
          }
        }
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
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('degraded')
      expect(data.health_score).toBeGreaterThan(30)
      expect(data.health_score).toBeLessThan(90)
    })

    it('should return critical status on database connection failure', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Connection refused' }
          })
        })
      }))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('critical')
      expect(data.health_score).toBe(0)
      expect(data.checks[0].name).toBe('database_connectivity')
      expect(data.checks[0].status).toBe('fail')
    })
  })

  describe('Individual Health Checks', () => {
    it('should check core tables configuration', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [{}], error: null }),
              eq: vi.fn().mockReturnValue({
                data: [
                  { table_name: 'sync_log', is_enabled: true },
                  { table_name: 'brands', is_enabled: true }
                ],
                error: null
              })
            })
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null })
            })
          })
        }
      })

      const response = await GET()
      const data = await response.json()

      const coreTablesCheck = data.checks.find((c: any) => c.name === 'core_tables_configured')
      expect(coreTablesCheck).toBeDefined()
      expect(coreTablesCheck.status).toBe('warn')
      expect(coreTablesCheck.details.configured).toContain('sync_log')
      expect(coreTablesCheck.details.missing).toContain('asin_performance_data')
    })

    it('should check sync activity and calculate failure rate', async () => {
      const mockSyncLogs = [
        { status: 'success', started_at: new Date().toISOString() },
        { status: 'success', started_at: new Date().toISOString() },
        { status: 'failed', started_at: new Date().toISOString() }
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [{}], error: null }),
              eq: vi.fn().mockReturnValue({ data: [], error: null })
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
              })
            })
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null })
            })
          })
        }
      })

      const response = await GET()
      const data = await response.json()

      const syncActivityCheck = data.checks.find((c: any) => c.name === 'sync_activity')
      expect(syncActivityCheck).toBeDefined()
      expect(syncActivityCheck.status).toBe('fail') // 33% failure rate > 10% threshold
      expect(syncActivityCheck.details.failure_rate).toBe('33.3%')
      expect(syncActivityCheck.details.failed).toBe(1)
    })

    it('should check data freshness', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [{}], error: null }),
              eq: vi.fn().mockReturnValue({ data: [], error: null })
            })
          }
        }
        if (table === 'asin_performance_data') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [{ start_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() }], // 5 days old
                  error: null
                })
              })
            })
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null })
            })
          })
        }
      })

      const response = await GET()
      const data = await response.json()

      const dataFreshnessCheck = data.checks.find((c: any) => c.name === 'data_freshness')
      expect(dataFreshnessCheck).toBeDefined()
      expect(dataFreshnessCheck.status).toBe('warn')
      expect(dataFreshnessCheck.details.days_old).toBe(5)
    })
  })

  describe('Recommendations', () => {
    it('should provide recommendations for stale tables', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'refresh_config') {
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [{}], error: null }),
              eq: vi.fn().mockReturnValue({
                data: [
                  {
                    table_name: 'stale_table',
                    is_enabled: true,
                    last_refresh_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), // 3 days old
                    refresh_frequency_hours: 24
                  }
                ],
                error: null
              })
            })
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null })
            })
          })
        }
      })

      const response = await GET()
      const data = await response.json()

      expect(data.recommendations).toBeInstanceOf(Array)
      const refreshRecommendation = data.recommendations.find((r: any) => r.type === 'refresh_stale_tables')
      expect(refreshRecommendation).toBeDefined()
      expect(refreshRecommendation.tables).toContain('stale_table')
      expect(refreshRecommendation.priority).toBe('high')
    })
  })

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.status).toBe('critical')
      expect(data.health_score).toBe(0)
      expect(data.checks[0].name).toBe('system_error')
    })
  })
})