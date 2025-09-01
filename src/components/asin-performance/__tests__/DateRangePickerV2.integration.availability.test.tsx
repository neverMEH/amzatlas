import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { DateRangePickerV2 } from '../DateRangePickerV2'
import { useASINDataAvailability, useASINMonthlyDataAvailability } from '@/lib/api/asin-performance'

vi.mock('@/lib/api/asin-performance')

describe('DateRangePickerV2 Integration Tests', () => {
  const defaultProps = {
    startDate: '2024-08-01',
    endDate: '2024-08-31',
    onChange: vi.fn(),
  }

  const mockDataAvailability = {
    asin: 'B08XVYZ1Y5',
    dateRanges: [
      { start_date: '2024-08-04', end_date: '2024-08-10', record_count: 500 },
      { start_date: '2024-08-11', end_date: '2024-08-17', record_count: 450 },
      { start_date: '2024-08-18', end_date: '2024-08-24', record_count: 480 },
      { start_date: '2024-09-01', end_date: '2024-09-07', record_count: 520 },
    ],
    mostRecentCompleteMonth: {
      year: 2024,
      month: 8,
      startDate: '2024-08-01',
      endDate: '2024-08-31'
    },
    fallbackRange: null,
    summary: {
      totalRecords: 1950,
      dateRangeCount: 4,
      earliestDate: '2024-08-01',
      latestDate: '2024-09-07'
    }
  }

  const mockMonthlyData = {
    asin: 'B08XVYZ1Y5',
    year: 2024,
    month: 8,
    dailyData: {
      '2024-08-05': 50,
      '2024-08-10': 45,
      '2024-08-15': 60,
      '2024-08-20': 55,
      '2024-08-25': 40,
    },
    summary: {
      totalDays: 5,
      totalRecords: 250,
      density: 0.161,
      hasData: true
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useASINDataAvailability as any).mockReturnValue({
      data: null,
      isLoading: false,
      error: null
    })
    ;(useASINMonthlyDataAvailability as any).mockReturnValue({
      data: null,
      isLoading: false,
      error: null
    })
  })

  describe('Data Loading and Display', () => {
    it('should show availability indicators in calendar view', async () => {
      ;(useASINDataAvailability as any).mockReturnValue({
        data: mockDataAvailability,
        isLoading: false,
        error: null
      })
      ;(useASINMonthlyDataAvailability as any).mockReturnValue({
        data: mockMonthlyData,
        isLoading: false,
        error: null
      })

      render(
        <DateRangePickerV2 
          {...defaultProps} 
          asin="B08XVYZ1Y5"
        />
      )

      // Open calendar
      fireEvent.click(screen.getByTestId('calendar-trigger'))

      await waitFor(() => {
        // Component automatically switches to month view when mostRecentCompleteMonth is available
        expect(screen.getByTestId('month-selector')).toBeInTheDocument()
      })

      // Should show availability indicators for months with data
      const availabilityIndicators = document.querySelectorAll('[data-available]')
      expect(availabilityIndicators.length).toBeGreaterThan(0)
    })

    it('should show week view when no complete month data is available', async () => {
      // Mock data without mostRecentCompleteMonth
      const dataWithoutCompleteMonth = {
        ...mockDataAvailability,
        mostRecentCompleteMonth: null
      }
      
      ;(useASINDataAvailability as any).mockReturnValue({
        data: dataWithoutCompleteMonth,
        isLoading: false,
        error: null
      })
      ;(useASINMonthlyDataAvailability as any).mockReturnValue({
        data: mockMonthlyData,
        isLoading: false,
        error: null
      })

      render(
        <DateRangePickerV2 
          {...defaultProps} 
          asin="B08XVYZ1Y5"
        />
      )

      // Open calendar
      fireEvent.click(screen.getByTestId('calendar-trigger'))

      await waitFor(() => {
        // Should stay in week view when no complete month data
        expect(screen.getByTestId('week-selector')).toBeInTheDocument()
      })

      // Should show availability indicators for weeks with data
      const availabilityIndicators = document.querySelectorAll('[data-available]')
      expect(availabilityIndicators.length).toBeGreaterThan(0)
    })

    it('should show month availability in month view', async () => {
      ;(useASINDataAvailability as any).mockReturnValue({
        data: mockDataAvailability,
        isLoading: false,
        error: null
      })

      render(
        <DateRangePickerV2 
          {...defaultProps} 
          asin="B08XVYZ1Y5"
        />
      )

      // Open calendar - it will auto-switch to month view due to mostRecentCompleteMonth
      fireEvent.click(screen.getByTestId('calendar-trigger'))

      await waitFor(() => {
        expect(screen.getByTestId('month-selector')).toBeInTheDocument()
      })

      // August should have availability indicator
      const augButton = screen.getByRole('button', { name: /aug/i })
      const indicator = augButton.querySelector('[data-available]')
      expect(indicator).toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('should handle loading state gracefully', async () => {
      ;(useASINDataAvailability as any).mockReturnValue({
        data: null,
        isLoading: true,
        error: null
      })

      render(
        <DateRangePickerV2 
          {...defaultProps} 
          asin="B08XVYZ1Y5"
        />
      )

      // Should show loading indicator
      expect(screen.getByText(/loading data availability/i)).toBeInTheDocument()

      // Open calendar
      fireEvent.click(screen.getByTestId('calendar-trigger'))

      // Calendar should still be functional during loading
      // Default period type is week when no data is available
      expect(screen.getByTestId('week-selector')).toBeInTheDocument()
      
      // No availability indicators during loading
      const indicators = document.querySelectorAll('[data-available]')
      expect(indicators).toHaveLength(0)
    })

    it('should show no data message when ASIN has no data', async () => {
      ;(useASINDataAvailability as any).mockReturnValue({
        data: {
          asin: 'B08XVYZ1Y5',
          dateRanges: [],
          mostRecentCompleteMonth: null,
          fallbackRange: null,
          summary: {
            totalRecords: 0,
            dateRangeCount: 0,
            earliestDate: null,
            latestDate: null
          }
        },
        isLoading: false,
        error: null
      })

      render(
        <DateRangePickerV2 
          {...defaultProps} 
          asin="B08XVYZ1Y5"
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/no historical data available/i)).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      ;(useASINDataAvailability as any).mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to fetch data')
      })

      render(
        <DateRangePickerV2 
          {...defaultProps} 
          asin="B08XVYZ1Y5"
        />
      )

      // Should show error message
      expect(screen.getByText(/failed to load data availability/i)).toBeInTheDocument()

      // Open calendar
      fireEvent.click(screen.getByTestId('calendar-trigger'))

      // Calendar should still work without availability data
      // Default period type is week when there's an error
      expect(screen.getByTestId('week-selector')).toBeInTheDocument()
      
      // No indicators when there's an error
      const indicators = document.querySelectorAll('[data-available]')
      expect(indicators).toHaveLength(0)
    })
  })

  describe('Performance Optimization', () => {
    it('should not refetch data when calendar is closed and reopened', async () => {
      ;(useASINDataAvailability as any).mockReturnValue({
        data: mockDataAvailability,
        isLoading: false,
        error: null
      })

      render(
        <DateRangePickerV2 
          {...defaultProps} 
          asin="B08XVYZ1Y5"
        />
      )

      // Open calendar
      fireEvent.click(screen.getByTestId('calendar-trigger'))
      
      await waitFor(() => {
        // Should auto-switch to month view due to mostRecentCompleteMonth
        expect(screen.getByTestId('month-selector')).toBeInTheDocument()
      })

      // Close calendar
      fireEvent.click(document.body)

      // Clear mock calls
      vi.clearAllMocks()

      // Reopen calendar
      fireEvent.click(screen.getByTestId('calendar-trigger'))

      // Should not refetch data (React Query handles caching)
      expect(useASINDataAvailability).toHaveBeenCalledTimes(1)
    })

    it('should fetch new data when ASIN changes', async () => {
      const { rerender } = render(
        <DateRangePickerV2 
          {...defaultProps} 
          asin="B08XVYZ1Y5"
        />
      )

      expect(useASINDataAvailability).toHaveBeenCalledWith('B08XVYZ1Y5')

      // Change ASIN
      rerender(
        <DateRangePickerV2 
          {...defaultProps} 
          asin="B09ABC123"
        />
      )

      expect(useASINDataAvailability).toHaveBeenCalledWith('B09ABC123')
    })

    it('should only fetch monthly data when calendar month changes', async () => {
      // Use data without complete month to ensure week view
      const dataWithoutCompleteMonth = {
        ...mockDataAvailability,
        mostRecentCompleteMonth: null
      }
      
      ;(useASINDataAvailability as any).mockReturnValue({
        data: dataWithoutCompleteMonth,
        isLoading: false,
        error: null
      })

      render(
        <DateRangePickerV2 
          {...defaultProps} 
          asin="B08XVYZ1Y5"
        />
      )

      // Open calendar
      fireEvent.click(screen.getByTestId('calendar-trigger'))

      await waitFor(() => {
        // Should be in week view
        expect(screen.getByTestId('week-selector')).toBeInTheDocument()
        // And should have fetched monthly data for August
        expect(useASINMonthlyDataAvailability).toHaveBeenLastCalledWith('B08XVYZ1Y5', 2024, 8)
      })

      // Navigate to next month in week view
      const nextButton = screen.getByLabelText('Next month')
      fireEvent.click(nextButton)

      // Should fetch data for September
      await waitFor(() => {
        expect(useASINMonthlyDataAvailability).toHaveBeenLastCalledWith('B08XVYZ1Y5', 2024, 9)
      })
    })
  })

  describe('User Interactions', () => {
    it('should allow date selection with availability indicators visible', async () => {
      // Use data without mostRecentCompleteMonth to stay in week view
      const dataForWeekView = {
        ...mockDataAvailability,
        mostRecentCompleteMonth: null
      }
      
      ;(useASINDataAvailability as any).mockReturnValue({
        data: dataForWeekView,
        isLoading: false,
        error: null
      })

      const onChange = vi.fn()
      
      render(
        <DateRangePickerV2 
          {...defaultProps}
          onChange={onChange}
          asin="B08XVYZ1Y5"
        />
      )

      // Open calendar
      fireEvent.click(screen.getByTestId('calendar-trigger'))

      await waitFor(() => {
        // Should be in week view since no complete month data
        expect(screen.getByTestId('week-selector')).toBeInTheDocument()
      })

      // Click on a date in the week selector
      const dateButton = await screen.findByText('15')
      fireEvent.click(dateButton)

      // Should call onChange with the selected week
      expect(onChange).toHaveBeenCalled()
      const [call] = onChange.mock.calls
      expect(call[0]).toHaveProperty('startDate')
      expect(call[0]).toHaveProperty('endDate')
    })

    it('should maintain availability display when switching between week and month views', async () => {
      // Use full mock data that includes both weekly and monthly availability
      ;(useASINDataAvailability as any).mockReturnValue({
        data: mockDataAvailability,
        isLoading: false,
        error: null
      })

      render(
        <DateRangePickerV2 
          {...defaultProps} 
          asin="B08XVYZ1Y5"
        />
      )

      // Open calendar - will auto-switch to month view due to mostRecentCompleteMonth
      fireEvent.click(screen.getByTestId('calendar-trigger'))
      
      await waitFor(() => {
        expect(screen.getByTestId('month-selector')).toBeInTheDocument()
      })
      
      // Should have indicators in month view
      let indicators = document.querySelectorAll('[data-available]')
      expect(indicators.length).toBeGreaterThan(0)

      // Close calendar
      fireEvent.click(document.body)
      
      // Switch to week view using the period type selector
      const weekButton = screen.getByTestId('week-icon').parentElement
      if (weekButton) {
        fireEvent.click(weekButton)
      }
      
      // Wait a moment for state to settle
      await waitFor(() => {
        expect(screen.getByText(/Week \d+, \d+/)).toBeInTheDocument()
      })
      
      // Open calendar again
      fireEvent.click(screen.getByTestId('calendar-trigger'))

      await waitFor(() => {
        expect(screen.getByTestId('week-selector')).toBeInTheDocument()
      })

      // Should still have indicators in week view
      indicators = document.querySelectorAll('[data-available]')
      expect(indicators.length).toBeGreaterThan(0)
    })
  })
})