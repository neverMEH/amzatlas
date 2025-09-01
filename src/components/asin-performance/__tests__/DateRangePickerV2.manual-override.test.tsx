import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DateRangePickerV2 } from '../DateRangePickerV2'
import { useASINDataAvailability } from '@/lib/api/asin-performance'
import '@testing-library/jest-dom'

// Mock the API hook
vi.mock('@/lib/api/asin-performance', () => ({
  useASINDataAvailability: vi.fn()
}))

describe('DateRangePickerV2 - Manual Override Behavior', () => {
  const mockOnChange = vi.fn()
  const mockOnCompareChange = vi.fn()
  const mockUseASINDataAvailability = useASINDataAvailability as vi.MockedFunction<typeof useASINDataAvailability>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const defaultProps = {
    startDate: '2025-08-01',
    endDate: '2025-08-07',
    onChange: mockOnChange,
  }

  it('should not override manual selection when ASIN changes', async () => {
    // Initial ASIN data
    mockUseASINDataAvailability.mockReturnValue({
      data: {
        mostRecentCompleteMonth: {
          year: 2025,
          month: 7,
          startDate: '2025-07-01',
          endDate: '2025-07-31'
        },
        fallbackRange: null,
        summary: {
          totalRanges: 10,
          earliestDate: '2024-08-18',
          latestDate: '2025-08-03'
        }
      },
      isLoading: false,
      error: null
    } as any)

    const { rerender } = render(<DateRangePickerV2 {...defaultProps} asin="B08N5WRWNW" />)
    
    // Wait for initial automatic date range
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({
        startDate: '2025-07-01',
        endDate: '2025-07-31'
      })
    })

    // Clear mock
    mockOnChange.mockClear()

    // Simulate manual date selection by clicking a different period type
    fireEvent.click(screen.getByText('Week'))
    
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
    })

    // Clear mock again
    mockOnChange.mockClear()

    // Change ASIN with different data
    mockUseASINDataAvailability.mockReturnValue({
      data: {
        mostRecentCompleteMonth: {
          year: 2025,
          month: 6,
          startDate: '2025-06-01',
          endDate: '2025-06-30'
        },
        fallbackRange: null,
        summary: {
          totalRanges: 8,
          earliestDate: '2024-09-01',
          latestDate: '2025-07-15'
        }
      },
      isLoading: false,
      error: null
    } as any)

    // Re-render with new ASIN but hasManualSelection=true
    rerender(<DateRangePickerV2 {...defaultProps} asin="B09N3ZNHTY" hasManualSelection={true} />)
    
    // Should NOT automatically update date range
    await waitFor(() => {
      expect(mockOnChange).not.toHaveBeenCalled()
    })
  })

  it('should provide smooth transition when loading ASIN data', async () => {
    // Start with loading state
    mockUseASINDataAvailability.mockReturnValue({
      data: null,
      isLoading: true,
      error: null
    } as any)

    const { rerender } = render(<DateRangePickerV2 {...defaultProps} asin="B08N5WRWNW" />)
    
    // Should show loading indicator
    expect(screen.getByText('Loading ASIN data...')).toBeInTheDocument()
    
    // Date range should not change during loading
    expect(mockOnChange).not.toHaveBeenCalled()
    
    // Simulate data loaded
    mockUseASINDataAvailability.mockReturnValue({
      data: {
        mostRecentCompleteMonth: {
          year: 2025,
          month: 7,
          startDate: '2025-07-01',
          endDate: '2025-07-31'
        },
        fallbackRange: null,
        summary: {
          totalRanges: 10,
          earliestDate: '2024-08-18',
          latestDate: '2025-08-03'
        }
      },
      isLoading: false,
      error: null
    } as any)

    rerender(<DateRangePickerV2 {...defaultProps} asin="B08N5WRWNW" />)
    
    // Loading indicator should disappear
    expect(screen.queryByText('Loading ASIN data...')).not.toBeInTheDocument()
    
    // Date range should update
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({
        startDate: '2025-07-01',
        endDate: '2025-07-31'
      })
    })
  })

  it('should handle rapid ASIN changes gracefully', async () => {
    // First ASIN
    mockUseASINDataAvailability.mockReturnValue({
      data: {
        mostRecentCompleteMonth: {
          year: 2025,
          month: 7,
          startDate: '2025-07-01',
          endDate: '2025-07-31'
        },
        fallbackRange: null,
        summary: {
          totalRanges: 10,
          earliestDate: '2024-08-18',
          latestDate: '2025-08-03'
        }
      },
      isLoading: false,
      error: null
    } as any)

    const { rerender } = render(<DateRangePickerV2 {...defaultProps} asin="B08N5WRWNW" />)
    
    // Quickly change ASINs multiple times
    mockUseASINDataAvailability.mockReturnValue({
      data: null,
      isLoading: true,
      error: null
    } as any)
    
    rerender(<DateRangePickerV2 {...defaultProps} asin="B09N3ZNHTY" />)
    
    mockUseASINDataAvailability.mockReturnValue({
      data: null,
      isLoading: true,
      error: null
    } as any)
    
    rerender(<DateRangePickerV2 {...defaultProps} asin="B07N4WRNWH" />)
    
    // Final ASIN with data
    mockUseASINDataAvailability.mockReturnValue({
      data: {
        mostRecentCompleteMonth: {
          year: 2025,
          month: 5,
          startDate: '2025-05-01',
          endDate: '2025-05-31'
        },
        fallbackRange: null,
        summary: {
          totalRanges: 12,
          earliestDate: '2024-06-01',
          latestDate: '2025-06-15'
        }
      },
      isLoading: false,
      error: null
    } as any)
    
    rerender(<DateRangePickerV2 {...defaultProps} asin="B07N4WRNWH" />)
    
    // Should only update for the final ASIN
    await waitFor(() => {
      const calls = mockOnChange.mock.calls
      const lastCall = calls[calls.length - 1]
      expect(lastCall[0]).toEqual({
        startDate: '2025-05-01',
        endDate: '2025-05-31'
      })
    })
  })

  it('should maintain period type selection across ASIN changes when appropriate', async () => {
    // Initial ASIN with month data
    mockUseASINDataAvailability.mockReturnValue({
      data: {
        mostRecentCompleteMonth: {
          year: 2025,
          month: 7,
          startDate: '2025-07-01',
          endDate: '2025-07-31'
        },
        fallbackRange: null,
        summary: {
          totalRanges: 10,
          earliestDate: '2024-08-18',
          latestDate: '2025-08-03'
        }
      },
      isLoading: false,
      error: null
    } as any)

    const { rerender } = render(<DateRangePickerV2 {...defaultProps} asin="B08N5WRWNW" />)
    
    // Should set to month period type
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Month', pressed: true })).toBeInTheDocument()
    })

    // Clear mock
    mockOnChange.mockClear()

    // Change to another ASIN with month data
    mockUseASINDataAvailability.mockReturnValue({
      data: {
        mostRecentCompleteMonth: {
          year: 2025,
          month: 6,
          startDate: '2025-06-01',
          endDate: '2025-06-30'
        },
        fallbackRange: null,
        summary: {
          totalRanges: 8,
          earliestDate: '2024-09-01',
          latestDate: '2025-07-15'
        }
      },
      isLoading: false,
      error: null
    } as any)

    rerender(<DateRangePickerV2 {...defaultProps} asin="B09N3ZNHTY" />)
    
    // Should maintain month period type
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Month', pressed: true })).toBeInTheDocument()
    })
  })
})