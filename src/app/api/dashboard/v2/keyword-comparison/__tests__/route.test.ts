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

describe('GET /api/dashboard/v2/keyword-comparison', () => {
  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    
    vi.mocked(createClient).mockReturnValue(mockSupabase as any)
  })

  it('requires asin parameter', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/dashboard/v2/keyword-comparison?keywords=test1,test2')
    
    const response = await GET(request as any)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.error).toBe('ASIN parameter is required')
  })

  it('requires keywords parameter', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/dashboard/v2/keyword-comparison?asin=B001')
    
    const response = await GET(request as any)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.error).toBe('Keywords parameter is required')
  })

  it('requires startDate parameter', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/dashboard/v2/keyword-comparison?asin=B001&keywords=test1,test2&endDate=2024-01-31')
    
    const response = await GET(request as any)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.error).toBe('Start date parameter is required')
  })

  it('requires endDate parameter', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/dashboard/v2/keyword-comparison?asin=B001&keywords=test1,test2&startDate=2024-01-01')
    
    const response = await GET(request as any)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.error).toBe('End date parameter is required')
  })

  it('validates keywords limit', async () => {
    const keywords = Array.from({ length: 11 }, (_, i) => `keyword${i + 1}`).join(',')
    const request = new MockNextRequest(
      `http://localhost:3000/api/dashboard/v2/keyword-comparison?asin=B001&keywords=${keywords}&startDate=2024-01-01&endDate=2024-01-31`
    )
    
    const response = await GET(request as any)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.error).toBe('Maximum 10 keywords allowed')
  })

  it('fetches comparison data successfully', async () => {
    const mockTimeSeriesData = [
      {
        start_date: '2024-01-01',
        search_query: 'knife sharpener',
        impressions: 1000,
        clicks: 50,
        cart_adds: 15,
        purchases: 7,
      },
      {
        start_date: '2024-01-01',
        search_query: 'electric knife sharpener',
        impressions: 800,
        clicks: 40,
        cart_adds: 12,
        purchases: 6,
      },
      {
        start_date: '2024-01-08',
        search_query: 'knife sharpener',
        impressions: 1200,
        clicks: 60,
        cart_adds: 18,
        purchases: 9,
      },
      {
        start_date: '2024-01-08',
        search_query: 'electric knife sharpener',
        impressions: 900,
        clicks: 45,
        cart_adds: 14,
        purchases: 7,
      },
    ]

    const mockFunnelData = [
      {
        search_query: 'knife sharpener',
        impressions: 2200,
        clicks: 110,
        cart_adds: 33,
        purchases: 16,
      },
      {
        search_query: 'electric knife sharpener',
        impressions: 1700,
        clicks: 85,
        cart_adds: 26,
        purchases: 13,
      },
    ]

    const mockMarketShareData = [
      {
        search_query: 'knife sharpener',
        impression_share: 0.35,
        click_share: 0.32,
        purchase_share: 0.30,
      },
      {
        search_query: 'electric knife sharpener',
        impression_share: 0.20,
        click_share: 0.18,
        purchase_share: 0.15,
      },
    ]

    // Mock time series query
    mockSupabase.from.mockReturnValueOnce({
      ...mockSupabase,
      select: vi.fn().mockReturnValue({
        ...mockSupabase,
        eq: vi.fn().mockReturnValue({
          ...mockSupabase,
          in: vi.fn().mockReturnValue({
            ...mockSupabase,
            gte: vi.fn().mockReturnValue({
              ...mockSupabase,
              lte: vi.fn().mockReturnValue({
                ...mockSupabase,
                order: vi.fn().mockResolvedValue({
                  data: mockTimeSeriesData,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    })

    // Mock funnel totals RPC
    mockSupabase.rpc.mockResolvedValueOnce({
      data: mockFunnelData,
      error: null,
    })

    // Mock market share RPC
    mockSupabase.rpc.mockResolvedValueOnce({
      data: mockMarketShareData,
      error: null,
    })

    const request = new MockNextRequest(
      'http://localhost:3000/api/dashboard/v2/keyword-comparison?asin=B001&keywords=knife%20sharpener,electric%20knife%20sharpener&startDate=2024-01-01&endDate=2024-01-31'
    )
    
    const response = await GET(request as any)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data).toHaveProperty('timeSeries')
    expect(data).toHaveProperty('funnels')
    expect(data).toHaveProperty('marketShare')
    expect(data.timeSeries).toHaveLength(2)
    expect(data.timeSeries[0]).toHaveProperty('knife sharpener')
    expect(data.timeSeries[0]).toHaveProperty('electric knife sharpener')
  })

  it('handles empty results gracefully', async () => {
    // Mock empty results
    mockSupabase.from.mockReturnValueOnce({
      ...mockSupabase,
      select: vi.fn().mockReturnValue({
        ...mockSupabase,
        eq: vi.fn().mockReturnValue({
          ...mockSupabase,
          in: vi.fn().mockReturnValue({
            ...mockSupabase,
            gte: vi.fn().mockReturnValue({
              ...mockSupabase,
              lte: vi.fn().mockReturnValue({
                ...mockSupabase,
                order: vi.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    })

    mockSupabase.rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })

    const request = new MockNextRequest(
      'http://localhost:3000/api/dashboard/v2/keyword-comparison?asin=B001&keywords=test1,test2&startDate=2024-01-01&endDate=2024-01-31'
    )
    
    const response = await GET(request as any)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.timeSeries).toEqual([])
    expect(data.funnels).toEqual({})
    expect(data.marketShare).toEqual({})
  })

  it('handles database errors gracefully', async () => {
    mockSupabase.from.mockReturnValueOnce({
      ...mockSupabase,
      select: vi.fn().mockReturnValue({
        ...mockSupabase,
        eq: vi.fn().mockReturnValue({
          ...mockSupabase,
          in: vi.fn().mockReturnValue({
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
      'http://localhost:3000/api/dashboard/v2/keyword-comparison?asin=B001&keywords=test1,test2&startDate=2024-01-01&endDate=2024-01-31'
    )
    
    const response = await GET(request as any)
    const data = await response.json()
    
    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to fetch keyword comparison data')
  })

  it('validates date format', async () => {
    const request = new MockNextRequest(
      'http://localhost:3000/api/dashboard/v2/keyword-comparison?asin=B001&keywords=test&startDate=invalid-date&endDate=2024-01-31'
    )
    
    const response = await GET(request as any)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid date format')
  })

  it('ensures startDate is before endDate', async () => {
    const request = new MockNextRequest(
      'http://localhost:3000/api/dashboard/v2/keyword-comparison?asin=B001&keywords=test&startDate=2024-01-31&endDate=2024-01-01'
    )
    
    const response = await GET(request as any)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.error).toBe('Start date must be before end date')
  })

  it('handles single keyword request', async () => {
    mockSupabase.from.mockReturnValueOnce({
      ...mockSupabase,
      select: vi.fn().mockReturnValue({
        ...mockSupabase,
        eq: vi.fn().mockReturnValue({
          ...mockSupabase,
          in: vi.fn().mockReturnValue({
            ...mockSupabase,
            gte: vi.fn().mockReturnValue({
              ...mockSupabase,
              lte: vi.fn().mockReturnValue({
                ...mockSupabase,
                order: vi.fn().mockResolvedValue({
                  data: [{ start_date: '2024-01-01', search_query: 'test', impressions: 100 }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    })

    mockSupabase.rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })

    const request = new MockNextRequest(
      'http://localhost:3000/api/dashboard/v2/keyword-comparison?asin=B001&keywords=test&startDate=2024-01-01&endDate=2024-01-31'
    )
    
    const response = await GET(request as any)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.timeSeries).toHaveLength(1)
  })
})