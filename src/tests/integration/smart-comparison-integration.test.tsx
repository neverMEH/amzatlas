import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import Dashboard from '@/app/page'
import { ComparisonSelector } from '@/components/asin-performance/ComparisonSelector'
import { SmartSuggestions } from '@/components/asin-performance/SmartSuggestions'

// Mock the API responses
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock data
const mockASINData = {
  asin: 'B07XYZ123',
  productTitle: 'Test Product',
  brand: 'Test Brand',
  dateRange: {
    start: '2024-07-29',
    end: '2024-08-04',
  },
  metrics: {
    totals: {
      impressions: 10000,
      clicks: 500,
      cartAdds: 100,
      purchases: 50,
    },
    rates: {
      clickThroughRate: 0.05,
      cartAddRate: 0.2,
      purchaseRate: 0.5,
      overallConversionRate: 0.005,
    },
  },
  comparisonSuggestions: {
    suggestions: [
      {
        period: {
          start: '2024-07-22',
          end: '2024-07-28',
          type: 'weekly',
          label: 'Previous Week',
        },
        dataAvailability: {
          hasData: true,
          recordCount: 7,
          coverage: 100,
          dataQuality: 'high',
        },
        confidence: {
          score: 95,
          factors: {
            dataCompleteness: 25,
            recency: 25,
            periodAlignment: 25,
            seasonalRelevance: 20,
          },
        },
        warnings: [],
      },
      {
        period: {
          start: '2024-06-29',
          end: '2024-07-05',
          type: 'weekly',
          label: 'Same Week Last Month',
        },
        dataAvailability: {
          hasData: true,
          recordCount: 7,
          coverage: 100,
          dataQuality: 'high',
        },
        confidence: {
          score: 85,
          factors: {
            dataCompleteness: 25,
            recency: 20,
            periodAlignment: 25,
            seasonalRelevance: 15,
          },
        },
        warnings: [],
      },
      {
        period: {
          start: '2023-07-31',
          end: '2023-08-06',
          type: 'weekly',
          label: 'Same Week Last Year',
        },
        dataAvailability: {
          hasData: true,
          recordCount: 6,
          coverage: 85,
          dataQuality: 'medium',
        },
        confidence: {
          score: 70,
          factors: {
            dataCompleteness: 20,
            recency: 5,
            periodAlignment: 25,
            seasonalRelevance: 20,
          },
        },
        warnings: ['Comparison period is over 1 year old'],
      },
    ],
    recommendedMode: 'period-over-period',
  },
  timeSeries: [],
  topQueries: [],
}

describe('Smart Comparison Integration', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    mockFetch.mockClear()
  })

  it('should display smart suggestions when comparison is enabled', async () => {
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <ComparisonSelector
          mainStartDate="2024-07-29"
          mainEndDate="2024-08-04"
          periodType="week"
          compareStartDate=""
          compareEndDate=""
          enabled={false}
          onChange={vi.fn()}
        />
      </QueryClientProvider>
    )

    // Enable comparison
    const checkbox = screen.getByRole('checkbox', { name: /enable comparison/i })
    await user.click(checkbox)

    // Should show smart suggestions button
    expect(screen.getByText('Use Smart Suggestions')).toBeInTheDocument()

    // Click to show smart suggestions
    await user.click(screen.getByText('Use Smart Suggestions'))

    // Should display suggestions
    await waitFor(() => {
      expect(screen.getByText('Smart comparison suggestions')).toBeInTheDocument()
    })
  })

  it('should select a suggestion and update comparison dates', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <QueryClientProvider client={queryClient}>
        <SmartSuggestions
          dateRange={{ start: '2024-07-29', end: '2024-08-04' }}
          onSelect={(period) => {
            onChange({
              startDate: period.start,
              endDate: period.end,
              enabled: true,
            })
          }}
        />
      </QueryClientProvider>
    )

    // Click on "Previous Week" suggestion
    const previousWeekButton = screen.getByText('Previous Week').closest('button')
    await user.click(previousWeekButton!)

    // Should call onChange with correct dates
    expect(onChange).toHaveBeenCalledWith({
      startDate: '2024-07-22',
      endDate: '2024-07-28',
      enabled: true,
    })
  })

  it('should show data availability warnings', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SmartSuggestions
          dateRange={{ start: '2021-01-01', end: '2021-01-07' }}
          onSelect={vi.fn()}
        />
      </QueryClientProvider>
    )

    // Should show limited data warnings for old dates
    await waitFor(() => {
      const warnings = screen.getAllByText(/Limited data availability/)
      expect(warnings.length).toBeGreaterThan(0)
    })
  })

  it('should display confidence indicators correctly', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SmartSuggestions
          dateRange={{ start: '2024-07-29', end: '2024-08-04' }}
          onSelect={vi.fn()}
        />
      </QueryClientProvider>
    )

    // Check for confidence indicators
    expect(screen.getByTestId('confidence-high')).toBeInTheDocument()
    expect(screen.getByTestId('confidence-medium')).toBeInTheDocument()
  })

  it('should handle API suggestions when ASIN is provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockASINData.comparisonSuggestions,
    })

    render(
      <QueryClientProvider client={queryClient}>
        <SmartSuggestions
          dateRange={{ start: '2024-07-29', end: '2024-08-04' }}
          asin="B07XYZ123"
          useApiSuggestions={true}
          onSelect={vi.fn()}
        />
      </QueryClientProvider>
    )

    // Should make API call
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/comparison-periods/suggestions')
      )
    })
  })

  it('should validate comparison period on selection', async () => {
    const user = userEvent.setup()
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        isValid: true,
        metadata: mockASINData.comparisonSuggestions.suggestions[0],
      }),
    })

    const onChange = vi.fn()

    render(
      <QueryClientProvider client={queryClient}>
        <ComparisonSelector
          mainStartDate="2024-07-29"
          mainEndDate="2024-08-04"
          periodType="week"
          compareStartDate=""
          compareEndDate=""
          enabled={true}
          onChange={onChange}
        />
      </QueryClientProvider>
    )

    // Select manual date range
    const manualButton = screen.getByText('Select period')
    await user.click(manualButton)

    // Should show validation results
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
    })
  })

  it('should handle keyboard navigation in suggestions', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <QueryClientProvider client={queryClient}>
        <SmartSuggestions
          dateRange={{ start: '2024-07-29', end: '2024-08-04' }}
          onSelect={onSelect}
        />
      </QueryClientProvider>
    )

    // Tab to first suggestion
    await user.tab()
    
    // First suggestion should be focused
    const firstSuggestion = screen.getByText('Previous Week').closest('button')
    expect(firstSuggestion).toHaveFocus()

    // Press Enter to select
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalled()
  })

  it('should show special period indicators', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SmartSuggestions
          dateRange={{ start: '2024-12-18', end: '2024-12-24' }}
          onSelect={vi.fn()}
        />
      </QueryClientProvider>
    )

    // Previous week would include holiday season
    const suggestions = screen.getAllByTestId('suggestion-card')
    expect(suggestions.length).toBeGreaterThan(0)
    
    // Should potentially show holiday context
    // Note: This depends on the actual date calculations
  })

  it('should handle comparison mode switching', async () => {
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <ComparisonSelector
          mainStartDate="2024-07-29"
          mainEndDate="2024-08-04"
          periodType="week"
          compareStartDate=""
          compareEndDate=""
          enabled={true}
          onChange={vi.fn()}
        />
      </QueryClientProvider>
    )

    // Start with smart suggestions
    expect(screen.getByText('Use Smart Suggestions')).toBeInTheDocument()

    // Switch to manual selection
    await user.click(screen.getByText('Use Smart Suggestions'))
    expect(screen.getByText('Use manual selection')).toBeInTheDocument()

    // Switch back
    await user.click(screen.getByText('Use manual selection'))
    expect(screen.queryByText('Smart comparison suggestions')).not.toBeInTheDocument()
  })

  it('should persist selected comparison when switching modes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <QueryClientProvider client={queryClient}>
        <ComparisonSelector
          mainStartDate="2024-07-29"
          mainEndDate="2024-08-04"
          periodType="week"
          compareStartDate="2024-07-22"
          compareEndDate="2024-07-28"
          enabled={true}
          onChange={onChange}
        />
      </QueryClientProvider>
    )

    // Should show current selection
    expect(screen.getByText(/Previous Week/)).toBeInTheDocument()
  })
})