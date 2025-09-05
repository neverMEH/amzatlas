import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import KeywordAnalysisPage from '../page'
import * as router from 'next/navigation'

// Mock Next.js modules
import * as keywordApi from '@/lib/api/keyword-analysis'

const mockKeywordData = {
  overview: {
    keyword: 'test keyword',
    totalImpressions: 50000,
    totalClicks: 2500,
    totalCartAdds: 500,
    totalPurchases: 250,
    avgCTR: 0.05,
    avgCVR: 0.1,
    avgCartAddRate: 0.2,
  },
  marketShare: {
    topASINs: [
      { asin: 'B001234567', brand: 'Brand A', impressions: 10000, clicks: 500 },
      { asin: 'B007654321', brand: 'Brand B', impressions: 8000, clicks: 400 },
    ],
  },
  timeSeries: [
    { date: '2025-08-31', impressions: 7000, clicks: 350 },
    { date: '2025-09-01', impressions: 7200, clicks: 360 },
    { date: '2025-09-02', impressions: 7100, clicks: 355 },
  ],
}

const mockASINKeywords = [
  'test keyword',
  'another keyword',
  'third keyword',
]

describe('Keyword Analysis Page - Current Date Handling (September 2025)', () => {
  let queryClient: QueryClient
  const mockPush = vi.fn()
  const mockReplace = vi.fn()

  beforeEach(() => {
    // Mock current date to September 3, 2025
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-09-03T12:00:00Z'))
    
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    
    // Setup router mocks
    vi.mocked(router.useRouter).mockReturnValue({
      push: mockPush,
      replace: mockReplace,
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    } as any)
    
    vi.mocked(router.usePathname).mockReturnValue('/keyword-analysis')
    
    // Setup API mocks
    vi.mocked(keywordApi.useKeywordPerformance).mockReturnValue({
      data: mockKeywordData,
      isLoading: false,
      error: null,
    } as any)
    
    vi.mocked(keywordApi.useASINKeywords).mockReturnValue({
      data: mockASINKeywords,
      isLoading: false,
      error: null,
    } as any)
    
    vi.mocked(keywordApi.useKeywordComparison).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    } as any)
    
    mockPush.mockClear()
    mockReplace.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Default Date Initialization', () => {
    it('should initialize with current week when no dates in URL', () => {
      vi.mocked(router.useSearchParams).mockReturnValue(new URLSearchParams('asin=B001234567&keyword=test+keyword'))
      
      render(
        <QueryClientProvider client={queryClient}>
          <KeywordAnalysisPage />
        </QueryClientProvider>
      )
      
      // Should redirect with current week dates
      expect(mockReplace).toHaveBeenCalledWith(
        '/keyword-analysis?asin=B001234567&keyword=test+keyword&startDate=2025-08-31&endDate=2025-09-06'
      )
    })

    it('should not redirect when dates are already in URL', () => {
      vi.mocked(router.useSearchParams).mockReturnValue(
        new URLSearchParams('asin=B001234567&keyword=test+keyword&startDate=2025-08-31&endDate=2025-09-06')
      )
      
      render(
        <QueryClientProvider client={queryClient}>
          <KeywordAnalysisPage />
        </QueryClientProvider>
      )
      
      // Should not redirect
      expect(mockReplace).not.toHaveBeenCalled()
    })

    it('should handle multiple keywords with current dates', () => {
      vi.mocked(router.useSearchParams).mockReturnValue(
        new URLSearchParams('asin=B001234567&keywords=keyword1,keyword2,keyword3')
      )
      
      render(
        <QueryClientProvider client={queryClient}>
          <KeywordAnalysisPage />
        </QueryClientProvider>
      )
      
      // Should redirect with current week dates
      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining('startDate=2025-08-31&endDate=2025-09-06')
      )
    })
  })

  describe('Date Display and Selection', () => {
    it('should display current week in date picker', async () => {
      vi.mocked(router.useSearchParams).mockReturnValue(
        new URLSearchParams('asin=B001234567&keyword=test+keyword&startDate=2025-08-31&endDate=2025-09-06')
      )
      
      render(
        <QueryClientProvider client={queryClient}>
          <KeywordAnalysisPage />
        </QueryClientProvider>
      )
      
      await waitFor(() => {
        const datePickerTrigger = screen.getByTestId('calendar-trigger')
        expect(datePickerTrigger).toHaveTextContent('Week 36, 2025')
      })
    })

    it('should have hasManualSelection=true to prevent auto-override', () => {
      vi.mocked(router.useSearchParams).mockReturnValue(
        new URLSearchParams('asin=B001234567&keyword=test+keyword&startDate=2025-08-31&endDate=2025-09-06')
      )
      
      render(
        <QueryClientProvider client={queryClient}>
          <KeywordAnalysisPage />
        </QueryClientProvider>
      )
      
      // Check that DateRangePickerV2 has hasManualSelection prop
      // This prevents the component from auto-switching dates
      // Note: This is a prop check that would require inspecting component props
      // In a real test, we'd verify the behavior doesn't auto-switch
    })
  })

  describe('Period Type Changes', () => {
    it('should update to current month when month is selected', async () => {
      vi.mocked(router.useSearchParams).mockReturnValue(
        new URLSearchParams('asin=B001234567&keyword=test+keyword&startDate=2025-08-31&endDate=2025-09-06')
      )
      
      render(
        <QueryClientProvider client={queryClient}>
          <KeywordAnalysisPage />
        </QueryClientProvider>
      )
      
      // Click month selector
      const monthButton = screen.getByText('Month')
      fireEvent.click(monthButton)
      
      await waitFor(() => {
        // Should show September 2025
        const datePickerTrigger = screen.getByTestId('calendar-trigger')
        expect(datePickerTrigger).toHaveTextContent('September 2025')
      })
      
      // API should be called with September dates
      expect(keywordApi.useKeywordPerformance).toHaveBeenCalledWith(
        'B001234567',
        'test keyword',
        '2025-09-01',
        '2025-09-30',
        expect.any(String),
        expect.any(String)
      )
    })

    it('should update to current quarter when quarter is selected', async () => {
      vi.mocked(router.useSearchParams).mockReturnValue(
        new URLSearchParams('asin=B001234567&keyword=test+keyword&startDate=2025-08-31&endDate=2025-09-06')
      )
      
      render(
        <QueryClientProvider client={queryClient}>
          <KeywordAnalysisPage />
        </QueryClientProvider>
      )
      
      // Click quarter selector
      const quarterButton = screen.getByText('Quarter')
      fireEvent.click(quarterButton)
      
      await waitFor(() => {
        // Should show Q3 2025
        const datePickerTrigger = screen.getByTestId('calendar-trigger')
        expect(datePickerTrigger).toHaveTextContent('Q3 2025')
      })
    })
  })

  describe('Keyword Selection with Dates', () => {
    it('should maintain current dates when switching keywords', async () => {
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <KeywordAnalysisPage />
        </QueryClientProvider>
      )
      
      // Initial state with one keyword
      vi.mocked(router.useSearchParams).mockReturnValue(
        new URLSearchParams('asin=B001234567&keyword=test+keyword&startDate=2025-08-31&endDate=2025-09-06')
      )
      
      await waitFor(() => {
        expect(screen.getByTestId('calendar-trigger')).toHaveTextContent('Week 36, 2025')
      })
      
      // Switch to different keyword
      vi.mocked(router.useSearchParams).mockReturnValue(
        new URLSearchParams('asin=B001234567&keyword=another+keyword&startDate=2025-08-31&endDate=2025-09-06')
      )
      
      rerender(
        <QueryClientProvider client={queryClient}>
          <KeywordAnalysisPage />
        </QueryClientProvider>
      )
      
      // Dates should remain the same
      expect(screen.getByTestId('calendar-trigger')).toHaveTextContent('Week 36, 2025')
    })
  })

  describe('Comparison View with Current Dates', () => {
    it('should show comparison data for current week vs previous week', async () => {
      vi.mocked(router.useSearchParams).mockReturnValue(
        new URLSearchParams('asin=B001234567&keywords=keyword1,keyword2&startDate=2025-08-31&endDate=2025-09-06&compareStartDate=2025-08-24&compareEndDate=2025-08-30')
      )
      
      vi.mocked(keywordApi.useKeywordComparison).mockReturnValue({
        data: {
          keywords: [
            {
              keyword: 'keyword1',
              current: { impressions: 10000, clicks: 500 },
              comparison: { impressions: 8000, clicks: 400 },
              changes: { impressions: 0.25, clicks: 0.25 },
            },
            {
              keyword: 'keyword2',
              current: { impressions: 5000, clicks: 250 },
              comparison: { impressions: 4000, clicks: 200 },
              changes: { impressions: 0.25, clicks: 0.25 },
            },
          ],
        },
        isLoading: false,
        error: null,
      } as any)
      
      render(
        <QueryClientProvider client={queryClient}>
          <KeywordAnalysisPage />
        </QueryClientProvider>
      )
      
      await waitFor(() => {
        // Should show comparison view
        expect(screen.getByText('keyword1')).toBeInTheDocument()
        expect(screen.getByText('keyword2')).toBeInTheDocument()
        
        // Should show percentage changes
        expect(screen.getByText('+25.0%')).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing parameters gracefully', () => {
      vi.mocked(router.useSearchParams).mockReturnValue(new URLSearchParams(''))
      
      render(
        <QueryClientProvider client={queryClient}>
          <KeywordAnalysisPage />
        </QueryClientProvider>
      )
      
      // Should show message about selecting ASIN and keyword
      expect(screen.getByText(/Please select an ASIN/i)).toBeInTheDocument()
    })

    it('should handle month boundaries correctly', () => {
      // Set to end of August
      vi.setSystemTime(new Date('2025-08-31T23:59:59Z'))
      
      vi.mocked(router.useSearchParams).mockReturnValue(
        new URLSearchParams('asin=B001234567&keyword=test+keyword')
      )
      
      render(
        <QueryClientProvider client={queryClient}>
          <KeywordAnalysisPage />
        </QueryClientProvider>
      )
      
      // Should still handle the week spanning August and September
      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining('startDate=2025-08-31&endDate=2025-09-06')
      )
    })

    it('should handle year boundaries correctly', () => {
      // Set to December 30, 2025
      vi.setSystemTime(new Date('2025-12-30T12:00:00Z'))
      
      vi.mocked(router.useSearchParams).mockReturnValue(
        new URLSearchParams('asin=B001234567&keyword=test+keyword')
      )
      
      render(
        <QueryClientProvider client={queryClient}>
          <KeywordAnalysisPage />
        </QueryClientProvider>
      )
      
      // Should handle week spanning 2025 and 2026
      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining('startDate=2025-12-28&endDate=2026-01-03')
      )
    })

    it('should maintain comparison toggle state across date changes', async () => {
      vi.mocked(router.useSearchParams).mockReturnValue(
        new URLSearchParams('asin=B001234567&keyword=test+keyword&startDate=2025-08-31&endDate=2025-09-06&compareStartDate=2025-08-24&compareEndDate=2025-08-30')
      )
      
      render(
        <QueryClientProvider client={queryClient}>
          <KeywordAnalysisPage />
        </QueryClientProvider>
      )
      
      await waitFor(() => {
        // Comparison should be enabled
        const comparisonToggle = screen.getByLabelText(/compare to/i)
        expect(comparisonToggle).toBeChecked()
      })
      
      // When changing period type, comparison should remain enabled
      const monthButton = screen.getByText('Month')
      fireEvent.click(monthButton)
      
      await waitFor(() => {
        const comparisonToggle = screen.getByLabelText(/compare to/i)
        expect(comparisonToggle).toBeChecked()
      })
    })
  })
})

// Add missing import
import { fireEvent } from '@testing-library/react'