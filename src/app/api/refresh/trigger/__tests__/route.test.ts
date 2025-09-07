import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../route'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
    functions: {
      invoke: vi.fn()
    }
  }))
}))

describe('POST /api/refresh/trigger', () => {
  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = {
      from: vi.fn(),
      functions: {
        invoke: vi.fn()
      }
    }
    ;(createClient as any).mockReturnValue(mockSupabase)
  })

  describe('Full Refresh', () => {
    it('should trigger refresh for all enabled tables when no table specified', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: { success: true, tablesProcessed: 5 },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/refresh/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('daily-refresh-orchestrator')
      expect(data).toMatchObject({
        success: true,
        message: 'Refresh triggered successfully',
        type: 'full',
        details: { success: true, tablesProcessed: 5 }
      })
    })

    it('should handle orchestrator errors', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Function timeout' }
      })

      const request = new NextRequest('http://localhost:3000/api/refresh/trigger', {
        method: 'POST',
        body: JSON.stringify({})
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data).toMatchObject({
        success: false,
        error: 'Failed to trigger refresh',
        details: 'Function timeout'
      })
    })
  })

  describe('Single Table Refresh', () => {
    it('should trigger refresh for specific table', async () => {
      const mockConfig = {
        id: 1,
        table_name: 'asin_performance_data',
        table_schema: 'sqp',
        function_name: 'refresh-asin-performance'
      }

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockConfig,
              error: null
            })
          })
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 123 },
              error: null
            })
          })
        })
      }))

      mockSupabase.functions.invoke.mockResolvedValue({
        data: { success: true },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/refresh/trigger', {
        method: 'POST',
        body: JSON.stringify({
          table_name: 'asin_performance_data'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('refresh-asin-performance', {
        body: {
          config: mockConfig,
          auditLogId: 123
        }
      })
      expect(data).toMatchObject({
        success: true,
        message: 'Refresh triggered for table: asin_performance_data',
        type: 'single',
        table: 'asin_performance_data'
      })
    })

    it('should handle non-existent table', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      }))

      const request = new NextRequest('http://localhost:3000/api/refresh/trigger', {
        method: 'POST',
        body: JSON.stringify({
          table_name: 'non_existent_table'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toMatchObject({
        success: false,
        error: 'Table configuration not found',
        table: 'non_existent_table'
      })
    })

    it('should handle disabled table', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                table_name: 'asin_performance_data',
                is_enabled: false
              },
              error: null
            })
          })
        })
      }))

      const request = new NextRequest('http://localhost:3000/api/refresh/trigger', {
        method: 'POST',
        body: JSON.stringify({
          table_name: 'asin_performance_data'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toMatchObject({
        success: false,
        error: 'Table is disabled for refresh',
        table: 'asin_performance_data'
      })
    })
  })

  describe('Validation', () => {
    it('should validate request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/refresh/trigger', {
        method: 'POST',
        body: JSON.stringify({
          table_name: 123 // Invalid type
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid request')
    })

    it('should handle invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/refresh/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'invalid json'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid JSON in request body')
    })
  })

  describe('Force Refresh', () => {
    it('should support force refresh to skip schedule check', async () => {
      const mockConfig = {
        id: 1,
        table_name: 'asin_performance_data',
        last_refresh_at: new Date().toISOString() // Just refreshed
      }

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockConfig,
              error: null
            })
          })
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 124 },
              error: null
            })
          })
        })
      }))

      mockSupabase.functions.invoke.mockResolvedValue({
        data: { success: true },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/refresh/trigger', {
        method: 'POST',
        body: JSON.stringify({
          table_name: 'asin_performance_data',
          force: true
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toContain('(forced)')
    })

    it('should prevent refresh if recently refreshed without force flag', async () => {
      const mockConfig = {
        id: 1,
        table_name: 'asin_performance_data',
        last_refresh_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
        refresh_frequency_hours: 24
      }

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockConfig,
              error: null
            })
          })
        })
      }))

      const request = new NextRequest('http://localhost:3000/api/refresh/trigger', {
        method: 'POST',
        body: JSON.stringify({
          table_name: 'asin_performance_data',
          force: false
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(429)
      expect(data.error).toContain('recently refreshed')
    })
  })
})