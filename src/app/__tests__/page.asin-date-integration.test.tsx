import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom'
import Dashboard from '../page'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

// Mock API hooks
vi.mock('@/lib/api/asin-performance', () => ({
  useASINList: vi.fn(),
  useASINPerformance: vi.fn(),
  useASINDataAvailability: vi.fn(),
}))

import { useASINList, useASINPerformance, useASINDataAvailability } from '@/lib/api/asin-performance'

describe('Dashboard - ASIN Date Integration', () => {
  const mockUseASINList = useASINList as vi.MockedFunction<typeof useASINList>
  const mockUseASINPerformance = useASINPerformance as vi.MockedFunction<typeof useASINPerformance>
  const mockUseASINDataAvailability = useASINDataAvailability as vi.MockedFunction<typeof useASINDataAvailability>

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock for ASIN list
    mockUseASINList.mockReturnValue({
      data: {
        asins: [
          { asin: 'B08N5WRWNW', productTitle: 'Product 1', brand: 'Brand A' },
          { asin: 'B09N3ZNHTY', productTitle: 'Product 2', brand: 'Brand B' },
        ]
      },
      isLoading: false,
      error: null
    } as any)
    
    // Default mock for performance data
    mockUseASINPerformance.mockReturnValue({
      data: null,
      isLoading: false,
      error: null
    } as any)
    
    // Default mock for data availability
    mockUseASINDataAvailability.mockReturnValue({
      data: null,
      isLoading: false,
      error: null
    } as any)
  })

  it('should pass selected ASIN to DateRangePickerV2', async () => {
    render(<Dashboard />)
    
    // Open ASIN selector
    const asinInput = screen.getByPlaceholderText('Search or select an ASIN...')
    fireEvent.click(asinInput)
    
    // Select an ASIN
    const asinOption = await screen.findByText('B08N5WRWNW - Product 1')
    fireEvent.click(asinOption)
    
    // Verify ASIN is passed to data availability hook
    await waitFor(() => {
      expect(mockUseASINDataAvailability).toHaveBeenCalledWith('B08N5WRWNW')
    })
  })

  it('should update date range when ASIN with complete month data is selected', async () => {
    // Mock data availability for ASIN
    mockUseASINDataAvailability.mockImplementation((asin) => {
      if (asin === 'B08N5WRWNW') {
        return {
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
        } as any
      }
      return { data: null, isLoading: false, error: null } as any
    })

    render(<Dashboard />)
    
    // Open ASIN selector
    const asinInput = screen.getByPlaceholderText('Search or select an ASIN...')
    fireEvent.click(asinInput)
    
    // Select an ASIN
    const asinOption = await screen.findByText('B08N5WRWNW - Product 1')
    fireEvent.click(asinOption)
    
    // Wait for date range to update
    await waitFor(() => {
      // Check that performance API is called with the new date range
      expect(mockUseASINPerformance).toHaveBeenCalledWith(
        'B08N5WRWNW',
        '2025-07-01',
        '2025-07-31',
        undefined,
        undefined
      )
    })
  })

  it('should switch to month period type when complete month is available', async () => {
    // Mock data availability with complete month
    mockUseASINDataAvailability.mockImplementation((asin) => {
      if (asin === 'B08N5WRWNW') {
        return {
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
        } as any
      }
      return { data: null, isLoading: false, error: null } as any
    })

    render(<Dashboard />)
    
    // Initially should show Week
    expect(screen.getByRole('button', { name: 'Week', pressed: true })).toBeInTheDocument()
    
    // Open ASIN selector
    const asinInput = screen.getByPlaceholderText('Search or select an ASIN...')
    fireEvent.click(asinInput)
    
    // Select an ASIN
    const asinOption = await screen.findByText('B08N5WRWNW - Product 1')
    fireEvent.click(asinOption)
    
    // Should switch to Month period type
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Month', pressed: true })).toBeInTheDocument()
    })
  })

  it('should use fallback range when no complete month is available', async () => {
    // Mock data availability with only fallback range
    mockUseASINDataAvailability.mockImplementation((asin) => {
      if (asin === 'B09N3ZNHTY') {
        return {
          data: {
            mostRecentCompleteMonth: null,
            fallbackRange: {
              startDate: '2025-07-15',
              endDate: '2025-08-03'
            },
            summary: {
              totalRanges: 3,
              earliestDate: '2025-07-15',
              latestDate: '2025-08-03'
            }
          },
          isLoading: false,
          error: null
        } as any
      }
      return { data: null, isLoading: false, error: null } as any
    })

    render(<Dashboard />)
    
    // Open ASIN selector
    const asinInput = screen.getByPlaceholderText('Search or select an ASIN...')
    fireEvent.click(asinInput)
    
    // Select an ASIN
    const asinOption = await screen.findByText('B09N3ZNHTY - Product 2')
    fireEvent.click(asinOption)
    
    // Wait for date range to update with fallback range
    await waitFor(() => {
      expect(mockUseASINPerformance).toHaveBeenCalledWith(
        'B09N3ZNHTY',
        '2025-07-15',
        '2025-08-03',
        undefined,
        undefined
      )
    })
  })

  it('should show loading state while fetching ASIN data', async () => {
    // Mock loading state
    mockUseASINDataAvailability.mockImplementation((asin) => {
      if (asin === 'B08N5WRWNW') {
        return {
          data: null,
          isLoading: true,
          error: null
        } as any
      }
      return { data: null, isLoading: false, error: null } as any
    })

    render(<Dashboard />)
    
    // Open ASIN selector
    const asinInput = screen.getByPlaceholderText('Search or select an ASIN...')
    fireEvent.click(asinInput)
    
    // Select an ASIN
    const asinOption = await screen.findByText('B08N5WRWNW - Product 1')
    fireEvent.click(asinOption)
    
    // Should show loading indicator
    expect(screen.getByText('Loading ASIN data...')).toBeInTheDocument()
  })

  it('should update date range when switching between ASINs', async () => {
    // Mock different data for different ASINs
    mockUseASINDataAvailability.mockImplementation((asin) => {
      if (asin === 'B08N5WRWNW') {
        return {
          data: {
            mostRecentCompleteMonth: {
              year: 2025,
              month: 7,
              startDate: '2025-07-01',
              endDate: '2025-07-31'
            },
            fallbackRange: null,
            summary: { totalRanges: 10, earliestDate: '2024-08-18', latestDate: '2025-08-03' }
          },
          isLoading: false,
          error: null
        } as any
      } else if (asin === 'B09N3ZNHTY') {
        return {
          data: {
            mostRecentCompleteMonth: {
              year: 2025,
              month: 6,
              startDate: '2025-06-01',
              endDate: '2025-06-30'
            },
            fallbackRange: null,
            summary: { totalRanges: 8, earliestDate: '2024-09-01', latestDate: '2025-07-15' }
          },
          isLoading: false,
          error: null
        } as any
      }
      return { data: null, isLoading: false, error: null } as any
    })

    render(<Dashboard />)
    
    // Select first ASIN
    const asinInput = screen.getByPlaceholderText('Search or select an ASIN...')
    fireEvent.click(asinInput)
    
    const asinOption1 = await screen.findByText('B08N5WRWNW - Product 1')
    fireEvent.click(asinOption1)
    
    // Wait for first date range
    await waitFor(() => {
      expect(mockUseASINPerformance).toHaveBeenCalledWith(
        'B08N5WRWNW',
        '2025-07-01',
        '2025-07-31',
        undefined,
        undefined
      )
    })
    
    // Clear mock calls
    mockUseASINPerformance.mockClear()
    
    // Select second ASIN
    fireEvent.click(asinInput)
    const asinOption2 = await screen.findByText('B09N3ZNHTY - Product 2')
    fireEvent.click(asinOption2)
    
    // Wait for second date range
    await waitFor(() => {
      expect(mockUseASINPerformance).toHaveBeenCalledWith(
        'B09N3ZNHTY',
        '2025-06-01',
        '2025-06-30',
        undefined,
        undefined
      )
    })
  })
})