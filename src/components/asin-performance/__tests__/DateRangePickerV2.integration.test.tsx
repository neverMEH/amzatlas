import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DateRangePickerV2 } from '../DateRangePickerV2'
import { PeriodTypeSelector } from '../PeriodTypeSelector'
import { format, startOfWeek, endOfWeek } from 'date-fns'

// Mock the API hook to prevent ASIN data fetching during tests
vi.mock('@/lib/api/asin-performance', () => ({
  useASINDataAvailability: vi.fn(() => ({ data: null, isLoading: false }))
}))

describe('DateRangePickerV2 Integration Tests', () => {
  const mockOnChange = vi.fn()
  const mockOnCompareChange = vi.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
    mockOnCompareChange.mockClear()
  })

  describe('Period Type Integration', () => {
    it('integrates PeriodTypeSelector with date range selection', () => {
      render(
        <DateRangePickerV2
          startDate="2025-08-01"
          endDate="2025-08-07"
          onChange={mockOnChange}
        />
      )

      // Verify PeriodTypeSelector is rendered
      expect(screen.getByRole('group', { name: 'Select period type' })).toBeInTheDocument()
      
      // Verify default selection is week
      expect(screen.getByRole('button', { name: 'Week', pressed: true })).toBeInTheDocument()
    })

    it('updates date range when switching period types', async () => {
      render(
        <DateRangePickerV2
          startDate="2025-08-01"
          endDate="2025-08-07"
          onChange={mockOnChange}
        />
      )

      // Switch to month
      fireEvent.click(screen.getByRole('button', { name: 'Month' }))

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          startDate: expect.stringMatching(/^\d{4}-\d{2}-01$/),
          endDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        })
      })
    })

    it('maintains period type state across re-renders', () => {
      const { rerender } = render(
        <DateRangePickerV2
          startDate="2025-08-01"
          endDate="2025-08-07"
          onChange={mockOnChange}
        />
      )

      // Switch to quarter
      fireEvent.click(screen.getByRole('button', { name: 'Quarter' }))
      
      // Verify quarter is selected
      expect(screen.getByRole('button', { name: 'Quarter', pressed: true })).toBeInTheDocument()

      // Re-render with new props
      rerender(
        <DateRangePickerV2
          startDate="2025-07-01"
          endDate="2025-09-30"
          onChange={mockOnChange}
        />
      )

      // Verify quarter is still selected
      expect(screen.getByRole('button', { name: 'Quarter', pressed: true })).toBeInTheDocument()
    })
  })

  describe('Calendar Display Integration', () => {
    it('shows correct calendar based on period type', async () => {
      render(
        <DateRangePickerV2
          startDate="2025-08-01"
          endDate="2025-08-07"
          onChange={mockOnChange}
        />
      )

      // Open calendar
      const calendarButton = screen.getByTestId('calendar-trigger')
      fireEvent.click(calendarButton)

      // Verify week selector is shown for week period
      expect(screen.getByTestId('week-selector')).toBeInTheDocument()

      // Close calendar
      fireEvent.click(calendarButton)

      // Switch to month
      fireEvent.click(screen.getByRole('button', { name: 'Month' }))

      // Open calendar again
      fireEvent.click(calendarButton)

      // Verify month selector is shown
      await waitFor(() => {
        expect(screen.getByTestId('month-selector')).toBeInTheDocument()
      })
    })
  })

  describe('Comparison Period Integration', () => {
    it('updates comparison period when period type changes', async () => {
      render(
        <DateRangePickerV2
          startDate="2025-08-01"
          endDate="2025-08-07"
          onChange={mockOnChange}
          showComparison={true}
          onCompareChange={mockOnCompareChange}
        />
      )

      // Enable comparison
      const compareCheckbox = screen.getByRole('checkbox', { name: 'Enable comparison' })
      fireEvent.click(compareCheckbox)

      // Verify comparison was set for week
      expect(mockOnCompareChange).toHaveBeenCalledWith({
        startDate: expect.any(String),
        endDate: expect.any(String),
        enabled: true,
      })

      // Switch to month
      fireEvent.click(screen.getByRole('button', { name: 'Month' }))

      await waitFor(() => {
        // Verify comparison was updated for month
        const lastCall = mockOnCompareChange.mock.calls[mockOnCompareChange.mock.calls.length - 1][0]
        expect(lastCall.enabled).toBe(true)
        expect(lastCall.startDate).toMatch(/^\d{4}-\d{2}-01$/) // Month should start on the 1st
      })
    })
  })

  describe('Custom Range Integration', () => {
    it('allows custom range selection in week mode', async () => {
      render(
        <DateRangePickerV2
          startDate="2025-08-01"
          endDate="2025-08-07"
          onChange={mockOnChange}
        />
      )

      // Select custom period type
      fireEvent.click(screen.getByText('Custom'))
      
      // Open calendar
      fireEvent.click(screen.getByTestId('calendar-trigger'))

      // Verify custom date range selector appears
      expect(screen.getByTestId('custom-selector')).toBeInTheDocument()

      // Select a preset option
      fireEvent.click(screen.getByText('Last 4 weeks'))

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
        const call = mockOnChange.mock.calls[0][0]
        // Verify it's a 4-week range
        const start = new Date(call.startDate)
        const end = new Date(call.endDate)
        const weeksDiff = Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))
        expect(weeksDiff).toBeGreaterThanOrEqual(3) // Allow for partial weeks
        expect(weeksDiff).toBeLessThanOrEqual(5)
      })
    })
  })

  describe('Display Text Integration', () => {
    it('shows correct display text for each period type', () => {
      const { rerender } = render(
        <DateRangePickerV2
          startDate="2025-08-03"
          endDate="2025-08-09"
          onChange={mockOnChange}
        />
      )

      // Check week display
      expect(screen.getByText(/Week \d+, 2025/)).toBeInTheDocument()

      // Switch to month
      fireEvent.click(screen.getByRole('button', { name: 'Month' }))
      
      rerender(
        <DateRangePickerV2
          startDate="2025-08-01"
          endDate="2025-08-31"
          onChange={mockOnChange}
        />
      )

      // Check month display
      expect(screen.getByText('August 2025')).toBeInTheDocument()

      // Switch to quarter
      fireEvent.click(screen.getByRole('button', { name: 'Quarter' }))
      
      rerender(
        <DateRangePickerV2
          startDate="2025-07-01"
          endDate="2025-09-30"
          onChange={mockOnChange}
        />
      )

      // Check quarter display
      expect(screen.getByText('Q3 2025')).toBeInTheDocument()

      // Switch to year
      fireEvent.click(screen.getByRole('button', { name: 'Year' }))
      
      rerender(
        <DateRangePickerV2
          startDate="2025-01-01"
          endDate="2025-12-31"
          onChange={mockOnChange}
        />
      )

      // Check year display
      expect(screen.getByText('2025')).toBeInTheDocument()
    })
  })
})