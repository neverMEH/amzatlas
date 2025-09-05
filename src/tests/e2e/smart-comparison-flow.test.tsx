import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Dashboard from '@/app/page'

// Mock API responses
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Smart Comparison End-to-End Flow', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    mockFetch.mockClear()
  })

  const setupMockResponses = () => {
    // Mock ASIN list response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        asins: [
          { asin: 'B07XYZ123', product_title: 'Test Product', brand: 'Test Brand' },
        ],
      }),
    })

    // Mock ASIN performance data with suggestions
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        asin: 'B07XYZ123',
        productTitle: 'Test Product',
        brand: 'Test Brand',
        dateRange: { start: '2024-07-29', end: '2024-08-04' },
        metrics: {
          totals: { impressions: 10000, clicks: 500, cartAdds: 100, purchases: 50 },
          rates: { clickThroughRate: 0.05, cartAddRate: 0.2, purchaseRate: 0.5, overallConversionRate: 0.005 },
        },
        timeSeries: [],
        topQueries: [],
        comparisonSuggestions: {
          suggestions: [
            {
              period: { start: '2024-07-22', end: '2024-07-28', type: 'weekly', label: 'Previous Week' },
              dataAvailability: { hasData: true, recordCount: 7, coverage: 100, dataQuality: 'high' },
              confidence: { score: 95, factors: { dataCompleteness: 25, recency: 25, periodAlignment: 25, seasonalRelevance: 20 } },
              warnings: [],
            },
          ],
          recommendedMode: 'period-over-period',
        },
      }),
    })
  }

  it('should complete full user flow from ASIN selection to smart comparison', async () => {
    const user = userEvent.setup()
    setupMockResponses()

    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    )

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('ASIN Performance Dashboard')).toBeInTheDocument()
    })

    // Step 1: Select an ASIN
    const asinSelector = screen.getByLabelText('Select ASIN')
    await user.click(asinSelector)
    
    await waitFor(() => {
      const option = screen.getByText('B07XYZ123 - Test Product')
      expect(option).toBeInTheDocument()
    })
    
    await user.click(screen.getByText('B07XYZ123 - Test Product'))

    // Step 2: Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Test Product')).toBeInTheDocument()
    })

    // Step 3: Enable comparison
    const compareCheckbox = screen.getByRole('checkbox', { name: /compare to another period/i })
    await user.click(compareCheckbox)

    // Step 4: Smart suggestions should appear
    await waitFor(() => {
      expect(screen.getByText('Use Smart Suggestions')).toBeInTheDocument()
    })

    // Step 5: Click on smart suggestions
    await user.click(screen.getByText('Use Smart Suggestions'))

    // Step 6: Verify suggestions are displayed
    await waitFor(() => {
      expect(screen.getByText('Smart comparison suggestions')).toBeInTheDocument()
      expect(screen.getByText('Previous Week')).toBeInTheDocument()
    })

    // Step 7: Select a suggestion
    const previousWeekButton = screen.getByText('Previous Week').closest('button')
    await user.click(previousWeekButton!)

    // Step 8: Verify comparison is applied
    await waitFor(() => {
      // The API should be called again with comparison dates
      const apiCalls = mockFetch.mock.calls
      const comparisonCall = apiCalls.find(call => 
        call[0].includes('compareStartDate=2024-07-22') && 
        call[0].includes('compareEndDate=2024-07-28')
      )
      expect(comparisonCall).toBeDefined()
    })
  })

  it('should show data availability warnings for problematic periods', async () => {
    const user = userEvent.setup()
    
    // Mock response with limited data availability
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        asins: [{ asin: 'B07XYZ123', product_title: 'Test Product', brand: 'Test Brand' }],
      }),
    })

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        asin: 'B07XYZ123',
        productTitle: 'Test Product',
        brand: 'Test Brand',
        dateRange: { start: '2021-01-01', end: '2021-01-07' },
        metrics: {
          totals: { impressions: 1000, clicks: 50, cartAdds: 10, purchases: 5 },
          rates: { clickThroughRate: 0.05, cartAddRate: 0.2, purchaseRate: 0.5, overallConversionRate: 0.005 },
        },
        comparisonSuggestions: {
          suggestions: [
            {
              period: { start: '2020-12-25', end: '2020-12-31', type: 'weekly', label: 'Previous Week' },
              dataAvailability: { hasData: true, recordCount: 3, coverage: 42, dataQuality: 'low' },
              confidence: { score: 45, factors: { dataCompleteness: 10, recency: 5, periodAlignment: 25, seasonalRelevance: 5 } },
              warnings: ['Limited data coverage (42%)', 'Comparison period is over 1 year old'],
            },
          ],
          recommendedMode: 'period-over-period',
        },
        timeSeries: [],
        topQueries: [],
      }),
    })

    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    )

    // Select ASIN with old data
    const asinSelector = await screen.findByLabelText('Select ASIN')
    await user.click(asinSelector)
    await user.click(await screen.findByText('B07XYZ123 - Test Product'))

    // Enable comparison
    await user.click(await screen.findByRole('checkbox', { name: /compare to another period/i }))

    // Check for warnings
    await waitFor(() => {
      const warnings = screen.getAllByText(/Limited data/i)
      expect(warnings.length).toBeGreaterThan(0)
    })
  })

  it('should handle switching between smart and manual comparison', async () => {
    const user = userEvent.setup()
    setupMockResponses()

    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    )

    // Select ASIN
    const asinSelector = await screen.findByLabelText('Select ASIN')
    await user.click(asinSelector)
    await user.click(await screen.findByText('B07XYZ123 - Test Product'))

    // Enable comparison
    await user.click(await screen.findByRole('checkbox', { name: /compare to another period/i }))

    // Start with smart suggestions
    await user.click(await screen.findByText('Use Smart Suggestions'))
    expect(screen.getByText('Smart comparison suggestions')).toBeInTheDocument()

    // Switch to manual
    await user.click(screen.getByText('Use manual selection'))
    expect(screen.queryByText('Smart comparison suggestions')).not.toBeInTheDocument()

    // Manual dropdown should be available
    expect(screen.getByText('Select period')).toBeInTheDocument()
  })

  it('should validate custom comparison periods', async () => {
    const user = userEvent.setup()
    
    // Mock validation response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        asins: [{ asin: 'B07XYZ123', product_title: 'Test Product', brand: 'Test Brand' }],
      }),
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        asin: 'B07XYZ123',
        productTitle: 'Test Product',
        brand: 'Test Brand',
        dateRange: { start: '2024-07-29', end: '2024-08-04' },
        metrics: { /* ... */ },
        comparisonValidation: {
          isValid: false,
          errors: ['Comparison period overlaps with the main period'],
        },
        timeSeries: [],
        topQueries: [],
      }),
    })

    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    )

    // Select ASIN
    const asinSelector = await screen.findByLabelText('Select ASIN')
    await user.click(asinSelector)
    await user.click(await screen.findByText('B07XYZ123 - Test Product'))

    // Wait for validation error
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })
  })

  it('should show appropriate suggestions for different period types', async () => {
    const user = userEvent.setup()
    
    // Test with monthly period
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        asins: [{ asin: 'B07XYZ123', product_title: 'Test Product', brand: 'Test Brand' }],
      }),
    })

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        asin: 'B07XYZ123',
        productTitle: 'Test Product',
        brand: 'Test Brand',
        dateRange: { start: '2024-07-01', end: '2024-07-31' },
        metrics: { /* ... */ },
        comparisonSuggestions: {
          suggestions: [
            {
              period: { start: '2024-06-01', end: '2024-06-30', type: 'monthly', label: 'Previous Month' },
              dataAvailability: { hasData: true, recordCount: 30, coverage: 100, dataQuality: 'high' },
              confidence: { score: 95, factors: { /* ... */ } },
              warnings: [],
            },
            {
              period: { start: '2023-07-01', end: '2023-07-31', type: 'monthly', label: 'Same Month Last Year' },
              dataAvailability: { hasData: true, recordCount: 31, coverage: 100, dataQuality: 'high' },
              confidence: { score: 85, factors: { /* ... */ } },
              warnings: [],
            },
          ],
          recommendedMode: 'period-over-period',
        },
        timeSeries: [],
        topQueries: [],
      }),
    })

    render(
      <QueryClientProvider client={queryClient}>
        <Dashboard />
      </QueryClientProvider>
    )

    // Select ASIN
    const asinSelector = await screen.findByLabelText('Select ASIN')
    await user.click(asinSelector)
    await user.click(await screen.findByText('B07XYZ123 - Test Product'))

    // Enable comparison and view suggestions
    await user.click(await screen.findByRole('checkbox', { name: /compare to another period/i }))
    await user.click(await screen.findByText('Use Smart Suggestions'))

    // Should show monthly suggestions
    await waitFor(() => {
      expect(screen.getByText('Previous Month')).toBeInTheDocument()
      expect(screen.getByText('Same Month Last Year')).toBeInTheDocument()
    })
  })
})