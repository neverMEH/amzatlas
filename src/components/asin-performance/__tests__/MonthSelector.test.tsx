import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MonthSelector } from '../calendars/MonthSelector'
import { format, startOfMonth, endOfMonth } from 'date-fns'

describe('MonthSelector', () => {
  const mockOnSelect = vi.fn()
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()

  beforeEach(() => {
    mockOnSelect.mockClear()
  })

  const defaultProps = {
    selectedStart: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    selectedEnd: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    onSelect: mockOnSelect,
  }

  it('renders month grid with all 12 months', () => {
    render(<MonthSelector {...defaultProps} />)
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    months.forEach(month => {
      expect(screen.getByText(month)).toBeInTheDocument()
    })
  })

  it('highlights the selected month', () => {
    render(<MonthSelector {...defaultProps} />)
    
    const selectedMonthName = format(new Date(), 'MMM')
    const selectedMonthElement = screen.getByText(selectedMonthName)
    expect(selectedMonthElement.closest('button')).toHaveClass('bg-blue-600', 'text-white')
  })

  it('shows current year', () => {
    render(<MonthSelector {...defaultProps} />)
    
    expect(screen.getByText(currentYear.toString())).toBeInTheDocument()
  })

  it('allows selecting a different month', () => {
    render(<MonthSelector {...defaultProps} />)
    
    const marchButton = screen.getByText('Mar')
    fireEvent.click(marchButton)
    
    const marchStart = startOfMonth(new Date(currentYear, 2, 1))
    const marchEnd = endOfMonth(new Date(currentYear, 2, 1))
    
    expect(mockOnSelect).toHaveBeenCalledWith({
      startDate: format(marchStart, 'yyyy-MM-dd'),
      endDate: format(marchEnd, 'yyyy-MM-dd'),
    })
  })

  it('allows year navigation', () => {
    render(<MonthSelector {...defaultProps} />)
    
    const prevYearButton = screen.getByLabelText('Previous year')
    const nextYearButton = screen.getByLabelText('Next year')
    
    expect(prevYearButton).toBeInTheDocument()
    expect(nextYearButton).toBeInTheDocument()
    
    // Navigate to previous year
    fireEvent.click(prevYearButton)
    expect(screen.getByText((currentYear - 1).toString())).toBeInTheDocument()
    
    // Navigate to next year
    fireEvent.click(nextYearButton)
    fireEvent.click(nextYearButton)
    expect(screen.getByText((currentYear + 1).toString())).toBeInTheDocument()
  })

  it('disables future months if maxDate is provided', () => {
    const maxDate = format(new Date(), 'yyyy-MM-dd')
    
    render(
      <MonthSelector
        {...defaultProps}
        maxDate={maxDate}
      />
    )
    
    // Future months should be disabled
    const futureMonthIndex = (currentMonth + 2) % 12
    const futureMonthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][futureMonthIndex]
    
    if (futureMonthIndex > currentMonth) {
      const futureMonthButton = screen.getByText(futureMonthName).closest('button')
      expect(futureMonthButton).toBeDisabled()
    }
  })

  it('shows today button that returns to current month', () => {
    render(<MonthSelector {...defaultProps} />)
    
    // Navigate away first
    const prevYearButton = screen.getByLabelText('Previous year')
    fireEvent.click(prevYearButton)
    
    // Click Today button
    const todayButton = screen.getByText('Today')
    fireEvent.click(todayButton)
    
    // Should return to current year
    expect(screen.getByText(currentYear.toString())).toBeInTheDocument()
  })

  it('shows available data indicators', () => {
    const availableMonths = [
      '2025-01-01',
      '2025-02-01',
      '2025-03-01',
    ]
    
    render(
      <MonthSelector
        {...defaultProps}
        availableMonths={availableMonths}
      />
    )
    
    // Months with data should have indicators
    const janButton = screen.getByText('Jan').closest('button')
    const febButton = screen.getByText('Feb').closest('button')
    const marButton = screen.getByText('Mar').closest('button')
    
    expect(janButton?.querySelector('[data-available]')).toBeInTheDocument()
    expect(febButton?.querySelector('[data-available]')).toBeInTheDocument()
    expect(marButton?.querySelector('[data-available]')).toBeInTheDocument()
  })

  it('handles year input for quick navigation', () => {
    render(<MonthSelector {...defaultProps} />)
    
    const yearDisplay = screen.getByText(currentYear.toString())
    fireEvent.click(yearDisplay)
    
    // Should show year input
    const yearInput = screen.getByRole('spinbutton')
    expect(yearInput).toBeInTheDocument()
    
    // Change year
    fireEvent.change(yearInput, { target: { value: '2023' } })
    fireEvent.keyDown(yearInput, { key: 'Enter' })
    
    // Should navigate to 2023
    expect(screen.getByText('2023')).toBeInTheDocument()
  })
})