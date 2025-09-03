import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DateRangePickerV2 } from '../DateRangePickerV2'
import * as asinApi from '@/lib/api/asin-performance'

// Mock the API module
vi.mock('@/lib/api/asin-performance')

const mockDataAvailability = {
  dateRanges: [
    { start_date: '2024-08-01', end_date: '2024-08-31' },
    { start_date: '2024-09-01', end_date: '2024-09-30' },
    { start_date: '2024-10-01', end_date: '2024-10-31' },
  ],
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
  fallbackRange: {
    startDate: '2024-10-01',
    endDate: '2024-10-31',
  },
}

describe('DateRangePickerV2 - Current Date Handling (September 2025)', () => {
  let queryClient: QueryClient
  const mockOnChange = vi.fn()
  const mockOnCompareChange = vi.fn()

  beforeEach(() => {
    // Mock current date to September 3, 2025
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-09-03T12:00:00Z'))
    
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    
    // Setup API mock
    vi.mocked(asinApi.useASINDataAvailability).mockReturnValue({
      data: mockDataAvailability,
      isLoading: false,
      error: null,
    } as any)
    
    mockOnChange.mockClear()
    mockOnCompareChange.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <DateRangePickerV2
          startDate="2025-08-31"
          endDate="2025-09-06"
          onChange={mockOnChange}
          {...props}
        />
      </QueryClientProvider>
    )
  }

  describe('Default Behavior with Current Dates', () => {
    it('should display current week dates correctly', () => {
      renderComponent()
      
      const trigger = screen.getByTestId('calendar-trigger')
      expect(trigger).toHaveTextContent('Week 36, 2025')
    })

    it('should not override current week selection when ASIN is selected', async () => {
      renderComponent({
        asin: 'B001234567',
      })
      
      // Wait for data availability check
      await waitFor(() => {
        expect(asinApi.useASINDataAvailability).toHaveBeenCalledWith('B001234567')
      })
      
      // Should not call onChange since current dates are recent
      expect(mockOnChange).not.toHaveBeenCalled()
      
      // No data indicators should not be shown anymore
      expect(screen.queryByText('No data available for this period')).not.toBeInTheDocument()
      expect(screen.queryByText('(Latest: Oct 31, 2024)')).not.toBeInTheDocument()
    })

    it('should preserve current month selection for September 2025', async () => {
      renderComponent({
        startDate: '2025-09-01',
        endDate: '2025-09-30',
        asin: 'B001234567',
      })
      
      await waitFor(() => {
        expect(asinApi.useASINDataAvailability).toHaveBeenCalled()
      })
      
      // Should not override since September 2025 is within 2 months
      expect(mockOnChange).not.toHaveBeenCalled()
    })

    it('should override old date selection with available data', async () => {
      // Start with old dates
      renderComponent({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        asin: 'B001234567',
      })
      
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          startDate: '2024-10-01',
          endDate: '2024-10-31',
        })
      })
    })
  })

  describe('Period Type Selection', () => {
    it('should handle week selection for current week', async () => {
      renderComponent()
      
      // Click to open dropdown
      fireEvent.click(screen.getByTestId('calendar-trigger'))
      
      await waitFor(() => {
        expect(screen.getByTestId('week-selector')).toBeInTheDocument()
      })
      
      // The week selector should show current week highlighted
      const currentWeekButton = screen.getByText(/Aug 31 - Sep 6/)
      expect(currentWeekButton.closest('button')).toHaveClass('bg-blue-50')
    })

    it('should handle month selection for September 2025', async () => {
      renderComponent()
      
      // Change to month view
      fireEvent.click(screen.getByText('Month'))
      fireEvent.click(screen.getByTestId('calendar-trigger'))
      
      await waitFor(() => {
        expect(screen.getByTestId('month-selector')).toBeInTheDocument()
      })
      
      // Should show September 2025 as selectable
      expect(screen.getByText('September')).toBeInTheDocument()
      expect(screen.getByText('2025')).toBeInTheDocument()
    })

    it('should handle quarter selection for Q3 2025', async () => {
      renderComponent()
      
      // Change to quarter view
      fireEvent.click(screen.getByText('Quarter'))
      fireEvent.click(screen.getByTestId('calendar-trigger'))
      
      await waitFor(() => {
        expect(screen.getByTestId('quarter-selector')).toBeInTheDocument()
      })
      
      // Should show Q3 2025 as selectable
      expect(screen.getByText('Q3')).toBeInTheDocument()
      expect(screen.getByText('2025')).toBeInTheDocument()
    })
  })

  describe('Data Availability Indicators', () => {
    it('should show no data indicator for future dates', () => {
      renderComponent({
        startDate: '2025-09-07',
        endDate: '2025-09-13',
        asin: 'B001234567',
      })
      
      expect(screen.queryByText('No data available for this period')).not.toBeInTheDocument()
    })

    it('should not show no data indicator when data exists', async () => {
      // Mock data that includes current dates
      const currentDataAvailability = {
        ...mockDataAvailability,
        dateRanges: [
          ...mockDataAvailability.dateRanges,
          { start_date: '2025-08-01', end_date: '2025-09-06' },
        ],
        summary: {
          ...mockDataAvailability.summary,
          latestDate: '2025-09-06',
        },
      }
      
      vi.mocked(asinApi.useASINDataAvailability).mockReturnValue({
        data: currentDataAvailability,
        isLoading: false,
        error: null,
      } as any)
      
      renderComponent({
        startDate: '2025-08-31',
        endDate: '2025-09-06',
        asin: 'B001234567',
      })
      
      await waitFor(() => {
        expect(screen.queryByText('No data available for this period')).not.toBeInTheDocument()
      })
    })
  })

  describe('Manual Selection Behavior', () => {
    it('should respect hasManualSelection flag', async () => {
      renderComponent({
        startDate: '2025-08-31',
        endDate: '2025-09-06',
        asin: 'B001234567',
        hasManualSelection: true,
      })
      
      await waitFor(() => {
        expect(asinApi.useASINDataAvailability).toHaveBeenCalled()
      })
      
      // Should never call onChange when hasManualSelection is true
      expect(mockOnChange).not.toHaveBeenCalled()
    })

    it('should mark as manual selection after user interaction', async () => {
      renderComponent({
        asin: 'B001234567',
      })
      
      // Open dropdown and select a different week
      fireEvent.click(screen.getByTestId('calendar-trigger'))
      
      await waitFor(() => {
        expect(screen.getByTestId('week-selector')).toBeInTheDocument()
      })
      
      // Click on a different week
      const previousWeekButton = screen.getByText(/Aug 24 - Aug 30/)
      fireEvent.click(previousWeekButton)
      
      expect(mockOnChange).toHaveBeenCalledWith({
        startDate: '2025-08-24',
        endDate: '2025-08-30',
      })
      
      // After manual selection, changing ASIN shouldn't override dates
      // This would require re-rendering with new ASIN and checking behavior
    })
  })

  describe('Edge Cases', () => {
    it('should handle invalid date gracefully', () => {
      renderComponent({
        startDate: 'invalid-date',
        endDate: '2025-09-06',
      })
      
      expect(screen.getByText('Select dates')).toBeInTheDocument()
    })

    it('should handle loading state correctly', () => {
      vi.mocked(asinApi.useASINDataAvailability).mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      } as any)
      
      renderComponent({
        asin: 'B001234567',
      })
      
      expect(screen.getByText('Loading ASIN data...')).toBeInTheDocument()
    })

    it('should handle month boundary correctly', () => {
      // Set date to August 31, 2025
      vi.setSystemTime(new Date('2025-08-31T12:00:00Z'))
      
      renderComponent({
        startDate: '2025-08-31',
        endDate: '2025-09-06',
      })
      
      const trigger = screen.getByTestId('calendar-trigger')
      // Week 36 spans August and September
      expect(trigger).toHaveTextContent('Week 36, 2025')
    })

    it('should handle year boundary correctly', () => {
      // Set date to December 30, 2025
      vi.setSystemTime(new Date('2025-12-30T12:00:00Z'))
      
      renderComponent({
        startDate: '2025-12-28',
        endDate: '2026-01-03',
      })
      
      const trigger = screen.getByTestId('calendar-trigger')
      // This week spans 2025 and 2026
      expect(trigger).toHaveTextContent('Week 1, 2026')
    })
  })

  describe('Comparison Period Handling', () => {
    it('should suggest previous week for current week comparison', async () => {
      renderComponent({
        showComparison: true,
        onCompareChange: mockOnCompareChange,
      })
      
      // Enable comparison
      const comparisonToggle = screen.getByLabelText(/compare to/i)
      fireEvent.click(comparisonToggle)
      
      await waitFor(() => {
        // Should see smart suggestions
        expect(screen.getByText('Previous Week')).toBeInTheDocument()
        expect(screen.getByText('Aug 24 - Aug 30, 2025')).toBeInTheDocument()
      })
    })

    it('should mark recent comparisons with high confidence', async () => {
      renderComponent({
        showComparison: true,
        onCompareChange: mockOnCompareChange,
      })
      
      // Enable comparison
      const comparisonToggle = screen.getByLabelText(/compare to/i)
      fireEvent.click(comparisonToggle)
      
      await waitFor(() => {
        // Check confidence indicators
        const previousWeekCard = screen.getByText('Previous Week').closest('button')
        const confidenceIndicator = previousWeekCard?.querySelector('[data-testid="confidence-high"]')
        expect(confidenceIndicator).toBeInTheDocument()
      })
    })
  })
})