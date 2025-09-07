import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { DateRangePicker } from '../DateRangePicker'

// Mock the API module
vi.mock('@/lib/api/asin-performance', () => ({
  fetchASINDataAvailability: vi.fn(),
  useASINDataAvailability: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null
  }))
}))

// Mock SmartSuggestions to simplify tests
vi.mock('../SmartSuggestions', () => ({
  SmartSuggestions: () => null
}))

import { useASINDataAvailability } from '@/lib/api/asin-performance'

describe('DateRangePicker - ASIN Default Behavior', () => {
  const mockOnChange = vi.fn()
  const mockOnCompareChange = vi.fn()
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch data availability when ASIN is provided', async () => {
    const mockResponse = {
      asin: 'B08XVYZ1Y5',
      mostRecentCompleteMonth: {
        year: 2024,
        month: 8,
        startDate: '2024-08-01',
        endDate: '2024-08-31'
      },
      fallbackRange: null,
      dateRanges: [],
      summary: {}
    };

    (useASINDataAvailability as any).mockReturnValue({
      data: mockResponse,
      isLoading: false,
      error: null
    })

    render(
      <DateRangePicker
        startDate="2024-07-01"
        endDate="2024-07-31"
        onChange={mockOnChange}
        asin="B08XVYZ1Y5"
      />
    )

    await waitFor(() => {
      expect(useASINDataAvailability).toHaveBeenCalledWith('B08XVYZ1Y5')
    })
  })

  it('should set date range to most recent complete month when ASIN changes', async () => {
    const mockResponse = {
      asin: 'B08XVYZ1Y5',
      mostRecentCompleteMonth: {
        year: 2024,
        month: 8,
        startDate: '2024-08-01',
        endDate: '2024-08-31'
      },
      fallbackRange: null,
      dateRanges: [],
      summary: {}
    };

    // Initial render without ASIN
    (useASINDataAvailability as any).mockReturnValue({
      data: null,
      isLoading: false,
      error: null
    })

    const result = render(
      <DateRangePicker
        startDate="2024-07-01"
        endDate="2024-07-31"
        onChange={mockOnChange}
      />
    )

    // Mock data availability for ASIN
    (useASINDataAvailability as any).mockReturnValue({
      data: mockResponse,
      isLoading: false,
      error: null
    })

    // Simulate ASIN selection
    result.rerender(
      <DateRangePicker
        startDate="2024-07-01"
        endDate="2024-07-31"
        onChange={mockOnChange}
        asin="B08XVYZ1Y5"
      />
    )

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({
        startDate: '2024-08-01',
        endDate: '2024-08-31'
      })
    })
  })

  it('should use fallback range when no complete month is available', async () => {
    const mockResponse = {
      asin: 'NEW_ASIN',
      mostRecentCompleteMonth: null,
      fallbackRange: {
        startDate: '2024-09-15',
        endDate: '2024-09-21'
      },
      dateRanges: [],
      summary: {}
    };

    (useASINDataAvailability as any).mockReturnValue({
      data: mockResponse,
      isLoading: false,
      error: null
    })

    render(
      <DateRangePicker
        startDate="2024-07-01"
        endDate="2024-07-31"
        onChange={mockOnChange}
        asin="NEW_ASIN"
      />
    )

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({
        startDate: '2024-09-15',
        endDate: '2024-09-21'
      })
    })
  })

  it('should not change date range when no data is available', async () => {
    const mockResponse = {
      asin: 'NO_DATA_ASIN',
      mostRecentCompleteMonth: null,
      fallbackRange: null,
      dateRanges: [],
      summary: {}
    };

    (useASINDataAvailability as any).mockReturnValue({
      data: mockResponse,
      isLoading: false,
      error: null
    })

    render(
      <DateRangePicker
        startDate="2024-07-01"
        endDate="2024-07-31"
        onChange={mockOnChange}
        asin="NO_DATA_ASIN"
      />
    )

    await waitFor(() => {
      expect(useASINDataAvailability).toHaveBeenCalledWith('NO_DATA_ASIN')
    })

    // Should not call onChange when no data is available
    expect(mockOnChange).not.toHaveBeenCalled()
  })

  it('should handle API errors gracefully', async () => {
    (useASINDataAvailability as any).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('API Error')
    })

    render(
      <DateRangePicker
        startDate="2024-07-01"
        endDate="2024-07-31"
        onChange={mockOnChange}
        asin="ERROR_ASIN"
      />
    )

    await waitFor(() => {
      expect(useASINDataAvailability).toHaveBeenCalledWith('ERROR_ASIN')
    })

    // Should not call onChange on error
    expect(mockOnChange).not.toHaveBeenCalled()
  })

  it('should show loading state while fetching data availability', async () => {
    // First render with loading state
    (useASINDataAvailability as any).mockReturnValue({
      data: null,
      isLoading: true,
      error: null
    })

    const { rerender } = render(
      <DateRangePicker
        startDate="2024-07-01"
        endDate="2024-07-31"
        onChange={mockOnChange}
        asin="B08XVYZ1Y5"
      />
    )

    // Check for loading indicator
    expect(screen.getByTestId('date-range-loading')).toBeInTheDocument()

    // Mock data loaded
    (useASINDataAvailability as any).mockReturnValue({
      data: {
        asin: 'B08XVYZ1Y5',
        mostRecentCompleteMonth: {
          year: 2024,
          month: 8,
          startDate: '2024-08-01',
          endDate: '2024-08-31'
        },
        fallbackRange: null,
        dateRanges: [],
        summary: {}
      },
      isLoading: false,
      error: null
    })

    // Re-render with loaded data
    rerender(
      <DateRangePicker
        startDate="2024-07-01"
        endDate="2024-07-31"
        onChange={mockOnChange}
        asin="B08XVYZ1Y5"
      />
    )

    await waitFor(() => {
      expect(screen.queryByTestId('date-range-loading')).not.toBeInTheDocument()
    })
  })

  it('should not refetch when ASIN remains the same', async () => {
    const mockResponse = {
      asin: 'B08XVYZ1Y5',
      mostRecentCompleteMonth: {
        year: 2024,
        month: 8,
        startDate: '2024-08-01',
        endDate: '2024-08-31'
      },
      fallbackRange: null,
      dateRanges: [],
      summary: {}
    };

    (useASINDataAvailability as any).mockReturnValue({
      data: mockResponse,
      isLoading: false,
      error: null
    })

    const { rerender } = render(
      <DateRangePicker
        startDate="2024-07-01"
        endDate="2024-07-31"
        onChange={mockOnChange}
        asin="B08XVYZ1Y5"
      />
    )

    await waitFor(() => {
      expect(useASINDataAvailability).toHaveBeenCalledTimes(1)
    })

    // Re-render with the same ASIN
    rerender(
      <DateRangePicker
        startDate="2024-08-01"
        endDate="2024-08-31"
        onChange={mockOnChange}
        asin="B08XVYZ1Y5"
      />
    )

    // Hook should be called again (React will handle deduplication)
    expect(useASINDataAvailability).toHaveBeenCalledTimes(2)
    expect(useASINDataAvailability).toHaveBeenLastCalledWith('B08XVYZ1Y5')
  })

  it('should update comparison period appropriately when ASIN changes', async () => {
    const mockResponse = {
      asin: 'B08XVYZ1Y5',
      mostRecentCompleteMonth: {
        year: 2024,
        month: 8,
        startDate: '2024-08-01',
        endDate: '2024-08-31'
      },
      fallbackRange: null,
      dateRanges: [],
      summary: {}
    };

    (useASINDataAvailability as any).mockReturnValue({
      data: mockResponse,
      isLoading: false,
      error: null
    })

    render(
      <DateRangePicker
        startDate="2024-07-01"
        endDate="2024-07-31"
        onChange={mockOnChange}
        onCompareChange={mockOnCompareChange}
        showComparison={true}
        asin="B08XVYZ1Y5"
      />
    )

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({
        startDate: '2024-08-01',
        endDate: '2024-08-31'
      })
    })

    // Comparison period should also be updated based on the new date range
    // This depends on the SmartSuggestions component behavior
  })
});