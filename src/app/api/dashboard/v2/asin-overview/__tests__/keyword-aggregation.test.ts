import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Create mock functions
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockSingle = vi.fn()

// Mock the Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            order: mockOrder,
          })),
        })),
        limit: vi.fn(() => ({
          single: mockSingle,
        })),
      })),
      gte: vi.fn(() => ({
        lte: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: mockLimit,
          })),
        })),
      })),
    })),
  })),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

// Import after mocking
import { GET } from '../route'

describe('Keyword Aggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock implementations
    mockOrder.mockReset()
    mockLimit.mockReset()
    mockSingle.mockReset()
  })

  describe('Multi-week date ranges (>7 days)', () => {
    it('should aggregate keywords when date range is more than 7 days', async () => {
      // Mock data for 2 weeks with same keywords
      const mockSearchData = [
        {
          search_query: 'knife sharpener',
          start_date: '2024-01-01',
          end_date: '2024-01-07',
          impressions: 1000,
          clicks: 100,
          cart_adds: 50,
          purchases: 10,
          click_through_rate: 0.1,
          conversion_rate: 0.1,
          impression_share: 0.2,
          click_share: 0.25,
          purchase_share: 0.3,
        },
        {
          search_query: 'knife sharpener',
          start_date: '2024-01-08',
          end_date: '2024-01-14',
          impressions: 1500,
          clicks: 120,
          cart_adds: 60,
          purchases: 15,
          click_through_rate: 0.08,
          conversion_rate: 0.125,
          impression_share: 0.25,
          click_share: 0.3,
          purchase_share: 0.35,
        },
      ]

      // Mock weekly summary data
      const mockWeeklyData = [
        {
          period_start: '2024-01-01',
          period_end: '2024-01-07',
          total_impressions: 5000,
          total_clicks: 400,
          cart_adds: 200,
          total_purchases: 50,
        },
        {
          period_start: '2024-01-08',
          period_end: '2024-01-14',
          total_impressions: 6000,
          total_clicks: 480,
          cart_adds: 240,
          total_purchases: 60,
        },
      ]

      // Mock the supabase calls in order
      // 1. First call is for weekly_summary
      mockOrder.mockResolvedValueOnce({ 
        data: mockWeeklyData, 
        error: null 
      })
      
      // 2. Second call is for asin_brand_mapping
      mockSingle.mockResolvedValueOnce({ 
        data: { asin: 'B001', product_title: 'Test Product' }, 
        error: null 
      })
      
      // 3. Third call is for search_performance_summary
      mockLimit.mockResolvedValueOnce({ 
        data: mockSearchData, 
        error: null 
      })

      const request = new NextRequest('http://localhost:3000/api/dashboard/v2/asin-overview?asin=B001&startDate=2024-01-01&endDate=2024-01-14')
      const response = await GET(request)
      const data = await response.json()

      // Verify aggregation occurred
      expect(data.topQueries).toHaveLength(1)
      
      const aggregatedQuery = data.topQueries[0]
      expect(aggregatedQuery.searchQuery).toBe('knife sharpener')
      
      // Volume metrics should be summed
      expect(aggregatedQuery.impressions).toBe(2500)
      expect(aggregatedQuery.clicks).toBe(220)
      expect(aggregatedQuery.cartAdds).toBe(110)
      expect(aggregatedQuery.purchases).toBe(25)
      
      // Rate metrics should be recalculated based on aggregated data
      expect(aggregatedQuery.ctr).toBeCloseTo(220 / 2500, 4) // 0.088
      expect(aggregatedQuery.cvr).toBeCloseTo(25 / 220, 4) // 0.1136
    })

    it('should aggregate multiple different keywords correctly', async () => {
      const mockSearchData = [
        // Week 1
        {
          search_query: 'knife sharpener',
          start_date: '2024-01-01',
          end_date: '2024-01-07',
          impressions: 1000,
          clicks: 100,
          cart_adds: 50,
          purchases: 10,
          impression_share: 0.4,
        },
        {
          search_query: 'sharpening stone',
          start_date: '2024-01-01',
          end_date: '2024-01-07',
          impressions: 800,
          clicks: 60,
          cart_adds: 30,
          purchases: 5,
          impression_share: 0.32,
        },
        // Week 2
        {
          search_query: 'knife sharpener',
          start_date: '2024-01-08',
          end_date: '2024-01-14',
          impressions: 1200,
          clicks: 110,
          cart_adds: 55,
          purchases: 12,
          impression_share: 0.45,
        },
        {
          search_query: 'sharpening stone',
          start_date: '2024-01-08',
          end_date: '2024-01-14',
          impressions: 900,
          clicks: 70,
          cart_adds: 35,
          purchases: 6,
          impression_share: 0.34,
        },
      ]

      mockSupabase.single.mockResolvedValueOnce({ 
        data: { asin: 'B001', product_title: 'Test Product' }, 
        error: null 
      })
      mockSupabase.limit.mockResolvedValueOnce({ 
        data: mockSearchData, 
        error: null 
      })

      const request = new NextRequest('http://localhost:3000/api/dashboard/v2/asin-overview?asin=B001&startDate=2024-01-01&endDate=2024-01-14')
      const response = await GET(request)
      const data = await response.json()

      expect(data.topQueries).toHaveLength(2)
      
      const knifeSharpener = data.topQueries.find(q => q.searchQuery === 'knife sharpener')
      expect(knifeSharpener.impressions).toBe(2200)
      expect(knifeSharpener.purchases).toBe(22)
      
      const sharpeningStone = data.topQueries.find(q => q.searchQuery === 'sharpening stone')
      expect(sharpeningStone.impressions).toBe(1700)
      expect(sharpeningStone.purchases).toBe(11)
    })

    it('should calculate weighted averages for share metrics', async () => {
      const mockSearchData = [
        {
          search_query: 'knife sharpener',
          start_date: '2024-01-01',
          end_date: '2024-01-07',
          impressions: 1000,
          impression_share: 0.2, // 20% share with 1000 impressions
          click_share: 0.25,
          purchase_share: 0.3,
        },
        {
          search_query: 'knife sharpener',
          start_date: '2024-01-08',
          end_date: '2024-01-14',
          impressions: 2000,
          impression_share: 0.4, // 40% share with 2000 impressions
          click_share: 0.35,
          purchase_share: 0.45,
        },
      ]

      mockSupabase.single.mockResolvedValueOnce({ 
        data: { asin: 'B001', product_title: 'Test Product' }, 
        error: null 
      })
      mockSupabase.limit.mockResolvedValueOnce({ 
        data: mockSearchData, 
        error: null 
      })

      const request = new NextRequest('http://localhost:3000/api/dashboard/v2/asin-overview?asin=B001&startDate=2024-01-01&endDate=2024-01-14')
      const response = await GET(request)
      const data = await response.json()

      const aggregatedQuery = data.topQueries[0]
      // Weighted average: (0.2 * 1000 + 0.4 * 2000) / (1000 + 2000) = (200 + 800) / 3000 = 0.333
      expect(aggregatedQuery.impressionShare).toBeCloseTo(0.333, 3)
    })
  })

  describe('Single-week date ranges (≤7 days)', () => {
    it('should not aggregate keywords for 7-day range', async () => {
      const mockSearchData = [
        {
          search_query: 'knife sharpener',
          start_date: '2024-01-01',
          end_date: '2024-01-07',
          impressions: 1000,
          clicks: 100,
          cart_adds: 50,
          purchases: 10,
          click_through_rate: 0.1,
          conversion_rate: 0.1,
        },
      ]

      mockSupabase.single.mockResolvedValueOnce({ 
        data: { asin: 'B001', product_title: 'Test Product' }, 
        error: null 
      })
      mockSupabase.limit.mockResolvedValueOnce({ 
        data: mockSearchData, 
        error: null 
      })

      const request = new NextRequest('http://localhost:3000/api/dashboard/v2/asin-overview?asin=B001&startDate=2024-01-01&endDate=2024-01-07')
      const response = await GET(request)
      const data = await response.json()

      // Should return data as-is without aggregation
      expect(data.topQueries).toHaveLength(1)
      expect(data.topQueries[0].impressions).toBe(1000)
      expect(data.topQueries[0].ctr).toBe(0.1)
    })
  })

  describe('Comparison period aggregation', () => {
    it('should aggregate comparison period data the same way', async () => {
      // Current period data
      const mockSearchData = [
        {
          search_query: 'knife sharpener',
          start_date: '2024-01-15',
          end_date: '2024-01-21',
          impressions: 1200,
          clicks: 110,
          purchases: 12,
        },
        {
          search_query: 'knife sharpener',
          start_date: '2024-01-22',
          end_date: '2024-01-28',
          impressions: 1300,
          clicks: 130,
          purchases: 15,
        },
      ]

      // Comparison period data
      const mockComparisonData = [
        {
          search_query: 'knife sharpener',
          start_date: '2024-01-01',
          end_date: '2024-01-07',
          impressions: 1000,
          clicks: 100,
          purchases: 10,
        },
        {
          search_query: 'knife sharpener',
          start_date: '2024-01-08',
          end_date: '2024-01-14',
          impressions: 1100,
          clicks: 105,
          purchases: 11,
        },
      ]

      mockSupabase.single.mockResolvedValueOnce({ 
        data: { asin: 'B001', product_title: 'Test Product' }, 
        error: null 
      })
      mockSupabase.limit
        .mockResolvedValueOnce({ data: mockSearchData, error: null })
        .mockResolvedValueOnce({ data: mockComparisonData, error: null })

      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/v2/asin-overview?asin=B001&startDate=2024-01-15&endDate=2024-01-28&compareStartDate=2024-01-01&compareEndDate=2024-01-14'
      )
      const response = await GET(request)
      const data = await response.json()

      // Current period aggregation
      expect(data.topQueries[0].impressions).toBe(2500)
      expect(data.topQueries[0].purchases).toBe(27)

      // Comparison period aggregation
      expect(data.topQueriesComparison[0].impressions).toBe(2100)
      expect(data.topQueriesComparison[0].purchases).toBe(21)
    })
  })

  describe('Edge cases', () => {
    it('should handle no data gracefully', async () => {
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { asin: 'B001', product_title: 'Test Product' }, 
        error: null 
      })
      mockSupabase.limit.mockResolvedValueOnce({ 
        data: [], 
        error: null 
      })

      const request = new NextRequest('http://localhost:3000/api/dashboard/v2/asin-overview?asin=B001&startDate=2024-01-01&endDate=2024-01-14')
      const response = await GET(request)
      const data = await response.json()

      expect(data.topQueries).toEqual([])
    })

    it('should handle keywords that appear in some weeks but not others', async () => {
      const mockSearchData = [
        // Week 1: both keywords
        {
          search_query: 'knife sharpener',
          start_date: '2024-01-01',
          end_date: '2024-01-07',
          impressions: 1000,
          clicks: 100,
          purchases: 10,
        },
        {
          search_query: 'sharpening stone',
          start_date: '2024-01-01',
          end_date: '2024-01-07',
          impressions: 800,
          clicks: 60,
          purchases: 5,
        },
        // Week 2: only knife sharpener
        {
          search_query: 'knife sharpener',
          start_date: '2024-01-08',
          end_date: '2024-01-14',
          impressions: 1200,
          clicks: 110,
          purchases: 12,
        },
      ]

      mockSupabase.single.mockResolvedValueOnce({ 
        data: { asin: 'B001', product_title: 'Test Product' }, 
        error: null 
      })
      mockSupabase.limit.mockResolvedValueOnce({ 
        data: mockSearchData, 
        error: null 
      })

      const request = new NextRequest('http://localhost:3000/api/dashboard/v2/asin-overview?asin=B001&startDate=2024-01-01&endDate=2024-01-14')
      const response = await GET(request)
      const data = await response.json()

      expect(data.topQueries).toHaveLength(2)
      
      const knifeSharpener = data.topQueries.find(q => q.searchQuery === 'knife sharpener')
      expect(knifeSharpener.impressions).toBe(2200)
      
      const sharpeningStone = data.topQueries.find(q => q.searchQuery === 'sharpening stone')
      expect(sharpeningStone.impressions).toBe(800)
    })

    it('should maintain data integrity with CTR = clicks/impressions', async () => {
      const mockSearchData = [
        {
          search_query: 'knife sharpener',
          start_date: '2024-01-01',
          end_date: '2024-01-07',
          impressions: 1000,
          clicks: 100,
        },
        {
          search_query: 'knife sharpener',
          start_date: '2024-01-08',
          end_date: '2024-01-14',
          impressions: 2000,
          clicks: 180,
        },
      ]

      mockSupabase.single.mockResolvedValueOnce({ 
        data: { asin: 'B001', product_title: 'Test Product' }, 
        error: null 
      })
      mockSupabase.limit.mockResolvedValueOnce({ 
        data: mockSearchData, 
        error: null 
      })

      const request = new NextRequest('http://localhost:3000/api/dashboard/v2/asin-overview?asin=B001&startDate=2024-01-01&endDate=2024-01-14')
      const response = await GET(request)
      const data = await response.json()

      const aggregatedQuery = data.topQueries[0]
      const expectedCTR = (100 + 180) / (1000 + 2000) // 280 / 3000 = 0.0933
      expect(aggregatedQuery.ctr).toBeCloseTo(expectedCTR, 4)
    })
  })
})