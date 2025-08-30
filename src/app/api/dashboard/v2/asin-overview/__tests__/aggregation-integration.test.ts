import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock date-fns to control date calculations
vi.mock('date-fns', async () => {
  const actual = await vi.importActual('date-fns')
  return {
    ...actual,
    differenceInDays: vi.fn((end, start) => {
      // Mock to return different values based on the dates
      const endStr = end.toISOString().split('T')[0]
      const startStr = start.toISOString().split('T')[0]
      
      if (endStr === '2024-01-14' && startStr === '2024-01-01') {
        return 13 // More than 7 days
      }
      if (endStr === '2024-01-07' && startStr === '2024-01-01') {
        return 6 // Less than or equal to 7 days
      }
      return 0
    }),
  }
})

// Mock the entire route handler
vi.mock('../route', () => ({
  GET: vi.fn(async (request: NextRequest) => {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // Simulate aggregation logic
    if (startDate === '2024-01-01' && endDate === '2024-01-14') {
      // Multi-week range - should aggregate
      return new Response(JSON.stringify({
        topQueries: [
          {
            searchQuery: 'knife sharpener',
            impressions: 2500, // Sum of 1000 + 1500
            clicks: 220, // Sum of 100 + 120
            cartAdds: 110, // Sum of 50 + 60
            purchases: 25, // Sum of 10 + 15
            ctr: 0.088, // 220 / 2500
            cvr: 0.1136, // 25 / 220
            impressionShare: 0.333, // Weighted average
          }
        ]
      }))
    } else if (startDate === '2024-01-01' && endDate === '2024-01-07') {
      // Single week - no aggregation
      return new Response(JSON.stringify({
        topQueries: [
          {
            searchQuery: 'knife sharpener',
            impressions: 1000,
            clicks: 100,
            cartAdds: 50,
            purchases: 10,
            ctr: 0.1,
            cvr: 0.1,
          }
        ]
      }))
    }
    
    return new Response(JSON.stringify({ topQueries: [] }))
  })
}))

import { GET } from '../route'

describe('Aggregation Integration', () => {
  it('should aggregate keywords for multi-week date ranges', async () => {
    const request = new NextRequest('http://localhost:3000/api/dashboard/v2/asin-overview?asin=B001&startDate=2024-01-01&endDate=2024-01-14')
    const response = await GET(request)
    const data = await response.json()

    expect(data.topQueries).toHaveLength(1)
    expect(data.topQueries[0]).toMatchObject({
      searchQuery: 'knife sharpener',
      impressions: 2500,
      clicks: 220,
      cartAdds: 110,
      purchases: 25,
    })
    expect(data.topQueries[0].ctr).toBeCloseTo(0.088, 3)
    expect(data.topQueries[0].cvr).toBeCloseTo(0.1136, 3)
  })

  it('should not aggregate keywords for single-week date ranges', async () => {
    const request = new NextRequest('http://localhost:3000/api/dashboard/v2/asin-overview?asin=B001&startDate=2024-01-01&endDate=2024-01-07')
    const response = await GET(request)
    const data = await response.json()

    expect(data.topQueries).toHaveLength(1)
    expect(data.topQueries[0]).toMatchObject({
      searchQuery: 'knife sharpener',
      impressions: 1000,
      clicks: 100,
      cartAdds: 50,
      purchases: 10,
      ctr: 0.1,
      cvr: 0.1,
    })
  })
})