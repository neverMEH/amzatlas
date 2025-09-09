import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn()
}))

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn((date, format) => '2025-01-01'),
  subDays: vi.fn((date, days) => new Date('2024-12-01')),
  startOfDay: vi.fn((date) => date),
  endOfDay: vi.fn((date) => date),
}))

describe('GET /api/brands/[brandId]/dashboard', () => {
  let mockSupabase: any
  const brandId = '550e8400-e29b-41d4-a716-446655440000'

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create mock Supabase client structure
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    }
    
    ;(createClient as any).mockReturnValue(mockSupabase)
  })

  const createRequest = (params: Record<string, string> = {}) => {
    const url = new URL(`http://localhost:3000/api/brands/${brandId}/dashboard`)
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
    return new NextRequest(url)
  }

  it('should return dashboard data successfully', async () => {
    // Mock brand data
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: brandId, display_name: 'Work Sharp' },
      error: null
    })

    // Mock ASIN mapping
    mockSupabase.eq.mockImplementation(function() {
      if (this._lastCall === 'asin_brand_mapping') {
        return {
          data: [{ asin: 'B001' }, { asin: 'B002' }],
          error: null
        }
      }
      return this
    })

    // Mock KPI data
    mockSupabase.lte.mockImplementation(function() {
      if (this._lastCall === 'search_performance_summary') {
        return {
          data: [
            { impressions: 1000, clicks: 100, cart_adds: 50, purchases: 25 },
            { impressions: 2000, clicks: 200, cart_adds: 100, purchases: 50 }
          ],
          error: null
        }
      }
      return this
    })

    // Mock daily data
    mockSupabase.order.mockImplementation(function() {
      if (this._lastCall === 'daily_sqp_data') {
        return {
          data: [
            { date: '2025-01-01', impressions: 1000, clicks: 100, cart_adds: 50, purchases: 25 },
            { date: '2025-01-02', impressions: 2000, clicks: 200, cart_adds: 100, purchases: 50 }
          ],
          error: null
        }
      }
      return this
    })

    // Mock product data
    mockSupabase.limit.mockImplementation(function() {
      if (this._lastCall === 'asin_performance_by_brand') {
        return {
          data: [{
            asin: 'B001',
            product_title: 'Test Product 1',
            impressions: 3000,
            clicks: 300,
            cart_adds: 150,
            purchases: 75,
            click_through_rate: 10.0,
            conversion_rate: 25.0,
            impression_share: 30.0
          }],
          error: null
        }
      }
      // Mock search queries
      return {
        data: [{
          search_query: 'test query',
          impressions: 5000,
          clicks: 500,
          cart_adds: 250,
          purchases: 125,
          ctr: 10.0,
          cvr: 25.0
        }],
        error: null
      }
    })

    // Track method calls
    mockSupabase.from.mockImplementation(function(table: string) {
      this._lastCall = table
      return this
    })

    const request = createRequest()
    const response = await GET(request, { params: { brandId } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data).toBeDefined()
    expect(data.data.kpis).toBeDefined()
    expect(data.data.kpis.impressions.value).toBe(3000)
    expect(data.data.kpis.clicks.value).toBe(300)
    expect(data.data.products).toHaveLength(1)
    expect(data.data.searchQueries).toHaveLength(1)
    expect(data.meta.brand.display_name).toBe('Work Sharp')
  })

  it('should return 404 when brand not found', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Brand not found' }
    })

    const request = createRequest()
    const response = await GET(request, { params: { brandId } })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error.code).toBe('BRAND_NOT_FOUND')
  })

  it('should handle empty ASIN list gracefully', async () => {
    // Mock brand data
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: brandId, display_name: 'Work Sharp' },
      error: null
    })

    // Mock empty ASIN mapping
    mockSupabase.eq.mockReturnValue({
      data: [],
      error: null
    })

    const request = createRequest()
    const response = await GET(request, { params: { brandId } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.kpis.impressions.value).toBe(0)
    expect(data.data.products).toHaveLength(0)
    expect(data.data.searchQueries).toHaveLength(0)
  })

  it('should handle comparison period parameters', async () => {
    let callCount = 0
    
    // Setup mocks with proper chaining
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: brandId, display_name: 'Work Sharp' },
      error: null
    })

    mockSupabase.eq.mockReturnValue({
      data: [{ asin: 'B001' }],
      error: null
    })

    // Mock different responses for multiple calls
    mockSupabase.lte.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // Current period data
        return Promise.resolve({
          data: [{ impressions: 3000, clicks: 300, cart_adds: 150, purchases: 75 }],
          error: null
        })
      } else {
        // Comparison period data
        return Promise.resolve({
          data: [{ impressions: 2000, clicks: 200, cart_adds: 100, purchases: 50 }],
          error: null
        })
      }
    })

    // Daily data
    mockSupabase.order.mockResolvedValue({
      data: [],
      error: null
    })

    // Products and queries
    mockSupabase.limit.mockResolvedValue({ data: [], error: null })

    const request = createRequest({
      comparison_date_from: '2024-12-01',
      comparison_date_to: '2024-12-31'
    })
    
    const response = await GET(request, { params: { brandId } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.kpis.impressions.comparison).toBe(50) // 50% increase
    expect(data.meta.comparisonDateRange).toEqual({
      from: '2024-12-01',
      to: '2024-12-31'
    })
  })

  it('should respect product and query limits', async () => {
    // Setup basic mocks
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: brandId, display_name: 'Work Sharp' },
      error: null
    })

    mockSupabase.eq.mockReturnValue({
      data: [{ asin: 'B001' }],
      error: null
    })

    mockSupabase.lte.mockResolvedValue({ data: [], error: null })
    mockSupabase.order.mockResolvedValue({ data: [], error: null })
    mockSupabase.limit.mockResolvedValue({ data: [], error: null })

    const request = createRequest({
      product_limit: '10',
      query_limit: '20'
    })
    
    await GET(request, { params: { brandId } })

    // Check that limit was called with correct values
    const limitCalls = mockSupabase.limit.mock.calls
    expect(limitCalls).toHaveLength(2)
    expect(limitCalls[0][0]).toBe(10) // product limit
    expect(limitCalls[1][0]).toBe(20) // query limit
  })

  it('should handle database errors gracefully', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: brandId, display_name: 'Work Sharp' },
      error: null
    })

    mockSupabase.eq.mockReturnValueOnce({
      data: null,
      error: { message: 'Database error' }
    })

    const request = createRequest()
    const response = await GET(request, { params: { brandId } })
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error.code).toBe('DATABASE_ERROR')
  })

  it('should return product titles in product list', async () => {
    // Mock brand data
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: brandId, display_name: 'Work Sharp' },
      error: null
    })

    // Mock ASIN mapping
    mockSupabase.eq.mockImplementation(function() {
      if (this._lastCall === 'asin_brand_mapping') {
        return {
          data: [{ asin: 'B001' }, { asin: 'B002' }],
          error: null
        }
      }
      return this
    })

    // Mock search_performance_summary data with product titles
    mockSupabase.lte.mockImplementation(function() {
      if (this._lastCall === 'search_performance_summary') {
        return {
          data: [
            { 
              asin: 'B001',
              product_title: 'Work Sharp Knife Sharpener',
              impressions: 1000, 
              clicks: 100, 
              cart_adds: 50, 
              purchases: 25 
            },
            { 
              asin: 'B002',
              product_title: 'Work Sharp Tool Grinder',
              impressions: 2000, 
              clicks: 200, 
              cart_adds: 100, 
              purchases: 50 
            }
          ],
          error: null
        }
      }
      return this
    })

    // Mock daily data
    mockSupabase.order.mockImplementation(function() {
      return { data: [], error: null }
    })

    // Mock product data with product titles
    mockSupabase.limit.mockImplementation(function() {
      if (this._lastCall === 'asin_performance_by_brand') {
        return {
          data: [
            {
              asin: 'B001',
              product_title: 'Work Sharp Knife Sharpener',
              impressions: 3000,
              clicks: 300,
              cart_adds: 150,
              purchases: 75,
              click_through_rate: 10.0,
              conversion_rate: 25.0,
              impression_share: 30.0
            },
            {
              asin: 'B002',
              product_title: 'Work Sharp Tool Grinder',
              impressions: 2500,
              clicks: 250,
              cart_adds: 125,
              purchases: 60,
              click_through_rate: 10.0,
              conversion_rate: 24.0,
              impression_share: 25.0
            }
          ],
          error: null
        }
      }
      // Mock search queries
      return { data: [], error: null }
    })

    // Track method calls
    mockSupabase.from.mockImplementation(function(table: string) {
      this._lastCall = table
      return this
    })

    const request = createRequest()
    const response = await GET(request, { params: { brandId } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.products).toHaveLength(2)
    
    // Check that products have names that are product titles, not ASINs
    expect(data.data.products[0].name).toBe('Work Sharp Knife Sharpener')
    expect(data.data.products[0].asin).toBe('B001')
    expect(data.data.products[1].name).toBe('Work Sharp Tool Grinder')
    expect(data.data.products[1].asin).toBe('B002')
  })

  it('should handle missing product titles with fallback to ASIN', async () => {
    // Mock brand data
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: brandId, display_name: 'Work Sharp' },
      error: null
    })

    // Mock ASIN mapping
    mockSupabase.eq.mockImplementation(function() {
      if (this._lastCall === 'asin_brand_mapping') {
        return {
          data: [{ asin: 'B001' }, { asin: 'B002' }],
          error: null
        }
      }
      return this
    })

    // Mock search_performance_summary data - some with titles, some without
    mockSupabase.lte.mockImplementation(function() {
      if (this._lastCall === 'search_performance_summary') {
        return {
          data: [
            { 
              asin: 'B001',
              product_title: 'Work Sharp Knife Sharpener',
              impressions: 1000, 
              clicks: 100, 
              cart_adds: 50, 
              purchases: 25 
            },
            { 
              asin: 'B002',
              product_title: null, // No title available
              impressions: 2000, 
              clicks: 200, 
              cart_adds: 100, 
              purchases: 50 
            }
          ],
          error: null
        }
      }
      return this
    })

    // Mock daily data
    mockSupabase.order.mockImplementation(function() {
      return { data: [], error: null }
    })

    // Mock product data with one missing title
    mockSupabase.limit.mockImplementation(function() {
      if (this._lastCall === 'asin_performance_by_brand') {
        return {
          data: [
            {
              asin: 'B001',
              product_title: 'Work Sharp Knife Sharpener',
              impressions: 3000,
              clicks: 300,
              cart_adds: 150,
              purchases: 75,
              click_through_rate: 10.0,
              conversion_rate: 25.0,
              impression_share: 30.0
            },
            {
              asin: 'B002',
              product_title: null, // Missing title
              impressions: 2500,
              clicks: 250,
              cart_adds: 125,
              purchases: 60,
              click_through_rate: 10.0,
              conversion_rate: 24.0,
              impression_share: 25.0
            }
          ],
          error: null
        }
      }
      // Mock search queries
      return { data: [], error: null }
    })

    // Track method calls
    mockSupabase.from.mockImplementation(function(table: string) {
      this._lastCall = table
      return this
    })

    const request = createRequest()
    const response = await GET(request, { params: { brandId } })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.products).toHaveLength(2)
    
    // Check fallback behavior
    expect(data.data.products[0].name).toBe('Work Sharp Knife Sharpener')
    expect(data.data.products[0].asin).toBe('B001')
    expect(data.data.products[1].name).toBe('B002') // Falls back to ASIN when title is null
    expect(data.data.products[1].asin).toBe('B002')
  })
})