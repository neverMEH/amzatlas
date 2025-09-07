import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { createClient } from '@/lib/supabase/server'

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn()
}))

describe('GET /api/brands', () => {
  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create mock Supabase client structure
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    }
    
    ;(createClient as any).mockReturnValue(mockSupabase)
  })

  it('should return brands successfully', async () => {
    const mockBrands = [
      { id: '550e8400-e29b-41d4-a716-446655440000', display_name: 'Work Sharp' },
      { id: '660e8400-e29b-41d4-a716-446655440001', display_name: 'Amazon Basics' },
      { id: '770e8400-e29b-41d4-a716-446655440002', display_name: 'Nike' },
    ]

    mockSupabase.order.mockResolvedValue({
      data: mockBrands,
      error: null
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ data: mockBrands })
    expect(mockSupabase.from).toHaveBeenCalledWith('brands')
    expect(mockSupabase.select).toHaveBeenCalledWith('id, display_name')
    expect(mockSupabase.eq).toHaveBeenCalledWith('is_active', true)
    expect(mockSupabase.order).toHaveBeenCalledWith('display_name', { ascending: true })
  })

  it('should return empty array when no brands exist', async () => {
    mockSupabase.order.mockResolvedValue({
      data: [],
      error: null
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ data: [] })
  })

  it('should handle null data from Supabase', async () => {
    mockSupabase.order.mockResolvedValue({
      data: null,
      error: null
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ data: [] })
  })

  it('should handle Supabase errors', async () => {
    const mockError = {
      message: 'Database connection failed',
      code: 'CONNECTION_ERROR'
    }

    mockSupabase.order.mockResolvedValue({
      data: null,
      error: mockError
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({
      error: 'Failed to fetch brands',
      message: 'Database connection failed'
    })
  })

  it('should handle unexpected errors', async () => {
    mockSupabase.from.mockImplementation(() => {
      throw new Error('Unexpected error')
    })

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toEqual({
      error: 'Internal server error'
    })
  })

  it('should filter by is_active = true', async () => {
    const mockBrands = [
      { id: '550e8400-e29b-41d4-a716-446655440000', display_name: 'Work Sharp' }
    ]

    mockSupabase.order.mockResolvedValue({
      data: mockBrands,
      error: null
    })

    await GET()

    expect(mockSupabase.eq).toHaveBeenCalledWith('is_active', true)
  })

  it('should order brands alphabetically by display_name', async () => {
    const mockBrands = [
      { id: '660e8400-e29b-41d4-a716-446655440001', display_name: 'Amazon Basics' },
      { id: '770e8400-e29b-41d4-a716-446655440002', display_name: 'Nike' },
      { id: '550e8400-e29b-41d4-a716-446655440000', display_name: 'Work Sharp' }
    ]

    mockSupabase.order.mockResolvedValue({
      data: mockBrands,
      error: null
    })

    await GET()

    expect(mockSupabase.order).toHaveBeenCalledWith('display_name', { ascending: true })
  })
})