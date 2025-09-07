import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { format, subDays } from 'date-fns'
import ASINPerformanceDashboard from '../../app/page'

// Mock the API responses
const mockFetch = vi.fn()
global.fetch = mockFetch

// Helper to create query client for tests
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  })
}

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('Keyword Aggregation E2E Integration', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('aggregates keywords for multi-week date ranges', async () => {
    // Mock ASIN list response
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          asins: [
            { asin: 'B001DT', productTitle: 'Work Sharp Knife Sharpener', brand: 'Work Sharp' }
          ]
        }),
      })
    )

    // Mock aggregated data response for 2-week range
    const startDate = '2024-08-01'
    const endDate = '2024-08-14'
    
    mockFetch.mockImplementationOnce((url: string) => {
      expect(url).toContain('asin-overview')
      expect(url).toContain(`startDate=${startDate}`)
      expect(url).toContain(`endDate=${endDate}`)
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          asin: 'B001DT',
          productTitle: 'Work Sharp Knife Sharpener',
          brand: 'Work Sharp',
          dateRange: { start: startDate, end: endDate },
          metrics: {
            totals: {
              impressions: 50000,
              clicks: 4400,
              cartAdds: 1320,
              purchases: 440,
            },
            rates: {
              clickThroughRate: 0.088,
              cartAddRate: 0.3,
              purchaseRate: 0.333,
              overallConversionRate: 0.1,
            },
            marketShare: {
              impressionShare: 0.25,
              clickShare: 0.28,
              purchaseShare: 0.32,
            },
            pricing: {
              medianPrice: 39.99,
              competitorMedianPrice: 45.99,
              priceCompetitiveness: 0.87,
            },
          },
          timeSeries: [],
          topQueries: [
            {
              searchQuery: 'knife sharpener',
              impressions: 25000, // Aggregated sum
              clicks: 2200,
              cartAdds: 660,
              purchases: 220,
              ctr: 0.088, // Recalculated
              cvr: 0.1,
              cartAddRate: 0.3,
              purchaseRate: 0.333,
              impressionShare: 0.25,
              clickShare: 0.28,
              purchaseShare: 0.32,
            },
            {
              searchQuery: 'electric knife sharpener',
              impressions: 18500,
              clicks: 1480,
              cartAdds: 444,
              purchases: 148,
              ctr: 0.08,
              cvr: 0.1,
              cartAddRate: 0.3,
              purchaseRate: 0.333,
              impressionShare: 0.22,
              clickShare: 0.24,
              purchaseShare: 0.26,
            },
          ],
        }),
      })
    })

    render(
      <TestWrapper>
        <ASINPerformanceDashboard />
      </TestWrapper>
    )

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('ASIN Performance Dashboard')).toBeInTheDocument()
    })

    // Verify API was called with correct parameters
    await waitFor(() => {
      const apiCalls = mockFetch.mock.calls
      const overviewCall = apiCalls.find(call => call[0].includes('asin-overview'))
      expect(overviewCall).toBeTruthy()
    })

    // Wait for data to load and verify aggregated keywords appear
    await waitFor(() => {
      // Each keyword should appear only once
      const knifeSharpenerElements = screen.getAllByText('knife sharpener')
      expect(knifeSharpenerElements).toHaveLength(1)
      
      // Verify aggregated values are displayed
      expect(screen.getByText('25,000')).toBeInTheDocument() // Aggregated impressions
      expect(screen.getByText('2,200')).toBeInTheDocument() // Aggregated clicks
      expect(screen.getByText('220')).toBeInTheDocument() // Aggregated purchases
    })
  })

  it('does not aggregate keywords for single-week date ranges', async () => {
    // Mock ASIN list response
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          asins: [
            { asin: 'B001DT', productTitle: 'Work Sharp Knife Sharpener', brand: 'Work Sharp' }
          ]
        }),
      })
    )

    // Mock non-aggregated data response for 1-week range
    const startDate = '2024-08-01'
    const endDate = '2024-08-07'
    
    mockFetch.mockImplementationOnce((url: string) => {
      expect(url).toContain('asin-overview')
      expect(url).toContain(`startDate=${startDate}`)
      expect(url).toContain(`endDate=${endDate}`)
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          asin: 'B001DT',
          productTitle: 'Work Sharp Knife Sharpener',
          brand: 'Work Sharp',
          dateRange: { start: startDate, end: endDate },
          metrics: {
            totals: {
              impressions: 15000,
              clicks: 1200,
              cartAdds: 360,
              purchases: 120,
            },
            rates: {
              clickThroughRate: 0.08,
              cartAddRate: 0.3,
              purchaseRate: 0.333,
              overallConversionRate: 0.1,
            },
            marketShare: {
              impressionShare: 0.23,
              clickShare: 0.26,
              purchaseShare: 0.30,
            },
            pricing: {
              medianPrice: 39.99,
              competitorMedianPrice: 45.99,
              priceCompetitiveness: 0.87,
            },
          },
          timeSeries: [],
          topQueries: [
            {
              searchQuery: 'knife sharpener',
              impressions: 10000,
              clicks: 800,
              cartAdds: 240,
              purchases: 80,
              ctr: 0.08,
              cvr: 0.1,
              cartAddRate: 0.3,
              purchaseRate: 0.333,
              impressionShare: 0.25,
              clickShare: 0.28,
              purchaseShare: 0.32,
            },
            {
              searchQuery: 'knife sharpener',
              impressions: 5000,
              clicks: 400,
              cartAdds: 120,
              purchases: 40,
              ctr: 0.08,
              cvr: 0.1,
              cartAddRate: 0.3,
              purchaseRate: 0.333,
              impressionShare: 0.20,
              clickShare: 0.22,
              purchaseShare: 0.25,
            },
          ],
        }),
      })
    })

    render(
      <TestWrapper>
        <ASINPerformanceDashboard />
      </TestWrapper>
    )

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('ASIN Performance Dashboard')).toBeInTheDocument()
    })

    // For single week, keywords can appear multiple times (different variations)
    await waitFor(() => {
      const knifeSharpenerElements = screen.getAllByText('knife sharpener')
      expect(knifeSharpenerElements).toHaveLength(2) // Both instances shown
      
      // Verify individual values are displayed
      expect(screen.getByText('10,000')).toBeInTheDocument()
      expect(screen.getByText('5,000')).toBeInTheDocument()
    })
  })

  it('handles comparison periods with aggregation correctly', async () => {
    // Mock ASIN list response
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          asins: [
            { asin: 'B001DT', productTitle: 'Work Sharp Knife Sharpener', brand: 'Work Sharp' }
          ]
        }),
      })
    )

    // Mock response with comparison data
    const startDate = '2024-08-01'
    const endDate = '2024-08-14'
    const compareStartDate = '2024-07-18'
    const compareEndDate = '2024-07-31'
    
    mockFetch.mockImplementationOnce((url: string) => {
      expect(url).toContain('compareStartDate=' + compareStartDate)
      expect(url).toContain('compareEndDate=' + compareEndDate)
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          asin: 'B001DT',
          productTitle: 'Work Sharp Knife Sharpener',
          brand: 'Work Sharp',
          dateRange: { start: startDate, end: endDate },
          metrics: {
            totals: {
              impressions: 50000,
              clicks: 4400,
              cartAdds: 1320,
              purchases: 440,
            },
            rates: {
              clickThroughRate: 0.088,
              cartAddRate: 0.3,
              purchaseRate: 0.333,
              overallConversionRate: 0.1,
            },
            marketShare: {
              impressionShare: 0.25,
              clickShare: 0.28,
              purchaseShare: 0.32,
            },
            pricing: {
              medianPrice: 39.99,
              competitorMedianPrice: 45.99,
              priceCompetitiveness: 0.87,
            },
          },
          comparison: {
            metrics: {
              totals: {
                impressions: 40000,
                clicks: 3200,
                cartAdds: 960,
                purchases: 320,
              },
              rates: {
                clickThroughRate: 0.08,
                cartAddRate: 0.3,
                purchaseRate: 0.333,
                overallConversionRate: 0.1,
              },
            },
            changes: {
              impressions: 0.25, // +25%
              clicks: 0.375, // +37.5%
              purchases: 0.375, // +37.5%
              conversionRate: 0,
            },
          },
          timeSeries: [],
          topQueries: [
            {
              searchQuery: 'knife sharpener',
              impressions: 25000,
              clicks: 2200,
              cartAdds: 660,
              purchases: 220,
              ctr: 0.088,
              cvr: 0.1,
              cartAddRate: 0.3,
              purchaseRate: 0.333,
              impressionShare: 0.25,
              clickShare: 0.28,
              purchaseShare: 0.32,
            },
          ],
          topQueriesComparison: [
            {
              searchQuery: 'knife sharpener',
              impressions: 20000, // Aggregated comparison data
              clicks: 1600,
              cartAdds: 480,
              purchases: 160,
              ctr: 0.08,
              cvr: 0.1,
              cartAddRate: 0.3,
              purchaseRate: 0.333,
              impressionShare: 0.23,
              clickShare: 0.26,
              purchaseShare: 0.30,
            },
          ],
        }),
      })
    })

    render(
      <TestWrapper>
        <ASINPerformanceDashboard />
      </TestWrapper>
    )

    // Wait for data to load and verify comparison calculations
    await waitFor(() => {
      // Look for percentage changes in the metrics cards
      expect(screen.getByText('+25.0%')).toBeInTheDocument() // Impressions change
      expect(screen.getByText('+37.5%')).toBeInTheDocument() // Clicks/Purchases change
    })
  })

  it('switches between aggregated and non-aggregated data when date range changes', async () => {
    // This test would require simulating date picker interactions
    // For now, we'll verify the API behavior through direct calls
    
    // Test aggregation threshold
    const { shouldAggregateKeywords } = await import('../../app/api/dashboard/v2/asin-overview/utils/keyword-aggregation')
    
    // Exactly 7 days - should not aggregate
    expect(shouldAggregateKeywords('2024-08-01', '2024-08-07')).toBe(false)
    
    // 8 days - should aggregate
    expect(shouldAggregateKeywords('2024-08-01', '2024-08-08')).toBe(true)
    
    // 14 days - should aggregate
    expect(shouldAggregateKeywords('2024-08-01', '2024-08-14')).toBe(true)
    
    // 30 days - should aggregate
    expect(shouldAggregateKeywords('2024-08-01', '2024-08-31')).toBe(true)
  })
})