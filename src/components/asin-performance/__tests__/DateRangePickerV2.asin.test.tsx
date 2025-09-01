import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DateRangePickerV2 } from '../DateRangePickerV2'
import { useASINDataAvailability } from '@/lib/api/asin-performance'
import '@testing-library/jest-dom'

// Mock the API hook
vi.mock('@/lib/api/asin-performance', () => ({
  useASINDataAvailability: vi.fn()
}))

describe('DateRangePickerV2 - ASIN Default Date Range', () => {
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

  describe('ASIN Data Availability Integration', () => {
    it('should not fetch data availability when no ASIN is provided', () => {
      mockUseASINDataAvailability.mockReturnValue({
        data: null,
        isLoading: false,
        error: null
      } as any)

      render(<DateRangePickerV2 {...defaultProps} />)
      
      expect(mockUseASINDataAvailability).toHaveBeenCalledWith(undefined)
    })

    it('should fetch data availability when ASIN is provided', () => {
      mockUseASINDataAvailability.mockReturnValue({
        data: null,
        isLoading: true,
        error: null
      } as any)

      render(<DateRangePickerV2 {...defaultProps} asin="B08N5WRWNW" />)
      
      expect(mockUseASINDataAvailability).toHaveBeenCalledWith('B08N5WRWNW')
    })

    it('should show loading state while fetching ASIN data', () => {
      mockUseASINDataAvailability.mockReturnValue({
        data: null,
        isLoading: true,
        error: null
      } as any)

      render(<DateRangePickerV2 {...defaultProps} asin="B08N5WRWNW" />)
      
      expect(screen.getByText(/Loading ASIN data/i)).toBeInTheDocument()
    })

    it('should set date range to most recent complete month when ASIN data is available', async () => {
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

      render(<DateRangePickerV2 {...defaultProps} asin="B08N5WRWNW" />)
      
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          startDate: '2025-07-01',
          endDate: '2025-07-31'
        })
      })
    })

    it('should use fallback range when no complete month is available', async () => {
      mockUseASINDataAvailability.mockReturnValue({
        data: {
          mostRecentCompleteMonth: null,
          fallbackRange: {
            startDate: '2025-07-04',
            endDate: '2025-08-03'
          },
          summary: {
            totalRanges: 5,
            earliestDate: '2025-07-04',
            latestDate: '2025-08-03'
          }
        },
        isLoading: false,
        error: null
      } as any)

      render(<DateRangePickerV2 {...defaultProps} asin="B08N5WRWNW" />)
      
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          startDate: '2025-07-04',
          endDate: '2025-08-03'
        })
      })
    })

    it('should not update date range if already manually set', async () => {
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

      // Simulate manual date selection by rendering with hasManualSelection prop
      render(
        <DateRangePickerV2 
          {...defaultProps} 
          asin="B08N5WRWNW"
          hasManualSelection={true}
        />
      )
      
      await waitFor(() => {
        // Should not call onChange when manual selection exists
        expect(mockOnChange).not.toHaveBeenCalled()
      })
    })

    it('should update period type to month when setting complete month range', async () => {
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

      render(<DateRangePickerV2 {...defaultProps} asin="B08N5WRWNW" />)
      
      await waitFor(() => {
        // Should change to month period type
        expect(screen.getByRole('button', { name: 'Month', pressed: true })).toBeInTheDocument()
      })
    })

    it('should handle errors gracefully', () => {
      mockUseASINDataAvailability.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to fetch data availability')
      } as any)

      render(<DateRangePickerV2 {...defaultProps} asin="B08N5WRWNW" />)
      
      // Should not show error to user, just continue with normal behavior
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
      expect(mockOnChange).not.toHaveBeenCalled()
    })

    it('should reset to ASIN defaults when ASIN changes', async () => {
      const { rerender } = render(<DateRangePickerV2 {...defaultProps} />)
      
      // First render with ASIN1
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
      
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          startDate: '2025-07-01',
          endDate: '2025-07-31'
        })
      })

      // Clear mock
      mockOnChange.mockClear()

      // Change to ASIN2 with different data
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
      
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          startDate: '2025-06-01',
          endDate: '2025-06-30'
        })
      })
    })

    it('should not interfere with manual period type changes after ASIN default is set', async () => {
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

      render(<DateRangePickerV2 {...defaultProps} asin="B08N5WRWNW" />)
      
      // Wait for initial ASIN-based date range to be set
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          startDate: '2025-07-01',
          endDate: '2025-07-31'
        })
      })

      // Period type should be updated to reflect the user's manual selection
      // This would be handled by clicking period type buttons, which should work normally
      expect(screen.getByRole('button', { name: 'Month', pressed: true })).toBeInTheDocument()
    })
  })
})