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
        impressions: 1000,
        clicks: 50,
        cart_adds: 15,
        purchases: 7,
      },
      {
        start_date: '2024-01-08',
        impressions: 1200,
        clicks: 60,
        cart_adds: 18,
        purchases: 9,
      },
    ]

    const mockFunnelData = {
      impressions: 2200,
      clicks: 110,
      cart_adds: 33,
      purchases: 16,
    }

    const mockMarketShare = [
      {
        asin: 'B001',
        brand: 'Brand A',
        title: 'Product A',
        impression_share: 0.25,
        click_share: 0.30,
        purchase_share: 0.35,
      },
      {
        asin: 'B002',
        brand: 'Brand B',
        title: 'Product B',
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
          eq: vi.fn().mockReturnValue({
            ...mockSupabase,
            gte: vi.fn().mockReturnValue({
              ...mockSupabase,
              lte: vi.fn().mockReturnValue({
                ...mockSupabase,
                order: vi.fn().mockResolvedValue({
                  data: mockTimeSeries,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    })

    // Mock funnel data RPC
    mockSupabase.rpc.mockResolvedValueOnce({
      data: [mockFunnelData],
      error: null,
    })

    // Mock market share RPC
    mockSupabase.rpc.mockResolvedValueOnce({
      data: mockMarketShare,
      error: null,
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
    const mockTimeSeries = [{ start_date: '2024-01-01', impressions: 1000 }]
    const mockComparisonTimeSeries = [{ start_date: '2023-12-01', impressions: 800 }]

    // Mock current period
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
                  data: mockTimeSeries,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    })

    // Mock comparison period
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
                  data: mockComparisonTimeSeries,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    })

    // Mock RPC calls in order: funnel data, market share, comparison funnel, comparison market share
    mockSupabase.rpc
      .mockResolvedValueOnce({ data: [{ impressions: 1000, clicks: 50, cartAdds: 15, purchases: 7 }], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [{ impressions: 800, clicks: 40, cartAdds: 12, purchases: 6 }], error: null })
      .mockResolvedValueOnce({ data: [], error: null })

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