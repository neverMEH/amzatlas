import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../route'

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  in: vi.fn(() => mockSupabase),
  gte: vi.fn(() => mockSupabase),
  lte: vi.fn(() => mockSupabase),
  order: vi.fn(() => mockSupabase),
  limit: vi.fn(() => mockSupabase),
  single: vi.fn(),
  rpc: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase,
}))

// Mock segment data
const mockSegmentData = [
  {
    segment_type: 'weekly',
    segment_start_date: '2024-08-25',
    segment_end_date: '2024-08-25',
    total_impressions: 150000,
    total_clicks: 375,
    total_cart_adds: 75,
    total_purchases: 25,
    click_through_rate: 0.0025,
    conversion_rate: 0.0667,
    cart_add_rate: 0.2,
    click_share: 0.15,
    cart_add_share: 0.12,
    purchase_share: 0.08,
    query_count: 45,
    top_query: 'knife sharpener',
    top_query_purchases: 8,
    data_quality: 'high',
  },
  {
    segment_type: 'weekly',
    segment_start_date: '2024-09-01',
    segment_end_date: '2024-09-01',
    total_impressions: 175000,
    total_clicks: 420,
    total_cart_adds: 88,
    total_purchases: 32,
    click_through_rate: 0.0024,
    conversion_rate: 0.0762,
    cart_add_rate: 0.21,
    click_share: 0.18,
    cart_add_share: 0.14,
    purchase_share: 0.10,
    query_count: 52,
    top_query: 'electric knife sharpener',
    top_query_purchases: 12,
    data_quality: 'high',
  },
  {
    segment_type: 'weekly',
    segment_start_date: '2024-09-08',
    segment_end_date: '2024-09-08',
    total_impressions: 165000,
    total_clicks: 385,
    total_cart_adds: 82,
    total_purchases: 28,
    click_through_rate: 0.0023,
    conversion_rate: 0.0727,
    cart_add_rate: 0.213,
    click_share: 0.16,
    cart_add_share: 0.13,
    purchase_share: 0.09,
    query_count: 48,
    top_query: 'sharpening system',
    top_query_purchases: 10,
    data_quality: 'high',
  },
  {
    segment_type: 'weekly',
    segment_start_date: '2024-09-15',
    segment_end_date: '2024-09-15',
    total_impressions: 155000,
    total_clicks: 360,
    total_cart_adds: 70,
    total_purchases: 22,
    click_through_rate: 0.0023,
    conversion_rate: 0.0611,
    cart_add_rate: 0.194,
    click_share: 0.14,
    cart_add_share: 0.11,
    purchase_share: 0.07,
    query_count: 42,
    top_query: 'precision knife sharpener',
    top_query_purchases: 7,
    data_quality: 'medium',
  },
]

const mockBrand = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  brand_name: 'Work Sharp',
}

const mockAsinMapping = {
  asin: 'B08N5WRWNW',
  product_title: 'Work Sharp Precision Adjust Knife Sharpener',
  brand_id: '123e4567-e89b-12d3-a456-426614174000',
}

describe('/api/brands/[brandId]/products/[asin]/segments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/brands/[brandId]/products/[asin]/segments', () => {
    it('should return segment data for valid brand and ASIN', async () => {
      // Mock successful responses
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValueOnce({ data: mockAsinMapping, error: null })
      mockSupabase.single.mockResolvedValue({ data: mockSegmentData, error: null })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products/B08N5WRWNW/segments')
      const response = await GET(request, {
        params: { 
          brandId: '123e4567-e89b-12d3-a456-426614174000',
          asin: 'B08N5WRWNW'
        }
      })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('data')
      expect(data).toHaveProperty('meta')
      expect(data.data).toHaveProperty('segments')
      expect(data.data.segments).toHaveLength(4)
      expect(data.meta).toHaveProperty('brand')
      expect(data.meta).toHaveProperty('asin')
      expect(data.meta.asin).toBe('B08N5WRWNW')
    })

    it('should handle segment type filtering', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValueOnce({ data: mockAsinMapping, error: null })
      mockSupabase.single.mockResolvedValue({ data: mockSegmentData.slice(0, 2), error: null })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products/B08N5WRWNW/segments?segmentType=weekly')
      const response = await GET(request, {
        params: { 
          brandId: '123e4567-e89b-12d3-a456-426614174000',
          asin: 'B08N5WRWNW'
        }
      })

      expect(mockSupabase.eq).toHaveBeenCalledWith('segment_type', 'weekly')
      
      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.data.segments.every((s: any) => s.segmentType === 'weekly')).toBe(true)
    })

    it('should handle date range parameters', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValueOnce({ data: mockAsinMapping, error: null })
      mockSupabase.single.mockResolvedValue({ data: mockSegmentData.slice(0, 2), error: null })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products/B08N5WRWNW/segments?dateFrom=2024-08-25&dateTo=2024-09-01')
      const response = await GET(request, {
        params: { 
          brandId: '123e4567-e89b-12d3-a456-426614174000',
          asin: 'B08N5WRWNW'
        }
      })

      expect(mockSupabase.gte).toHaveBeenCalledWith('segment_start_date', '2024-08-25')
      expect(mockSupabase.lte).toHaveBeenCalledWith('segment_end_date', '2024-09-01')

      const data = await response.json()
      expect(response.status).toBe(200)
      expect(data.meta.dateRange).toEqual({
        from: '2024-08-25',
        to: '2024-09-01'
      })
    })

    it('should support 4-segment expansion for periods longer than 1 week', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValueOnce({ data: mockAsinMapping, error: null })
      mockSupabase.single.mockResolvedValue({ data: mockSegmentData, error: null })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products/B08N5WRWNW/segments?dateFrom=2024-08-25&dateTo=2024-09-15&expandSegments=true')
      const response = await GET(request, {
        params: { 
          brandId: '123e4567-e89b-12d3-a456-426614174000',
          asin: 'B08N5WRWNW'
        }
      })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.segments).toHaveLength(4) // 4 weeks expanded
      expect(data.meta.segmentExpansion).toBe(true)
      expect(data.meta.totalSegments).toBe(4)
    })

    it('should include comparison data when comparison period provided', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValueOnce({ data: mockAsinMapping, error: null })
      mockSupabase.single.mockResolvedValue({ data: mockSegmentData, error: null })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products/B08N5WRWNW/segments?comparisonDateFrom=2024-07-28&comparisonDateTo=2024-08-18')
      const response = await GET(request, {
        params: { 
          brandId: '123e4567-e89b-12d3-a456-426614174000',
          asin: 'B08N5WRWNW'
        }
      })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.segments[0]).toHaveProperty('impressionsComparison')
      expect(data.data.segments[0]).toHaveProperty('clicksComparison')
      expect(data.data.segments[0]).toHaveProperty('purchasesComparison')
      expect(data.meta).toHaveProperty('comparisonDateRange')
    })

    it('should return 404 for non-existent brand', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })

      const request = new NextRequest('http://localhost:3000/api/brands/non-existent/products/B08N5WRWNW/segments')
      const response = await GET(request, {
        params: { 
          brandId: 'non-existent',
          asin: 'B08N5WRWNW'
        }
      })

      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toEqual({
        code: 'BRAND_NOT_FOUND',
        message: 'Brand not found'
      })
    })

    it('should return 404 for ASIN not associated with brand', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products/B99999999/segments')
      const response = await GET(request, {
        params: { 
          brandId: '123e4567-e89b-12d3-a456-426614174000',
          asin: 'B99999999'
        }
      })

      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toEqual({
        code: 'ASIN_NOT_FOUND',
        message: 'ASIN not found for this brand'
      })
    })

    it('should validate segmentType parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products/B08N5WRWNW/segments?segmentType=invalid')
      const response = await GET(request, {
        params: { 
          brandId: '123e4567-e89b-12d3-a456-426614174000',
          asin: 'B08N5WRWNW'
        }
      })

      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toEqual({
        code: 'INVALID_SEGMENT_TYPE',
        message: 'Segment type must be one of: weekly, monthly, quarterly, yearly'
      })
    })

    it('should validate limit parameter boundaries', async () => {
      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products/B08N5WRWNW/segments?limit=200')
      const response = await GET(request, {
        params: { 
          brandId: '123e4567-e89b-12d3-a456-426614174000',
          asin: 'B08N5WRWNW'
        }
      })

      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toEqual({
        code: 'INVALID_PARAMETER',
        message: 'Limit must be between 1 and 50'
      })
    })

    it('should handle invalid date format', async () => {
      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products/B08N5WRWNW/segments?dateFrom=invalid-date')
      const response = await GET(request, {
        params: { 
          brandId: '123e4567-e89b-12d3-a456-426614174000',
          asin: 'B08N5WRWNW'
        }
      })

      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toEqual({
        code: 'INVALID_DATE_FORMAT',
        message: 'Date must be in YYYY-MM-DD format'
      })
    })

    it('should return segments sorted by date descending by default', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValueOnce({ data: mockAsinMapping, error: null })
      mockSupabase.single.mockResolvedValue({ data: mockSegmentData, error: null })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products/B08N5WRWNW/segments')
      const response = await GET(request, {
        params: { 
          brandId: '123e4567-e89b-12d3-a456-426614174000',
          asin: 'B08N5WRWNW'
        }
      })

      expect(mockSupabase.order).toHaveBeenCalledWith('segment_start_date', { ascending: false })

      const data = await response.json()
      const dates = data.data.segments.map((s: any) => s.segmentStartDate)
      
      // Verify descending order
      for (let i = 0; i < dates.length - 1; i++) {
        expect(new Date(dates[i]).getTime()).toBeGreaterThanOrEqual(new Date(dates[i + 1]).getTime())
      }
    })

    it('should use segment metadata helper function when available', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValueOnce({ data: mockAsinMapping, error: null })
      mockSupabase.single.mockResolvedValue({ data: mockSegmentData, error: null })
      mockSupabase.rpc.mockResolvedValueOnce({ 
        data: {
          segment_count: 4,
          date_range_start: '2024-08-25',
          date_range_end: '2024-09-15',
          avg_impressions: 161250,
          avg_purchases: 26.75,
          data_quality: 'high'
        }, 
        error: null 
      })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products/B08N5WRWNW/segments?includeMetadata=true')
      const response = await GET(request, {
        params: { 
          brandId: '123e4567-e89b-12d3-a456-426614174000',
          asin: 'B08N5WRWNW'
        }
      })

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_product_segment_metadata', {
        p_brand_id: '123e4567-e89b-12d3-a456-426614174000',
        p_asin: 'B08N5WRWNW',
        p_segment_type: 'weekly'
      })

      const data = await response.json()
      expect(data.meta).toHaveProperty('segmentMetadata')
      expect(data.meta.segmentMetadata.totalSegments).toBe(4)
      expect(data.meta.segmentMetadata.avgImpressions).toBe(161250)
    })

    it('should handle database errors gracefully', async () => {
      mockSupabase.single.mockRejectedValueOnce(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products/B08N5WRWNW/segments')
      const response = await GET(request, {
        params: { 
          brandId: '123e4567-e89b-12d3-a456-426614174000',
          asin: 'B08N5WRWNW'
        }
      })

      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toEqual({
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch segment data'
      })
    })
  })

  describe('Response Format Validation', () => {
    it('should return proper segment structure', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValueOnce({ data: mockAsinMapping, error: null })
      mockSupabase.single.mockResolvedValue({ data: mockSegmentData.slice(0, 1), error: null })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products/B08N5WRWNW/segments')
      const response = await GET(request, {
        params: { 
          brandId: '123e4567-e89b-12d3-a456-426614174000',
          asin: 'B08N5WRWNW'
        }
      })

      const data = await response.json()
      const segment = data.data.segments[0]

      // Verify required segment fields
      expect(segment).toHaveProperty('segmentType')
      expect(segment).toHaveProperty('segmentStartDate')
      expect(segment).toHaveProperty('segmentEndDate')
      expect(segment).toHaveProperty('impressions')
      expect(segment).toHaveProperty('clicks')
      expect(segment).toHaveProperty('cartAdds')
      expect(segment).toHaveProperty('purchases')
      expect(segment).toHaveProperty('clickThroughRate')
      expect(segment).toHaveProperty('conversionRate')
      expect(segment).toHaveProperty('clickShare')
      expect(segment).toHaveProperty('purchaseShare')
      expect(segment).toHaveProperty('topQuery')
      expect(segment).toHaveProperty('dataQuality')
      
      // Verify field types
      expect(typeof segment.impressions).toBe('number')
      expect(typeof segment.clicks).toBe('number')
      expect(typeof segment.clickThroughRate).toBe('number')
      expect(typeof segment.clickShare).toBe('number')
    })

    it('should include proper meta information', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValueOnce({ data: mockAsinMapping, error: null })
      mockSupabase.single.mockResolvedValue({ data: mockSegmentData, error: null })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products/B08N5WRWNW/segments')
      const response = await GET(request, {
        params: { 
          brandId: '123e4567-e89b-12d3-a456-426614174000',
          asin: 'B08N5WRWNW'
        }
      })

      const data = await response.json()

      expect(data.meta).toHaveProperty('brand')
      expect(data.meta).toHaveProperty('asin')
      expect(data.meta).toHaveProperty('productName')
      expect(data.meta).toHaveProperty('totalSegments')
      expect(data.meta).toHaveProperty('segmentType')
      expect(data.meta.brand.brandName).toBe('Work Sharp')
      expect(data.meta.asin).toBe('B08N5WRWNW')
      expect(data.meta.totalSegments).toBe(4)
    })
  })

  describe('Performance and Caching', () => {
    it('should return appropriate cache headers for successful responses', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValueOnce({ data: mockAsinMapping, error: null })
      mockSupabase.single.mockResolvedValue({ data: mockSegmentData, error: null })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products/B08N5WRWNW/segments')
      const response = await GET(request, {
        params: { 
          brandId: '123e4567-e89b-12d3-a456-426614174000',
          asin: 'B08N5WRWNW'
        }
      })

      // 5-minute cache for segment data with 10-minute stale-while-revalidate
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=300, stale-while-revalidate=600')
    })

    it('should not cache error responses', async () => {
      mockSupabase.single.mockRejectedValueOnce(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products/B08N5WRWNW/segments')
      const response = await GET(request, {
        params: { 
          brandId: '123e4567-e89b-12d3-a456-426614174000',
          asin: 'B08N5WRWNW'
        }
      })

      expect(response.headers.get('Cache-Control')).toBe('no-cache')
    })
  })
})