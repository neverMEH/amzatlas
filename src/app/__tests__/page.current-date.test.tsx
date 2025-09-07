import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HomePage from '../page'
import * as asinApi from '@/lib/api/asin-performance'

// Mock Next.js modules
// Mock the API module
vi.mock('@/lib/api/asin-performance')

const mockASINs = [
  { asin: 'B001234567', product_title: 'Test Product 1', brand: 'Brand A' },
  { asin: 'B007654321', product_title: 'Test Product 2', brand: 'Brand B' },
]

const mockPerformanceData = {
  metrics: {
    impressions: 10000,
    clicks: 500,
    cartAdds: 100,
    purchases: 50,
    ctr: 0.05,
    cartAddRate: 0.2,
    purchaseRate: 0.5,
    cvr: 0.1,
  },
  comparisonMetrics: {
    impressions: 8000,
    clicks: 400,
    cartAdds: 80,
    purchases: 40,
    ctr: 0.05,
    cartAddRate: 0.2,
    purchaseRate: 0.5,
    cvr: 0.1,
  },
  timeSeries: [
    { date: '2025-08-31', impressions: 1500, clicks: 75, cartAdds: 15, purchases: 8 },
    { date: '2025-09-01', impressions: 1400, clicks: 70, cartAdds: 14, purchases: 7 },
    { date: '2025-09-02', impressions: 1600, clicks: 80, cartAdds: 16, purchases: 8 },
  ],
  funnelData: {
    impressions: 10000,
    clicks: 500,
    cartAdds: 100,
    purchases: 50,
  },
  topSearchQueries: [],
}

describe('Home Page - Current Date Handling (September 2025)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    // Mock current date to September 3, 2025
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-09-03T12:00:00Z'))
    
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    
    // Setup API mocks
    vi.mocked(asinApi.useASINList).mockReturnValue({
      data: mockASINs,
      isLoading: false,
      error: null,
    } as any)
    
    vi.mocked(asinApi.useASINPerformance).mockReturnValue({
      data: mockPerformanceData,
      isLoading: false,
      error: null,
    } as any)
    
    vi.mocked(asinApi.useASINDataAvailability).mockReturnValue({
      data: {
        dateRanges: [{ start_date: '2024-08-01', end_date: '2024-10-31' }],
        summary: {
          earliestDate: '2024-08-01',
          latestDate: '2024-10-31',
          totalDays: 92,
          totalASINs: 85,
        },
        mostRecentCompleteMonth: {
          startDate: '2024-10-01',
          endDate: '2024-10-31',
        },
      },
      isLoading: false,
      error: null,
    } as any)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <HomePage />
      </QueryClientProvider>
    )
  }

  describe('Initial Load Behavior', () => {
    it('should initialize with current week (Aug 31 - Sep 6, 2025)', async () => {
      renderPage()
      
      await waitFor(() => {
        // Check that the date picker shows current week
        const datePickerTrigger = screen.getByTestId('calendar-trigger')
        expect(datePickerTrigger).toHaveTextContent('Week 36, 2025')
      })
      
      // Verify API was called with current week dates
      expect(asinApi.useASINPerformance).toHaveBeenCalledWith(
        'B001234567',
        '2025-08-31',
        '2025-09-06',
        expect.any(String),
        expect.any(String)
      )
    })

    it('should not show data availability indicators anymore', async () => {
      renderPage()
      
      await waitFor(() => {
        // No data indicators should not be displayed
        expect(screen.queryByText('No data available for this period')).not.toBeInTheDocument()
        expect(screen.queryByText('(Latest: Oct 31, 2024)')).not.toBeInTheDocument()
      })
    })

    it('should not auto-switch to historical data when current week is selected', async () => {
      renderPage()
      
      await waitFor(() => {
        // Date should remain as current week
        const datePickerTrigger = screen.getByTestId('calendar-trigger')
        expect(datePickerTrigger).toHaveTextContent('Week 36, 2025')
      })
      
      // Should not have been called with historical dates
      const calls = vi.mocked(asinApi.useASINPerformance).mock.calls
      expect(calls).not.toContainEqual(
        expect.arrayContaining(['B001234567', '2024-10-01', '2024-10-31'])
      )
    })
  })

  describe('ASIN Selection Behavior', () => {
    it('should maintain current dates when switching ASINs', async () => {
      const { rerender } = renderPage()
      
      await waitFor(() => {
        expect(screen.getByTestId('calendar-trigger')).toHaveTextContent('Week 36, 2025')
      })
      
      // Simulate ASIN change
      vi.mocked(useSearchParams as any).mockReturnValue({
        get: vi.fn((key: string) => {
          if (key === 'asin') return 'B007654321' // Different ASIN
          return null
        }),
        toString: () => 'asin=B007654321',
      })
      
      rerender(
        <QueryClientProvider client={queryClient}>
          <HomePage />
        </QueryClientProvider>
      )
      
      // Date should still be current week
      expect(screen.getByTestId('calendar-trigger')).toHaveTextContent('Week 36, 2025')
    })
  })

  describe('Date Range Updates', () => {
    it('should update to current month when month view is selected', async () => {
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText('Week')).toBeInTheDocument()
      })
      
      // Click month selector
      const monthButton = screen.getByText('Month')
      fireEvent.click(monthButton)
      
      // Should update to show September 2025
      await waitFor(() => {
        const datePickerTrigger = screen.getByTestId('calendar-trigger')
        expect(datePickerTrigger).toHaveTextContent('September 2025')
      })
      
      // Verify API call with September dates
      expect(asinApi.useASINPerformance).toHaveBeenCalledWith(
        'B001234567',
        '2025-09-01',
        '2025-09-30',
        expect.any(String),
        expect.any(String)
      )
    })

    it('should update to current quarter when quarter view is selected', async () => {
      renderPage()
      
      await waitFor(() => {
        expect(screen.getByText('Week')).toBeInTheDocument()
      })
      
      // Click quarter selector
      const quarterButton = screen.getByText('Quarter')
      fireEvent.click(quarterButton)
      
      // Should update to show Q3 2025
      await waitFor(() => {
        const datePickerTrigger = screen.getByTestId('calendar-trigger')
        expect(datePickerTrigger).toHaveTextContent('Q3 2025')
      })
      
      // Verify API call with Q3 dates
      expect(asinApi.useASINPerformance).toHaveBeenCalledWith(
        'B001234567',
        '2025-07-01',
        '2025-09-30',
        expect.any(String),
        expect.any(String)
      )
    })
  })

  describe('Comparison Period Behavior', () => {
    it('should default to previous period comparison for current week', async () => {
      renderPage()
      
      await waitFor(() => {
        // Check comparison is enabled
        const comparisonToggle = screen.getByLabelText(/compare to/i)
        expect(comparisonToggle).toBeChecked()
      })
      
      // Should be comparing to previous week
      expect(asinApi.useASINPerformance).toHaveBeenCalledWith(
        'B001234567',
        '2025-08-31',
        '2025-09-06',
        '2025-08-24', // Previous week start
        '2025-08-30'  // Previous week end
      )
    })

    it('should show smart suggestions with high confidence for recent periods', async () => {
      renderPage()
      
      await waitFor(() => {
        // Look for smart suggestions
        const previousWeekSuggestion = screen.getByText('Previous Week')
        expect(previousWeekSuggestion).toBeInTheDocument()
        
        // Should show high confidence indicator
        const suggestionCard = previousWeekSuggestion.closest('button')
        const highConfidence = suggestionCard?.querySelector('[data-testid="confidence-high"]')
        expect(highConfidence).toBeInTheDocument()
      })
    })
  })

  describe('Performance Data Display', () => {
    it('should display current period metrics correctly', async () => {
      renderPage()
      
      await waitFor(() => {
        // Check metrics cards show current data
        expect(screen.getByText('10,000')).toBeInTheDocument() // Impressions
        expect(screen.getByText('500')).toBeInTheDocument() // Clicks
        expect(screen.getByText('100')).toBeInTheDocument() // Cart Adds
        expect(screen.getByText('50')).toBeInTheDocument() // Purchases
      })
    })

    it('should show percentage changes vs comparison period', async () => {
      renderPage()
      
      await waitFor(() => {
        // Check for comparison indicators
        // (10000 - 8000) / 8000 = 25% increase
        expect(screen.getByText('+25.0%')).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle month-end dates correctly', () => {
      // Set to August 31, 2025
      vi.setSystemTime(new Date('2025-08-31T12:00:00Z'))
      
      renderPage()
      
      // Should still show week spanning August and September
      expect(screen.getByTestId('calendar-trigger')).toHaveTextContent('Week 36, 2025')
    })

    it('should handle year-end dates correctly', () => {
      // Set to December 30, 2025
      vi.setSystemTime(new Date('2025-12-30T12:00:00Z'))
      
      renderPage()
      
      // Should show week spanning years
      expect(screen.getByTestId('calendar-trigger')).toHaveTextContent('Week 1, 2026')
    })

    it('should handle missing ASIN parameter gracefully', () => {
      vi.mocked(useSearchParams as any).mockReturnValue({
        get: vi.fn(() => null), // No ASIN
        toString: () => '',
      })
      
      renderPage()
      
      // Should show ASIN selector
      expect(screen.getByPlaceholderText('Search ASINs...')).toBeInTheDocument()
    })
  })
})

// Mock Next.js navigation hooks
const useSearchParams = vi.fn()
const useRouter = vi.fn()
const usePathname = vi.fn()

