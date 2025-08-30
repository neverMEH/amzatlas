import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../../app/api/dashboard/v2/asin-overview/route'
import { createClient } from '@supabase/supabase-js'

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { product_title: 'Test Product' },
            error: null,
          })),
        })),
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                data: null,
                error: null,
              })),
            })),
          })),
        })),
      })),
    })),
    rpc: vi.fn(),
  })),
}))

describe('Keyword Aggregation API Integration', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = createClient('', '')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('aggregates keywords for date ranges > 7 days', async () => {
    // Mock data for 2 weeks
    const mockData = [
      {
        search_query: 'knife sharpener',
        start_date: '2024-08-01',
        end_date: '2024-08-07',
        impressions: 10000,
        clicks: 800,
        cart_adds: 240,
        purchases: 80,
        click_through_rate: 0.08,
        conversion_rate: 0.1,
        cart_add_rate: 0.3,
        purchase_rate: 0.333,
        impression_share: 0.25,
        click_share: 0.28,
        purchase_share: 0.32,
      },
      {
        search_query: 'knife sharpener',
        start_date: '2024-08-08',
        end_date: '2024-08-14',
        impressions: 15000,
        clicks: 1400,
        cart_adds: 420,
        purchases: 140,
        click_through_rate: 0.093,
        conversion_rate: 0.1,
        cart_add_rate: 0.3,
        purchase_rate: 0.333,
        impression_share: 0.27,
        click_share: 0.30,
        purchase_share: 0.34,
      },
      {
        search_query: 'electric knife sharpener',
        start_date: '2024-08-01',
        end_date: '2024-08-07',
        impressions: 8000,
        clicks: 600,
        cart_adds: 180,
        purchases: 60,
        click_through_rate: 0.075,
        conversion_rate: 0.1,
        cart_add_rate: 0.3,
        purchase_rate: 0.333,
        impression_share: 0.20,
        click_share: 0.22,
        purchase_share: 0.24,
      },
    ]

    // Mock the search query data
    mockSupabase.from = vi.fn(() => ({
      select: vi.fn(() => ({
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                data: mockData,
                error: null,
              })),
            })),
          })),
        })),
      })),
    }))

    // Create request for 14-day range
    const request = new NextRequest('http://localhost:3000/api/dashboard/v2/asin-overview?asin=B001DT&startDate=2024-08-01&endDate=2024-08-14&includeQueries=true')

    const response = await GET(request)
    const data = await response.json()

    // Verify aggregation occurred
    expect(data.topQueries).toBeDefined()
    expect(data.topQueries).toHaveLength(2) // Only 2 unique keywords
    
    // Find aggregated data for 'knife sharpener'
    const knifeSharpener = data.topQueries.find((q: any) => q.searchQuery === 'knife sharpener')
    expect(knifeSharpener).toBeDefined()
    
    // Verify aggregated values
    expect(knifeSharpener.impressions).toBe(25000) // 10000 + 15000
    expect(knifeSharpener.clicks).toBe(2200) // 800 + 1400
    expect(knifeSharpener.purchases).toBe(220) // 80 + 140
    
    // Verify recalculated CTR
    expect(knifeSharpener.ctr).toBeCloseTo(0.088, 3) // 2200/25000
    
    // Verify weighted average for impression share
    const expectedImpressionShare = (0.25 * 10000 + 0.27 * 15000) / 25000
    expect(knifeSharpener.impressionShare).toBeCloseTo(expectedImpressionShare, 3)
  })

  it('does not aggregate keywords for date ranges ≤ 7 days', async () => {
    // Mock data for 1 week
    const mockData = [
      {
        search_query: 'knife sharpener',
        start_date: '2024-08-01',
        end_date: '2024-08-07',
        impressions: 10000,
        clicks: 800,
        cart_adds: 240,
        purchases: 80,
        click_through_rate: 0.08,
        conversion_rate: 0.1,
        cart_add_rate: 0.3,
        purchase_rate: 0.333,
        impression_share: 0.25,
        click_share: 0.28,
        purchase_share: 0.32,
      },
      {
        search_query: 'knife sharpener deluxe',
        start_date: '2024-08-01',
        end_date: '2024-08-07',
        impressions: 5000,
        clicks: 400,
        cart_adds: 120,
        purchases: 40,
        click_through_rate: 0.08,
        conversion_rate: 0.1,
        cart_add_rate: 0.3,
        purchase_rate: 0.333,
        impression_share: 0.20,
        click_share: 0.22,
        purchase_share: 0.24,
      },
    ]

    mockSupabase.from = vi.fn(() => ({
      select: vi.fn(() => ({
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                data: mockData,
                error: null,
              })),
            })),
          })),
        })),
      })),
    }))

    // Create request for 7-day range
    const request = new NextRequest('http://localhost:3000/api/dashboard/v2/asin-overview?asin=B001DT&startDate=2024-08-01&endDate=2024-08-07&includeQueries=true')

    const response = await GET(request)
    const data = await response.json()

    // Verify no aggregation occurred
    expect(data.topQueries).toBeDefined()
    expect(data.topQueries).toHaveLength(2) // Both entries preserved
    
    // Verify data is unchanged
    expect(data.topQueries[0].searchQuery).toBe('knife sharpener')
    expect(data.topQueries[0].impressions).toBe(10000)
    expect(data.topQueries[1].searchQuery).toBe('knife sharpener deluxe')
    expect(data.topQueries[1].impressions).toBe(5000)
  })

  it('aggregates comparison period data when date range > 7 days', async () => {
    // Mock current period data
    const mockCurrentData = [
      {
        search_query: 'knife sharpener',
        impressions: 25000,
        clicks: 2200,
        cart_adds: 660,
        purchases: 220,
        click_through_rate: 0.088,
        conversion_rate: 0.1,
        cart_add_rate: 0.3,
        purchase_rate: 0.333,
        impression_share: 0.26,
        click_share: 0.29,
        purchase_share: 0.33,
      },
    ]

    // Mock comparison period data (needs aggregation)
    const mockComparisonData = [
      {
        search_query: 'knife sharpener',
        start_date: '2024-07-18',
        end_date: '2024-07-24',
        impressions: 8000,
        clicks: 600,
        cart_adds: 180,
        purchases: 60,
        click_through_rate: 0.075,
        conversion_rate: 0.1,
        cart_add_rate: 0.3,
        purchase_rate: 0.333,
        impression_share: 0.22,
        click_share: 0.24,
        purchase_share: 0.26,
      },
      {
        search_query: 'knife sharpener',
        start_date: '2024-07-25',
        end_date: '2024-07-31',
        impressions: 12000,
        clicks: 1000,
        cart_adds: 300,
        purchases: 100,
        click_through_rate: 0.083,
        conversion_rate: 0.1,
        cart_add_rate: 0.3,
        purchase_rate: 0.333,
        impression_share: 0.24,
        click_share: 0.26,
        purchase_share: 0.28,
      },
    ]

    let callCount = 0
    mockSupabase.from = vi.fn(() => ({
      select: vi.fn(() => ({
        gte: vi.fn(() => ({
          lte: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => {
                callCount++
                return {
                  data: callCount === 2 ? mockCurrentData : mockComparisonData,
                  error: null,
                }
              }),
            })),
          })),
        })),
      })),
    }))

    // Create request with comparison period
    const request = new NextRequest('http://localhost:3000/api/dashboard/v2/asin-overview?asin=B001DT&startDate=2024-08-01&endDate=2024-08-14&compareStartDate=2024-07-18&compareEndDate=2024-07-31&includeQueries=true')

    const response = await GET(request)
    const data = await response.json()

    // Verify both periods have aggregated data
    expect(data.topQueries).toBeDefined()
    expect(data.topQueriesComparison).toBeDefined()
    
    // Verify comparison data is aggregated
    const comparisonKnifeSharpener = data.topQueriesComparison[0]
    expect(comparisonKnifeSharpener.searchQuery).toBe('knife sharpener')
    expect(comparisonKnifeSharpener.impressions).toBe(20000) // 8000 + 12000
    expect(comparisonKnifeSharpener.clicks).toBe(1600) // 600 + 1000
    
    // Verify recalculated CTR for comparison
    expect(comparisonKnifeSharpener.ctr).toBeCloseTo(0.08, 3) // 1600/20000
  })

  describe('Date Range Calculations', () => {
    it('correctly identifies aggregation thresholds', async () => {
      const { shouldAggregateKeywords } = await import('../../app/api/dashboard/v2/asin-overview/utils/keyword-aggregation')
      
      // Test various date ranges
      expect(shouldAggregateKeywords('2024-08-01', '2024-08-07')).toBe(false) // 6 days
      expect(shouldAggregateKeywords('2024-08-01', '2024-08-08')).toBe(false) // 7 days
      expect(shouldAggregateKeywords('2024-08-01', '2024-08-09')).toBe(true)  // 8 days
      expect(shouldAggregateKeywords('2024-08-01', '2024-08-14')).toBe(true)  // 13 days
      expect(shouldAggregateKeywords('2024-08-01', '2024-08-31')).toBe(true)  // 30 days
      
      // Edge case: same day
      expect(shouldAggregateKeywords('2024-08-01', '2024-08-01')).toBe(false) // 0 days
    })
  })
})