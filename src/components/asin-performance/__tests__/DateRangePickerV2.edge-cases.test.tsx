import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DateRangePickerV2 } from '../DateRangePickerV2'
import { useASINDataAvailability } from '@/lib/api/asin-performance'
import '@testing-library/jest-dom'

// Mock the API hook
vi.mock('@/lib/api/asin-performance', () => ({
  useASINDataAvailability: vi.fn()
}))

describe('DateRangePickerV2 - Edge Cases and Error Handling', () => {
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

  describe('Edge Cases', () => {
    it('should handle ASIN with no data available', async () => {
      mockUseASINDataAvailability.mockReturnValue({
        data: {
          mostRecentCompleteMonth: null,
          fallbackRange: null,
          summary: {
            totalRanges: 0,
            earliestDate: null,
            latestDate: null
          }
        },
        isLoading: false,
        error: null
      } as any)

      render(<DateRangePickerV2 {...defaultProps} asin="B00000000" />)
      
      // Should not call onChange when no data is available
      await waitFor(() => {
        expect(mockOnChange).not.toHaveBeenCalled()
      })
      
      // Should not show loading indicator
      expect(screen.queryByText('Loading ASIN data...')).not.toBeInTheDocument()
    })

    it('should handle ASIN with only one day of data', async () => {
      mockUseASINDataAvailability.mockReturnValue({
        data: {
          mostRecentCompleteMonth: null,
          fallbackRange: {
            startDate: '2025-08-03',
            endDate: '2025-08-03'
          },
          summary: {
            totalRanges: 1,
            earliestDate: '2025-08-03',
            latestDate: '2025-08-03'
          }
        },
        isLoading: false,
        error: null
      } as any)

      render(<DateRangePickerV2 {...defaultProps} asin="B00000001" />)
      
      // Should set the single day as both start and end
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          startDate: '2025-08-03',
          endDate: '2025-08-03'
        })
      })
    })

    it('should handle ASIN with sparse data (gaps in coverage)', async () => {
      mockUseASINDataAvailability.mockReturnValue({
        data: {
          mostRecentCompleteMonth: null,
          fallbackRange: {
            startDate: '2025-07-01',
            endDate: '2025-08-03'
          },
          summary: {
            totalRanges: 5,
            earliestDate: '2025-07-01',
            latestDate: '2025-08-03'
          }
        },
        isLoading: false,
        error: null
      } as any)

      render(<DateRangePickerV2 {...defaultProps} asin="B00000002" />)
      
      // Should use the fallback range even with gaps
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          startDate: '2025-07-01',
          endDate: '2025-08-03'
        })
      })
    })

    it('should handle network errors gracefully', async () => {
      mockUseASINDataAvailability.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Network error')
      } as any)

      render(<DateRangePickerV2 {...defaultProps} asin="B00000003" />)
      
      // Should not crash or show error to user
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
      
      // Should not call onChange
      await waitFor(() => {
        expect(mockOnChange).not.toHaveBeenCalled()
      })
    })

    it('should handle API timeout gracefully', async () => {
      // Start with loading
      mockUseASINDataAvailability.mockReturnValue({
        data: null,
        isLoading: true,
        error: null
      } as any)
      
      const { rerender } = render(
        <DateRangePickerV2 {...defaultProps} asin="B00000004" />
      )
      
      // Should show loading
      expect(screen.getByText('Loading ASIN data...')).toBeInTheDocument()
      
      // Simulate timeout error
      mockUseASINDataAvailability.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Request timeout')
      } as any)
      
      rerender(<DateRangePickerV2 {...defaultProps} asin="B00000004" />)
      
      // Loading should disappear
      expect(screen.queryByText('Loading ASIN data...')).not.toBeInTheDocument()
      
      // Should not call onChange
      expect(mockOnChange).not.toHaveBeenCalled()
    })
  })

  describe('User Feedback', () => {
    it('should show appropriate loading state during data fetch', () => {
      mockUseASINDataAvailability.mockReturnValue({
        data: null,
        isLoading: true,
        error: null
      } as any)

      render(<DateRangePickerV2 {...defaultProps} asin="B00000005" />)
      
      const loadingText = screen.getByText('Loading ASIN data...')
      expect(loadingText).toBeInTheDocument()
      expect(loadingText).toHaveClass('text-sm', 'text-gray-500')
    })

    it('should show no data message when ASIN has no historical data', () => {
      mockUseASINDataAvailability.mockReturnValue({
        data: {
          mostRecentCompleteMonth: null,
          fallbackRange: null,
          summary: {
            totalRanges: 0,
            earliestDate: null,
            latestDate: null
          }
        },
        isLoading: false,
        error: null
      } as any)

      render(<DateRangePickerV2 {...defaultProps} asin="B00000010" />)
      
      const noDataText = screen.getByText('No historical data available for this ASIN')
      expect(noDataText).toBeInTheDocument()
      expect(noDataText).toHaveClass('text-sm', 'text-amber-600')
    })

    it('should not show loading state when no ASIN is selected', () => {
      mockUseASINDataAvailability.mockReturnValue({
        data: null,
        isLoading: false,
        error: null
      } as any)

      render(<DateRangePickerV2 {...defaultProps} />)
      
      expect(screen.queryByText('Loading ASIN data...')).not.toBeInTheDocument()
    })

    it('should maintain user selections during errors', async () => {
      // Start with successful data
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

      const { rerender } = render(<DateRangePickerV2 {...defaultProps} asin="B00000006" />)
      
      // Wait for automatic date setting
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          startDate: '2025-07-01',
          endDate: '2025-07-31'
        })
      })
      
      // User manually selects different period
      fireEvent.click(screen.getByText('Week'))
      
      // Clear mock
      mockOnChange.mockClear()
      
      // Simulate error on ASIN change
      mockUseASINDataAvailability.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('API Error')
      } as any)
      
      rerender(<DateRangePickerV2 {...defaultProps} asin="B00000007" hasManualSelection={true} />)
      
      // Should not change the date range
      expect(mockOnChange).not.toHaveBeenCalled()
      
      // Should still show Week as selected
      expect(screen.getByRole('button', { name: 'Week', pressed: true })).toBeInTheDocument()
    })
  })

  describe('Boundary Conditions', () => {
    it('should handle future dates in fallback range', async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const futureDate = tomorrow.toISOString().split('T')[0]
      
      mockUseASINDataAvailability.mockReturnValue({
        data: {
          mostRecentCompleteMonth: null,
          fallbackRange: {
            startDate: '2025-08-01',
            endDate: futureDate
          },
          summary: {
            totalRanges: 3,
            earliestDate: '2025-08-01',
            latestDate: futureDate
          }
        },
        isLoading: false,
        error: null
      } as any)

      render(<DateRangePickerV2 {...defaultProps} asin="B00000008" />)
      
      // Should still set the range even with future date
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          startDate: '2025-08-01',
          endDate: futureDate
        })
      })
    })

    it('should handle very old data gracefully', async () => {
      mockUseASINDataAvailability.mockReturnValue({
        data: {
          mostRecentCompleteMonth: {
            year: 2020,
            month: 1,
            startDate: '2020-01-01',
            endDate: '2020-01-31'
          },
          fallbackRange: null,
          summary: {
            totalRanges: 1,
            earliestDate: '2020-01-01',
            latestDate: '2020-01-31'
          }
        },
        isLoading: false,
        error: null
      } as any)

      render(<DateRangePickerV2 {...defaultProps} asin="B00000009" />)
      
      // Should set the old date range
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          startDate: '2020-01-01',
          endDate: '2020-01-31'
        })
      })
    })
  })
})