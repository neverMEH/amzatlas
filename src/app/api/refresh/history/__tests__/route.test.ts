import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn()
  }))
}))

describe('GET /api/refresh/history', () => {
  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = {
      from: vi.fn()
    }
    ;(createClient as any).mockReturnValue(mockSupabase)
  })

  describe('Basic History Retrieval', () => {
    it('should return refresh history with default pagination', async () => {
      const mockHistory = [
        {
          id: 1,
          table_name: 'asin_performance_data',
          table_schema: 'sqp',
          refresh_started_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          refresh_completed_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          status: 'success',
          rows_processed: 1000,
          execution_time_ms: 1800000
        },
        {
          id: 2,
          table_name: 'search_query_performance',
          table_schema: 'sqp',
          refresh_started_at: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
          refresh_completed_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
          status: 'success',
          rows_processed: 5000,
          execution_time_ms: 1800000
        }
      ]

      const mockCount = 50

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn((query: string) => {
          if (query === '*') {
            return {
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: mockHistory,
                  error: null
                })
              })
            }
          }
          if (query === 'count') {
            return {
              single: vi.fn().mockResolvedValue({
                data: { count: mockCount },
                error: null
              })
            }
          }
        })
      }))

      const request = new NextRequest('http://localhost:3000/api/refresh/history')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        history: expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            table_name: 'asin_performance_data',
            status: 'success',
            duration_minutes: 30
          })
        ]),
        pagination: {
          page: 1,
          pageSize: 50,
          total: 50,
          totalPages: 1
        }
      })
    })
  })

  describe('Filtering', () => {
    it('should filter by table name', async () => {
      const mockHistory = [
        {
          id: 1,
          table_name: 'asin_performance_data',
          status: 'success',
          refresh_started_at: new Date().toISOString(),
          refresh_completed_at: new Date().toISOString()
        }
      ]

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockImplementation((query: string) => {
          const chain = {
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: query === 'count' ? { count: 1 } : mockHistory,
              error: null
            }),
            single: vi.fn().mockResolvedValue({
              data: { count: 1 },
              error: null
            })
          }
          return chain
        })
      }))

      const request = new NextRequest('http://localhost:3000/api/refresh/history?table_name=asin_performance_data')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.history).toHaveLength(1)
      expect(data.history[0].table_name).toBe('asin_performance_data')
    })

    it('should filter by status', async () => {
      const mockHistory = [
        {
          id: 1,
          table_name: 'asin_performance_data',
          status: 'failed',
          error_message: 'Connection timeout',
          refresh_started_at: new Date().toISOString(),
          refresh_completed_at: new Date().toISOString()
        }
      ]

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockImplementation((query: string) => {
          const chain = {
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: query === 'count' ? { count: 1 } : mockHistory,
              error: null
            }),
            single: vi.fn().mockResolvedValue({
              data: { count: 1 },
              error: null
            })
          }
          return chain
        })
      }))

      const request = new NextRequest('http://localhost:3000/api/refresh/history?status=failed')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.history).toHaveLength(1)
      expect(data.history[0].status).toBe('failed')
      expect(data.history[0].error_message).toBe('Connection timeout')
    })

    it('should filter by date range', async () => {
      const mockHistory = [
        {
          id: 1,
          table_name: 'asin_performance_data',
          status: 'success',
          refresh_started_at: '2024-01-15T10:00:00Z',
          refresh_completed_at: '2024-01-15T10:30:00Z'
        }
      ]

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockImplementation((query: string) => {
          const chain = {
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: query === 'count' ? { count: 1 } : mockHistory,
              error: null
            }),
            single: vi.fn().mockResolvedValue({
              data: { count: 1 },
              error: null
            })
          }
          return chain
        })
      }))

      const request = new NextRequest('http://localhost:3000/api/refresh/history?start_date=2024-01-01&end_date=2024-01-31')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.history).toHaveLength(1)
    })
  })

  describe('Pagination', () => {
    it('should support custom page size', async () => {
      const mockHistory = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        table_name: 'test_table',
        status: 'success',
        refresh_started_at: new Date().toISOString(),
        refresh_completed_at: new Date().toISOString()
      }))

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockImplementation((query: string) => ({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockImplementation((start: number, end: number) => 
              Promise.resolve({
                data: query === 'count' ? { count: 100 } : mockHistory.slice(0, 10),
                error: null
              })
            )
          }),
          single: vi.fn().mockResolvedValue({
            data: { count: 100 },
            error: null
          })
        })
      })

      const request = new NextRequest('http://localhost:3000/api/refresh/history?page=2&pageSize=10')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.pagination).toMatchObject({
        page: 2,
        pageSize: 10,
        total: 100,
        totalPages: 10
      })
    })

    it('should validate pagination parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/refresh/history?page=-1&pageSize=1000')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid pagination parameters')
    })
  })

  describe('Summary Statistics', () => {
    it('should include summary statistics', async () => {
      const mockHistory = [
        { id: 1, status: 'success', rows_processed: 1000, execution_time_ms: 60000 },
        { id: 2, status: 'success', rows_processed: 2000, execution_time_ms: 120000 },
        { id: 3, status: 'failed', error_message: 'Timeout' },
        { id: 4, status: 'warning', rows_processed: 500, execution_time_ms: 30000 }
      ]

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockImplementation((query: string) => ({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: mockHistory,
              error: null
            })
          }),
          single: vi.fn().mockResolvedValue({
            data: { count: 4 },
            error: null
          })
        })
      })

      const request = new NextRequest('http://localhost:3000/api/refresh/history')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.summary).toMatchObject({
        total: 4,
        success: 2,
        failed: 1,
        warning: 1,
        average_duration_minutes: 1.25,
        total_rows_processed: 3500
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' }
            })
          })
        })
      })

      const request = new NextRequest('http://localhost:3000/api/refresh/history')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch refresh history')
    })
  })
})