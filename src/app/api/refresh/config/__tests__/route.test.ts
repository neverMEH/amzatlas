import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, PUT } from '../route'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn()
  }))
}))

describe('Refresh Configuration API', () => {
  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = {
      from: vi.fn()
    }
    ;(createClient as any).mockReturnValue(mockSupabase)
  })

  describe('GET /api/refresh/config', () => {
    it('should return all refresh configurations', async () => {
      const mockConfigs = [
        {
          id: 1,
          table_schema: 'sqp',
          table_name: 'asin_performance_data',
          is_enabled: true,
          refresh_frequency_hours: 24,
          priority: 100,
          function_name: 'refresh-asin-performance',
          dependencies: [],
          custom_sync_params: {},
          last_refresh_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          next_refresh_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 2,
          table_schema: 'sqp',
          table_name: 'search_query_performance',
          is_enabled: true,
          refresh_frequency_hours: 24,
          priority: 90,
          function_name: 'refresh-search-queries',
          dependencies: ['asin_performance_data'],
          custom_sync_params: { batch_size: 500 }
        }
      ]

      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockConfigs,
            error: null
          })
        })
      }))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        configurations: expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            table_name: 'asin_performance_data',
            enabled: true,
            frequency_hours: 24,
            priority: 100
          })
        ]),
        summary: {
          total_tables: 2,
          enabled_tables: 2,
          disabled_tables: 0,
          average_frequency_hours: 24
        }
      })
    })

    it('should handle empty configurations', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      }))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.configurations).toHaveLength(0)
      expect(data.summary.total_tables).toBe(0)
    })

    it('should handle database errors', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Connection failed' }
          })
        })
      }))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch refresh configurations')
    })
  })

  describe('PUT /api/refresh/config', () => {
    it('should update table configuration', async () => {
      const mockConfig = {
        id: 1,
        table_name: 'asin_performance_data',
        is_enabled: false,
        refresh_frequency_hours: 12,
        priority: 100
      }

      mockSupabase.from.mockImplementation(() => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...mockConfig, is_enabled: true, refresh_frequency_hours: 6 },
                error: null
              })
            })
          })
        })
      }))

      const request = new NextRequest('http://localhost:3000/api/refresh/config', {
        method: 'PUT',
        body: JSON.stringify({
          id: 1,
          is_enabled: true,
          refresh_frequency_hours: 6
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        success: true,
        message: 'Configuration updated successfully',
        configuration: expect.objectContaining({
          is_enabled: true,
          refresh_frequency_hours: 6
        })
      })
    })

    it('should validate frequency hours', async () => {
      const request = new NextRequest('http://localhost:3000/api/refresh/config', {
        method: 'PUT',
        body: JSON.stringify({
          id: 1,
          refresh_frequency_hours: 0 // Invalid
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('frequency must be at least 1 hour')
    })

    it('should validate priority', async () => {
      const request = new NextRequest('http://localhost:3000/api/refresh/config', {
        method: 'PUT',
        body: JSON.stringify({
          id: 1,
          priority: -10 // Invalid
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Priority must be between 0 and 1000')
    })

    it('should handle non-existent configuration', async () => {
      mockSupabase.from.mockImplementation(() => ({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
              })
            })
          })
        })
      }))

      const request = new NextRequest('http://localhost:3000/api/refresh/config', {
        method: 'PUT',
        body: JSON.stringify({
          id: 999,
          is_enabled: true
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Configuration not found')
    })

    it('should update next_refresh_at when frequency changes', async () => {
      const now = new Date()
      const lastRefresh = new Date(now.getTime() - 12 * 60 * 60 * 1000) // 12 hours ago

      mockSupabase.from.mockImplementation(() => ({
        update: vi.fn().mockImplementation((updates: any) => ({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 1,
                  table_name: 'asin_performance_data',
                  is_enabled: true,
                  refresh_frequency_hours: 6,
                  last_refresh_at: lastRefresh.toISOString(),
                  next_refresh_at: updates.next_refresh_at
                },
                error: null
              })
            })
          })
        }))
      }))

      const request = new NextRequest('http://localhost:3000/api/refresh/config', {
        method: 'PUT',
        body: JSON.stringify({
          id: 1,
          refresh_frequency_hours: 6 // Changed from 24 to 6
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      // Next refresh should be 6 hours from last refresh
      const expectedNextRefresh = new Date(lastRefresh.getTime() + 6 * 60 * 60 * 1000)
      expect(new Date(data.configuration.next_refresh_at).getTime())
        .toBeCloseTo(expectedNextRefresh.getTime(), -3) // Within seconds
    })

    it('should validate custom sync parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/refresh/config', {
        method: 'PUT',
        body: JSON.stringify({
          id: 1,
          custom_sync_params: {
            batch_size: -100 // Invalid
          }
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid custom sync parameters')
    })

    it('should validate dependencies', async () => {
      const request = new NextRequest('http://localhost:3000/api/refresh/config', {
        method: 'PUT',
        body: JSON.stringify({
          id: 1,
          dependencies: ['self_reference'] // Can't depend on self
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid dependencies')
    })

    it('should require at least one field to update', async () => {
      const request = new NextRequest('http://localhost:3000/api/refresh/config', {
        method: 'PUT',
        body: JSON.stringify({
          id: 1
          // No fields to update
        })
      })

      const response = await PUT(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No fields to update')
    })
  })
})