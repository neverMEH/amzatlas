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
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase,
}))

// Mock brand product segments data
const mockBrandProductSegments = [
  {
    brand_id: '123e4567-e89b-12d3-a456-426614174000',
    brand_name: 'Work Sharp',
    asin: 'B08N5WRWNW',
    product_name: 'Work Sharp Precision Adjust Knife Sharpener',
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
    data_quality: 'high',
  },
  {
    brand_id: '123e4567-e89b-12d3-a456-426614174000',
    brand_name: 'Work Sharp',
    asin: 'B09P84DXYS',
    product_name: 'Work Sharp Ken Onion Edition Knife & Tool Sharpener',
    segment_type: 'weekly', 
    segment_start_date: '2024-08-25',
    segment_end_date: '2024-08-25',
    total_impressions: 200000,
    total_clicks: 500,
    total_cart_adds: 120,
    total_purchases: 40,
    click_through_rate: 0.0025,
    conversion_rate: 0.08,
    cart_add_rate: 0.24,
    click_share: 0.18,
    cart_add_share: 0.15,
    purchase_share: 0.12,
    query_count: 58,
    top_query: 'electric knife sharpener',
    data_quality: 'high',
  }
]

const mockBrand = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  brand_name: 'Work Sharp',
  is_active: true,
}

describe('/api/brands/[brandId]/products', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/brands/[brandId]/products', () => {
    it('should return brand products with default parameters', async () => {
      // Mock successful responses
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValue({ data: mockBrandProductSegments, error: null })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products')
      const response = await GET(request, {
        params: { brandId: '123e4567-e89b-12d3-a456-426614174000' }
      })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('data')
      expect(data).toHaveProperty('meta')
      expect(data.data).toHaveProperty('products')
      expect(data.meta).toHaveProperty('brand')
      expect(data.meta.brand.brand_name).toBe('Work Sharp')
    })

    it('should handle includeSegments parameter', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValue({ data: mockBrandProductSegments, error: null })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products?includeSegments=true')
      const response = await GET(request, {
        params: { brandId: '123e4567-e89b-12d3-a456-426614174000' }
      })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.products[0]).toHaveProperty('segmentMetadata')
      expect(data.data.products[0].segmentMetadata).toHaveProperty('weeklySegmentsAvailable')
      expect(data.data.products[0].segmentMetadata).toHaveProperty('hasWeeklyData')
    })

    it('should handle date range parameters', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValue({ data: mockBrandProductSegments, error: null })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products?dateFrom=2024-08-01&dateTo=2024-08-31')
      const response = await GET(request, {
        params: { brandId: '123e4567-e89b-12d3-a456-426614174000' }
      })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.meta.dateRange).toEqual({
        from: '2024-08-01',
        to: '2024-08-31'
      })
    })

    it('should handle comparison period parameters', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValue({ data: mockBrandProductSegments, error: null })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products?dateFrom=2024-08-01&dateTo=2024-08-31&comparisonDateFrom=2024-07-01&comparisonDateTo=2024-07-31')
      const response = await GET(request, {
        params: { brandId: '123e4567-e89b-12d3-a456-426614174000' }
      })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.meta.comparisonDateRange).toEqual({
        from: '2024-07-01',
        to: '2024-07-31'
      })
      expect(data.data.products[0]).toHaveProperty('impressionsComparison')
      expect(data.data.products[0]).toHaveProperty('clicksComparison')
    })

    it('should return 404 for non-existent brand', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })

      const request = new NextRequest('http://localhost:3000/api/brands/non-existent/products')
      const response = await GET(request, {
        params: { brandId: 'non-existent' }
      })

      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toEqual({
        code: 'BRAND_NOT_FOUND',
        message: 'Brand not found'
      })
    })

    it('should validate pagination parameters', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValue({ data: mockBrandProductSegments, error: null })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products?limit=5&offset=10')
      const response = await GET(request, {
        params: { brandId: '123e4567-e89b-12d3-a456-426614174000' }
      })

      expect(mockSupabase.limit).toHaveBeenCalledWith(5)
      expect(response.status).toBe(200)
    })

    it('should validate limit parameter boundaries', async () => {
      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products?limit=150')
      const response = await GET(request, {
        params: { brandId: '123e4567-e89b-12d3-a456-426614174000' }
      })

      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toEqual({
        code: 'INVALID_PARAMETER',
        message: 'Limit must be between 1 and 100'
      })
    })

    it('should handle invalid date format', async () => {
      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products?dateFrom=invalid-date')
      const response = await GET(request, {
        params: { brandId: '123e4567-e89b-12d3-a456-426614174000' }
      })

      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toEqual({
        code: 'INVALID_DATE_FORMAT',
        message: 'Date must be in YYYY-MM-DD format'
      })
    })

    it('should handle database errors gracefully', async () => {
      mockSupabase.single.mockRejectedValueOnce(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products')
      const response = await GET(request, {
        params: { brandId: '123e4567-e89b-12d3-a456-426614174000' }
      })

      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toEqual({
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch brand products'
      })
    })

    it('should return products sorted by performance metrics', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValue({ data: mockBrandProductSegments, error: null })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products?sortBy=purchases&sortOrder=desc')
      const response = await GET(request, {
        params: { brandId: '123e4567-e89b-12d3-a456-426614174000' }
      })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.products).toHaveLength(2)
      // Verify sorting (Ken Onion has more purchases than Precision Adjust)
      expect(data.data.products[0].purchases).toBeGreaterThanOrEqual(data.data.products[1].purchases)
    })

    it('should filter products by minimum impressions', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValue({ data: mockBrandProductSegments, error: null })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products?minImpressions=175000')
      const response = await GET(request, {
        params: { brandId: '123e4567-e89b-12d3-a456-426614174000' }
      })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.products).toHaveLength(1)
      expect(data.data.products[0].impressions).toBeGreaterThanOrEqual(175000)
    })

    it('should handle empty results gracefully', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValue({ data: [], error: null })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products')
      const response = await GET(request, {
        params: { brandId: '123e4567-e89b-12d3-a456-426614174000' }
      })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.products).toHaveLength(0)
      expect(data.meta.totalCount).toBe(0)
    })
  })

  describe('Response Format Validation', () => {
    it('should return proper product structure', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValue({ data: mockBrandProductSegments.slice(0, 1), error: null })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products')
      const response = await GET(request, {
        params: { brandId: '123e4567-e89b-12d3-a456-426614174000' }
      })

      const data = await response.json()
      const product = data.data.products[0]

      // Verify required product fields
      expect(product).toHaveProperty('asin')
      expect(product).toHaveProperty('productName')
      expect(product).toHaveProperty('impressions')
      expect(product).toHaveProperty('clicks')
      expect(product).toHaveProperty('cartAdds')
      expect(product).toHaveProperty('purchases')
      expect(product).toHaveProperty('ctr')
      expect(product).toHaveProperty('cvr')
      expect(product).toHaveProperty('clickShare')
      expect(product).toHaveProperty('cartAddShare')
      expect(product).toHaveProperty('purchaseShare')
      
      // Verify field types
      expect(typeof product.impressions).toBe('number')
      expect(typeof product.clicks).toBe('number')
      expect(typeof product.ctr).toBe('number')
      expect(typeof product.clickShare).toBe('number')
    })

    it('should include comparison fields when comparison period provided', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValue({ data: mockBrandProductSegments.slice(0, 1), error: null })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products?comparisonDateFrom=2024-07-01&comparisonDateTo=2024-07-31')
      const response = await GET(request, {
        params: { brandId: '123e4567-e89b-12d3-a456-426614174000' }
      })

      const data = await response.json()
      const product = data.data.products[0]

      expect(product).toHaveProperty('impressionsComparison')
      expect(product).toHaveProperty('clicksComparison')
      expect(product).toHaveProperty('cartAddsComparison')
      expect(product).toHaveProperty('purchasesComparison')
    })
  })

  describe('Caching Headers', () => {
    it('should return appropriate cache headers', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: mockBrand, error: null })
      mockSupabase.single.mockResolvedValue({ data: mockBrandProductSegments, error: null })

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products')
      const response = await GET(request, {
        params: { brandId: '123e4567-e89b-12d3-a456-426614174000' }
      })

      expect(response.headers.get('Cache-Control')).toBe('public, max-age=300, stale-while-revalidate=600')
    })

    it('should not cache error responses', async () => {
      mockSupabase.single.mockRejectedValueOnce(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/brands/123e4567-e89b-12d3-a456-426614174000/products')
      const response = await GET(request, {
        params: { brandId: '123e4567-e89b-12d3-a456-426614174000' }
      })

      expect(response.headers.get('Cache-Control')).toBe('no-cache')
    })
  })
})