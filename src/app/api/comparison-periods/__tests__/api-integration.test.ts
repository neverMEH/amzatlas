import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as getSuggestions } from '../suggestions/route'
import { POST as validateComparison } from '../validate/route'

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              data: [
                { start_date: '2024-07-22', end_date: '2024-07-22' },
                { start_date: '2024-07-23', end_date: '2024-07-23' },
                { start_date: '2024-07-24', end_date: '2024-07-24' },
                { start_date: '2024-07-25', end_date: '2024-07-25' },
                { start_date: '2024-07-26', end_date: '2024-07-26' },
                { start_date: '2024-07-27', end_date: '2024-07-27' },
                { start_date: '2024-07-28', end_date: '2024-07-28' },
              ],
              error: null,
            })),
          })),
        })),
      })),
    })),
  })),
}))

describe('Comparison Periods API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/comparison-periods/suggestions', () => {
    it('should return suggestions for a valid date range', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/comparison-periods/suggestions?asin=B07XYZ123&startDate=2024-07-29&endDate=2024-08-04'
      )

      const response = await getSuggestions(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('suggestions')
      expect(data).toHaveProperty('recommendedMode')
      expect(data.suggestions).toBeInstanceOf(Array)
      expect(data.suggestions.length).toBeGreaterThan(0)

      // Check first suggestion structure
      const firstSuggestion = data.suggestions[0]
      expect(firstSuggestion).toHaveProperty('period')
      expect(firstSuggestion).toHaveProperty('dataAvailability')
      expect(firstSuggestion).toHaveProperty('confidence')
      expect(firstSuggestion).toHaveProperty('warnings')
    })

    it('should return 400 for missing parameters', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/comparison-periods/suggestions?asin=B07XYZ123'
      )

      const response = await getSuggestions(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
    })

    it('should handle invalid date formats gracefully', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/comparison-periods/suggestions?asin=B07XYZ123&startDate=invalid&endDate=2024-08-04'
      )

      const response = await getSuggestions(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.suggestions).toHaveLength(0)
    })
  })

  describe('POST /api/comparison-periods/validate', () => {
    it('should validate a comparison period successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/comparison-periods/validate', {
        method: 'POST',
        body: JSON.stringify({
          asin: 'B07XYZ123',
          mainRange: { start: '2024-07-29', end: '2024-08-04' },
          comparisonRange: { start: '2024-07-22', end: '2024-07-28' },
        }),
      })

      const response = await validateComparison(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('isValid')
      expect(data).toHaveProperty('metadata')
      expect(data.isValid).toBe(true)
    })

    it('should reject overlapping periods', async () => {
      const request = new NextRequest('http://localhost:3000/api/comparison-periods/validate', {
        method: 'POST',
        body: JSON.stringify({
          asin: 'B07XYZ123',
          mainRange: { start: '2024-07-29', end: '2024-08-04' },
          comparisonRange: { start: '2024-07-30', end: '2024-08-05' },
        }),
      })

      const response = await validateComparison(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.isValid).toBe(false)
      expect(data.errors).toContain('Invalid comparison period selected')
    })

    it('should return 400 for missing parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/comparison-periods/validate', {
        method: 'POST',
        body: JSON.stringify({
          asin: 'B07XYZ123',
        }),
      })

      const response = await validateComparison(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('error')
    })

    it('should handle periods with no data', async () => {
      // Mock no data scenario
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              gte: vi.fn(() => ({
                lte: vi.fn(() => ({
                  data: [],
                  error: null,
                })),
              })),
            })),
          })),
        })),
      } as any)

      const request = new NextRequest('http://localhost:3000/api/comparison-periods/validate', {
        method: 'POST',
        body: JSON.stringify({
          asin: 'B07XYZ123',
          mainRange: { start: '2024-07-29', end: '2024-08-04' },
          comparisonRange: { start: '2020-07-22', end: '2020-07-28' },
        }),
      })

      const response = await validateComparison(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.isValid).toBe(false)
      expect(data.errors).toContain('No data available for the selected comparison period')
    })
  })

  describe('Confidence Score Calculation', () => {
    it('should give high confidence to recent period-over-period comparisons', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/comparison-periods/suggestions?asin=B07XYZ123&startDate=2024-07-29&endDate=2024-08-04'
      )

      const response = await getSuggestions(request)
      const data = await response.json()

      const previousWeek = data.suggestions.find((s: any) => s.period.label === 'Previous Week')
      expect(previousWeek).toBeDefined()
      expect(previousWeek.confidence.score).toBeGreaterThan(80)
    })

    it('should give lower confidence to old comparisons', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/comparison-periods/suggestions?asin=B07XYZ123&startDate=2024-07-29&endDate=2024-08-04'
      )

      const response = await getSuggestions(request)
      const data = await response.json()

      const lastYear = data.suggestions.find((s: any) => s.period.label.includes('Last Year'))
      if (lastYear) {
        expect(lastYear.confidence.score).toBeLessThan(80)
      }
    })
  })

  describe('Data Availability Checks', () => {
    it('should calculate coverage percentage correctly', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/comparison-periods/suggestions?asin=B07XYZ123&startDate=2024-07-29&endDate=2024-08-04'
      )

      const response = await getSuggestions(request)
      const data = await response.json()

      const firstSuggestion = data.suggestions[0]
      expect(firstSuggestion.dataAvailability).toHaveProperty('coverage')
      expect(firstSuggestion.dataAvailability.coverage).toBe(100)
    })

    it('should mark data quality appropriately', async () => {
      // Mock partial data
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              gte: vi.fn(() => ({
                lte: vi.fn(() => ({
                  data: [
                    { start_date: '2024-07-22', end_date: '2024-07-22' },
                    { start_date: '2024-07-24', end_date: '2024-07-24' },
                    { start_date: '2024-07-26', end_date: '2024-07-26' },
                  ],
                  error: null,
                })),
              })),
            })),
          })),
        })),
      } as any)

      const request = new NextRequest(
        'http://localhost:3000/api/comparison-periods/suggestions?asin=B07XYZ123&startDate=2024-07-29&endDate=2024-08-04'
      )

      const response = await getSuggestions(request)
      const data = await response.json()

      const firstSuggestion = data.suggestions[0]
      expect(firstSuggestion.dataAvailability.coverage).toBeLessThan(50)
      expect(firstSuggestion.dataAvailability.dataQuality).toBe('low')
    })
  })
})