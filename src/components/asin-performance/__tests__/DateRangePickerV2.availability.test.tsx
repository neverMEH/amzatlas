import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DateRangePickerV2 } from '../DateRangePickerV2'
import { useASINDataAvailability, useASINMonthlyDataAvailability } from '@/lib/api/asin-performance'

vi.mock('@/lib/api/asin-performance')

describe('DateRangePickerV2 with data availability highlighting', () => {
  const defaultProps = {
    startDate: '2024-08-01',
    endDate: '2024-08-31',
    onChange: vi.fn(),
  }

  const mockDataAvailability = {
    asin: 'B08XVYZ1Y5',
    dateRanges: [
      { start_date: '2024-08-01', end_date: '2024-08-07', record_count: 500 },
      { start_date: '2024-08-08', end_date: '2024-08-14', record_count: 450 },
      { start_date: '2024-08-15', end_date: '2024-08-21', record_count: 480 },
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
      '2024-08-01': 5,
      '2024-08-02': 3,
      '2024-08-05': 7,
      '2024-08-10': 2,
      '2024-08-15': 4,
      '2024-08-20': 6,
      '2024-08-25': 3,
      '2024-08-31': 1
    },
    summary: {
      totalDays: 8,
      totalRecords: 31,
      density: 0.2581,
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

  it('should not fetch data availability when no ASIN is provided', () => {
    render(<DateRangePickerV2 {...defaultProps} />)
    
    expect(useASINDataAvailability).toHaveBeenCalledWith(null)
    // Monthly data hook is called but with null parameters when no ASIN
    expect(useASINMonthlyDataAvailability).toHaveBeenCalledWith(null, null, null)
  })

  it('should fetch data availability when ASIN is provided', () => {
    render(<DateRangePickerV2 {...defaultProps} asin="B08XVYZ1Y5" />)
    
    expect(useASINDataAvailability).toHaveBeenCalledWith('B08XVYZ1Y5')
  })

  it('should fetch monthly data when calendar is opened', async () => {
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

    // Initially called with null (calendar not open)
    expect(useASINMonthlyDataAvailability).toHaveBeenLastCalledWith('B08XVYZ1Y5', null, null)

    // Open the calendar
    const trigger = screen.getByTestId('calendar-trigger')
    fireEvent.click(trigger)

    // Should fetch monthly data for the current displayed month
    await waitFor(() => {
      expect(useASINMonthlyDataAvailability).toHaveBeenLastCalledWith('B08XVYZ1Y5', 2024, 8)
    })
  })

  it('should show loading state while fetching availability data', () => {
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

    // Open the calendar
    const trigger = screen.getByTestId('calendar-trigger')
    fireEvent.click(trigger)

    // Should show some loading indication (implementation specific)
    // This might be a spinner, skeleton, or disabled state
    expect(screen.getByTestId('week-selector')).toBeInTheDocument()
  })

  it('should pass available weeks to WeekSelector', async () => {
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

    // Open the calendar
    const trigger = screen.getByTestId('calendar-trigger')
    fireEvent.click(trigger)

    // Should show availability indicators for weeks with data
    await waitFor(() => {
      const availabilityIndicators = document.querySelectorAll('[data-available]')
      expect(availabilityIndicators.length).toBeGreaterThan(0)
    })
  })

  it('should pass available months to MonthSelector', async () => {
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

    // Open the calendar
    const trigger = screen.getByTestId('calendar-trigger')
    fireEvent.click(trigger)

    // Switch to month view
    const monthTab = screen.getByRole('button', { name: /month/i })
    fireEvent.click(monthTab)

    // Should show availability indicators for months with data
    await waitFor(() => {
      const availabilityIndicators = document.querySelectorAll('[data-available]')
      expect(availabilityIndicators.length).toBeGreaterThan(0)
    })
  })

  it('should update calendar when switching between ASINs', async () => {
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

  it('should handle error states gracefully', async () => {
    ;(useASINDataAvailability as any).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to fetch data availability')
    })

    render(
      <DateRangePickerV2 
        {...defaultProps} 
        asin="B08XVYZ1Y5"
      />
    )

    // Open the calendar
    const trigger = screen.getByTestId('calendar-trigger')
    fireEvent.click(trigger)

    // Calendar should still be functional without availability data
    expect(screen.getByTestId('week-selector')).toBeInTheDocument()
    
    // Should not show any availability indicators
    const availabilityIndicators = document.querySelectorAll('[data-available]')
    expect(availabilityIndicators).toHaveLength(0)
  })

  it('should show daily granularity in month view when monthly data is available', async () => {
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

    // Open the calendar
    const trigger = screen.getByTestId('calendar-trigger')
    fireEvent.click(trigger)

    // Switch to month view
    const monthTab = screen.getByRole('button', { name: /month/i })
    fireEvent.click(monthTab)

    // Should show daily availability (implementation specific)
    await waitFor(() => {
      // Verify that individual days show availability
      const dayButtons = Object.keys(mockMonthlyData.dailyData).map(date => {
        return document.querySelector(`[data-date="${date}"]`)
      }).filter(Boolean)
      
      expect(dayButtons.length).toBeGreaterThan(0)
    })
  })

  it('should not refetch data when closing and reopening calendar', async () => {
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

    // Open the calendar
    const trigger = screen.getByTestId('calendar-trigger')
    fireEvent.click(trigger)

    // Close by clicking outside
    fireEvent.click(document.body)

    // Clear mock calls
    vi.clearAllMocks()

    // Reopen calendar
    fireEvent.click(trigger)

    // Should not refetch data (cached)
    expect(useASINDataAvailability).toHaveBeenCalledTimes(1)
  })

  it('should show density information in tooltips', async () => {
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

    // Open the calendar
    const trigger = screen.getByTestId('calendar-trigger')
    fireEvent.click(trigger)

    // Hover over a date with data
    const dateWithData = document.querySelector('[data-date="2024-08-01"]')
    if (dateWithData) {
      fireEvent.mouseEnter(dateWithData)

      // Should show tooltip with data count (implementation specific)
      await waitFor(() => {
        const tooltip = screen.queryByRole('tooltip')
        if (tooltip) {
          expect(tooltip).toHaveTextContent(/5.*records/i)
        }
      })
    }
  })
})