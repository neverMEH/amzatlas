import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../route'
import { createClient } from '@/lib/supabase/server'

// Mock the Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

// Mock NextRequest
class MockNextRequest {
  url: string
  
  constructor(url: string) {
    this.url = url
  }
  
  get nextUrl() {
    return new URL(this.url)
  }
}

describe('GET /api/dashboard/v2/keyword-performance', () => {
  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    
    vi.mocked(createClient).mockReturnValue(mockSupabase as any)
  })

  it('requires asin parameter', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/dashboard/v2/keyword-performance?keyword=test')
    
    const response = await GET(request as any)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.error).toBe('ASIN parameter is required')
  })

  it('requires keyword parameter', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/dashboard/v2/keyword-performance?asin=B001')
    
    const response = await GET(request as any)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.error).toBe('Keyword parameter is required')
  })

  it('requires startDate parameter', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/dashboard/v2/keyword-performance?asin=B001&keyword=test&endDate=2024-01-31')
    
    const response = await GET(request as any)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.error).toBe('Start date parameter is required')
  })

  it('requires endDate parameter', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/dashboard/v2/keyword-performance?asin=B001&keyword=test&startDate=2024-01-01')
    
    const response = await GET(request as any)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.error).toBe('End date parameter is required')
  })

  it('fetches keyword performance data successfully', async () => {
    const mockTimeSeries = [
      {
        start_date: '2024-01-01',
        asin_impression_count: 1000,
        asin_click_count: 50,
        asin_cart_add_count: 15,
        asin_purchase_count: 7,
      },
      {
        start_date: '2024-01-08',
        asin_impression_count: 1200,
        asin_click_count: 60,
        asin_cart_add_count: 18,
        asin_purchase_count: 9,
      },
    ]

    const mockFunnelData = {
      impressions: 2200,
      clicks: 110,
      cartAdds: 33,
      purchases: 16,
    }

    // Mock time series query - the API method
    let queryCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      queryCallCount++
      
      if (table === 'search_query_performance' && queryCallCount === 1) {
        // First call: time series data
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  lte: () => ({
                    order: () => Promise.resolve({
                      data: mockTimeSeries,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }
      }
      
      if (table === 'search_query_performance' && queryCallCount === 2) {
        // Second call: market share data (ASINs)
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: () => Promise.resolve({
                  data: [{ asin: 'B001' }, { asin: 'B002' }],
                  error: null,
                }),
              }),
            }),
          }),
        }
      }

      if (table === 'search_query_performance' && queryCallCount === 3) {
        // Third call: manual aggregation data
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: () => Promise.resolve({
                  data: [
                    { asin: 'B001', asin_impression_count: 1500, asin_click_count: 75, asin_purchase_count: 10 },
                    { asin: 'B002', asin_impression_count: 700, asin_click_count: 35, asin_purchase_count: 6 },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }
      }

      if (table === 'asin_performance_data') {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [
                { asin: 'B001', product_title: 'Product A' },
                { asin: 'B002', product_title: 'Product B' }
              ],
              error: null,
            }),
          }),
        }
      }

      if (table === 'asin_brand_mapping') {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [
                { asin: 'B001', brand_id: 'brand-1' },
                { asin: 'B002', brand_id: 'brand-2' }
              ],
              error: null,
            }),
          }),
        }
      }

      if (table === 'brands') {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [
                { id: 'brand-1', brand_name: 'Brand A' },
                { id: 'brand-2', brand_name: 'Brand B' }
              ],
              error: null,
            }),
          }),
        }
      }

      // Default empty response
      return {
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }
    })

    const request = new MockNextRequest(
      'http://localhost:3000/api/dashboard/v2/keyword-performance?asin=B001&keyword=knife%20sharpener&startDate=2024-01-01&endDate=2024-01-31'
    )
    
    const response = await GET(request as any)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data).toHaveProperty('timeSeries')
    expect(data).toHaveProperty('funnelData')
    expect(data).toHaveProperty('marketShare')
    expect(data.timeSeries).toHaveLength(2)
    expect(data.funnelData).toEqual(mockFunnelData)
    expect(data.marketShare.competitors).toHaveLength(2)
  })

  it('handles comparison date range', async () => {
    const mockTimeSeries = [{ 
      start_date: '2024-01-01', 
      asin_impression_count: 1000,
      asin_click_count: 50,
      asin_cart_add_count: 15,
      asin_purchase_count: 7
    }]
    const mockComparisonTimeSeries = [{ 
      start_date: '2023-12-01', 
      asin_impression_count: 800,
      asin_click_count: 40,
      asin_cart_add_count: 12,
      asin_purchase_count: 6
    }]

    let queryCallCount = 0
    mockSupabase.from.mockImplementation((table: string) => {
      queryCallCount++
      
      if (table === 'search_query_performance' && queryCallCount === 1) {
        // First call: time series data (current period)
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  lte: () => ({
                    order: () => Promise.resolve({
                      data: mockTimeSeries,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }
      }
      
      if (table === 'search_query_performance' && queryCallCount === 2) {
        // Second call: market share ASINs
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: () => Promise.resolve({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        }
      }

      if (table === 'search_query_performance' && queryCallCount === 3) {
        // Third call: aggregation data
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: () => Promise.resolve({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        }
      }

      if (table === 'search_query_performance' && queryCallCount === 4) {
        // Fourth call: comparison time series
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                gte: () => ({
                  lte: () => ({
                    order: () => Promise.resolve({
                      data: mockComparisonTimeSeries,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }
      }

      if (table === 'search_query_performance' && queryCallCount === 5) {
        // Fifth call: comparison period aggregation
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lte: () => Promise.resolve({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        }
      }

      // Mock other table queries
      if (table === 'asin_performance_data' || table === 'asin_brand_mapping' || table === 'brands') {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [],
              error: null,
            }),
          }),
        }
      }

      // Default
      return {
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }
    })

    const request = new MockNextRequest(
      'http://localhost:3000/api/dashboard/v2/keyword-performance?asin=B001&keyword=test&startDate=2024-01-01&endDate=2024-01-31&compareStartDate=2023-12-01&compareEndDate=2023-12-31'
    )
    
    const response = await GET(request as any)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data).toHaveProperty('comparisonTimeSeries')
    expect(data).toHaveProperty('comparisonFunnelData')
  })

  it('handles database errors gracefully', async () => {
    mockSupabase.from.mockReturnValueOnce({
      ...mockSupabase,
      select: vi.fn().mockReturnValue({
        ...mockSupabase,
        eq: vi.fn().mockReturnValue({
          ...mockSupabase,
          eq: vi.fn().mockReturnValue({
            ...mockSupabase,
            gte: vi.fn().mockReturnValue({
              ...mockSupabase,
              lte: vi.fn().mockReturnValue({
                ...mockSupabase,
                order: vi.fn().mockResolvedValue({
                  data: null,
                  error: new Error('Database connection failed'),
                }),
              }),
            }),
          }),
        }),
      }),
    })

    const request = new MockNextRequest(
      'http://localhost:3000/api/dashboard/v2/keyword-performance?asin=B001&keyword=test&startDate=2024-01-01&endDate=2024-01-31'
    )
    
    const response = await GET(request as any)
    const data = await response.json()
    
    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to fetch keyword performance data')
  })

  it('validates date format', async () => {
    const request = new MockNextRequest(
      'http://localhost:3000/api/dashboard/v2/keyword-performance?asin=B001&keyword=test&startDate=invalid-date&endDate=2024-01-31'
    )
    
    const response = await GET(request as any)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid date format')
  })

  it('ensures startDate is before endDate', async () => {
    const request = new MockNextRequest(
      'http://localhost:3000/api/dashboard/v2/keyword-performance?asin=B001&keyword=test&startDate=2024-01-31&endDate=2024-01-01'
    )
    
    const response = await GET(request as any)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.error).toBe('Start date must be before end date')
  })
})