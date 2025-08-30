import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DateRangePickerV2 } from '../DateRangePickerV2'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns'

describe('DateRangePickerV2', () => {
  const mockOnChange = vi.fn()
  const mockOnCompareChange = vi.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
    mockOnCompareChange.mockClear()
  })

  const defaultProps = {
    startDate: '2025-08-01',
    endDate: '2025-08-07',
    onChange: mockOnChange,
  }

  describe('Period Type Selection', () => {
    it('renders with period type selector', () => {
      render(<DateRangePickerV2 {...defaultProps} />)
      
      expect(screen.getByRole('group', { name: 'Select period type' })).toBeInTheDocument()
      expect(screen.getByText('Week')).toBeInTheDocument()
      expect(screen.getByText('Month')).toBeInTheDocument()
      expect(screen.getByText('Quarter')).toBeInTheDocument()
      expect(screen.getByText('Year')).toBeInTheDocument()
    })

    it('defaults to week period type', () => {
      render(<DateRangePickerV2 {...defaultProps} />)
      
      const weekButton = screen.getByRole('button', { name: 'Week', pressed: true })
      expect(weekButton).toBeInTheDocument()
    })

    it('changes period type when clicked', () => {
      render(<DateRangePickerV2 {...defaultProps} />)
      
      const monthButton = screen.getByText('Month')
      fireEvent.click(monthButton)
      
      expect(screen.getByRole('button', { name: 'Month', pressed: true })).toBeInTheDocument()
    })
  })

  describe('Calendar State Reset', () => {
    it('resets date range to current week when switching to week', async () => {
      render(<DateRangePickerV2 {...defaultProps} />)
      
      // Switch to month first
      fireEvent.click(screen.getByText('Month'))
      
      // Then back to week
      fireEvent.click(screen.getByText('Week'))
      
      await waitFor(() => {
        const today = new Date()
        const weekStart = format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd')
        const weekEnd = format(endOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd')
        
        expect(mockOnChange).toHaveBeenCalledWith({
          startDate: weekStart,
          endDate: weekEnd,
        })
      })
    })

    it('resets date range to current month when switching to month', async () => {
      render(<DateRangePickerV2 {...defaultProps} />)
      
      fireEvent.click(screen.getByText('Month'))
      
      await waitFor(() => {
        const today = new Date()
        const monthStart = format(startOfMonth(today), 'yyyy-MM-dd')
        const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd')
        
        expect(mockOnChange).toHaveBeenCalledWith({
          startDate: monthStart,
          endDate: monthEnd,
        })
      })
    })

    it('resets date range to current quarter when switching to quarter', async () => {
      render(<DateRangePickerV2 {...defaultProps} />)
      
      fireEvent.click(screen.getByText('Quarter'))
      
      await waitFor(() => {
        const today = new Date()
        const quarterStart = format(startOfQuarter(today), 'yyyy-MM-dd')
        const quarterEnd = format(endOfQuarter(today), 'yyyy-MM-dd')
        
        expect(mockOnChange).toHaveBeenCalledWith({
          startDate: quarterStart,
          endDate: quarterEnd,
        })
      })
    })

    it('resets date range to current year when switching to year', async () => {
      render(<DateRangePickerV2 {...defaultProps} />)
      
      fireEvent.click(screen.getByText('Year'))
      
      await waitFor(() => {
        const today = new Date()
        const yearStart = format(startOfYear(today), 'yyyy-MM-dd')
        const yearEnd = format(endOfYear(today), 'yyyy-MM-dd')
        
        expect(mockOnChange).toHaveBeenCalledWith({
          startDate: yearStart,
          endDate: yearEnd,
        })
      })
    })
  })

  describe('Calendar Display', () => {
    it('shows week selector when period type is week', () => {
      render(<DateRangePickerV2 {...defaultProps} />)
      
      const calendarButton = screen.getByTestId('calendar-trigger')
      fireEvent.click(calendarButton)
      
      expect(screen.getByTestId('week-selector')).toBeInTheDocument()
    })

    it('shows month selector when period type is month', () => {
      render(<DateRangePickerV2 {...defaultProps} />)
      
      fireEvent.click(screen.getByText('Month'))
      
      const calendarButton = screen.getByTestId('calendar-trigger')
      fireEvent.click(calendarButton)
      
      expect(screen.getByTestId('month-selector')).toBeInTheDocument()
    })

    it('shows quarter selector when period type is quarter', () => {
      render(<DateRangePickerV2 {...defaultProps} />)
      
      fireEvent.click(screen.getByText('Quarter'))
      
      const calendarButton = screen.getByTestId('calendar-trigger')
      fireEvent.click(calendarButton)
      
      expect(screen.getByTestId('quarter-selector')).toBeInTheDocument()
    })

    it('shows year selector when period type is year', () => {
      render(<DateRangePickerV2 {...defaultProps} />)
      
      fireEvent.click(screen.getByText('Year'))
      
      const calendarButton = screen.getByTestId('calendar-trigger')
      fireEvent.click(calendarButton)
      
      expect(screen.getByTestId('year-selector')).toBeInTheDocument()
    })
  })

  describe('Comparison Period', () => {
    it('defaults comparison to same prior period', () => {
      render(
        <DateRangePickerV2
          {...defaultProps}
          showComparison={true}
          onCompareChange={mockOnCompareChange}
        />
      )
      
      const compareCheckbox = screen.getByRole('checkbox', { name: 'Enable comparison' })
      fireEvent.click(compareCheckbox)
      
      // For a week period, comparison should default to previous week
      expect(mockOnCompareChange).toHaveBeenCalledWith({
        startDate: '2025-07-25',
        endDate: '2025-07-31',
        enabled: true,
      })
    })

    it('updates comparison when period type changes', async () => {
      render(
        <DateRangePickerV2
          {...defaultProps}
          showComparison={true}
          compareStartDate="2025-07-25"
          compareEndDate="2025-07-31"
          onCompareChange={mockOnCompareChange}
        />
      )
      
      // Enable comparison
      const compareCheckbox = screen.getByRole('checkbox', { name: 'Enable comparison' })
      fireEvent.click(compareCheckbox)
      
      // Change to month
      fireEvent.click(screen.getByText('Month'))
      
      await waitFor(() => {
        // Comparison should update to previous month
        const lastCall = mockOnCompareChange.mock.calls[mockOnCompareChange.mock.calls.length - 1][0]
        expect(lastCall.enabled).toBe(true)
        // The dates should be for the previous month
      })
    })
  })

  describe('Custom Date Range', () => {
    it('shows custom range option', () => {
      render(<DateRangePickerV2 {...defaultProps} />)
      
      const calendarButton = screen.getByTestId('calendar-trigger')
      fireEvent.click(calendarButton)
      
      expect(screen.getByText('Custom Range')).toBeInTheDocument()
    })

    it('allows selecting custom week range', () => {
      render(<DateRangePickerV2 {...defaultProps} />)
      
      const calendarButton = screen.getByTestId('calendar-trigger')
      fireEvent.click(calendarButton)
      
      fireEvent.click(screen.getByText('Custom Range'))
      
      const weeksInput = screen.getByLabelText('Number of weeks')
      fireEvent.change(weeksInput, { target: { value: '10' } })
      
      fireEvent.click(screen.getByText('Apply'))
      
      // Should call onChange with last 10 weeks
      expect(mockOnChange).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<DateRangePickerV2 {...defaultProps} />)
      
      expect(screen.getByRole('group', { name: 'Select period type' })).toBeInTheDocument()
      expect(screen.getByLabelText('Select date range')).toBeInTheDocument()
    })

    it('supports keyboard navigation', () => {
      render(<DateRangePickerV2 {...defaultProps} />)
      
      const calendarButton = screen.getByTestId('calendar-trigger')
      calendarButton.focus()
      
      fireEvent.keyDown(calendarButton, { key: 'Enter' })
      
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })
})