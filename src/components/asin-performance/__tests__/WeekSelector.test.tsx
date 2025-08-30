import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WeekSelector } from '../calendars/WeekSelector'
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameWeek } from 'date-fns'

describe('WeekSelector', () => {
  const mockOnSelect = vi.fn()
  const today = new Date()
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 0 })
  const currentWeekEnd = endOfWeek(today, { weekStartsOn: 0 })

  beforeEach(() => {
    mockOnSelect.mockClear()
  })

  const defaultProps = {
    selectedStart: format(currentWeekStart, 'yyyy-MM-dd'),
    selectedEnd: format(currentWeekEnd, 'yyyy-MM-dd'),
    onSelect: mockOnSelect,
  }

  it('renders calendar with week view', () => {
    render(<WeekSelector {...defaultProps} />)
    
    expect(screen.getByRole('grid')).toBeInTheDocument()
    expect(screen.getByText('Sun')).toBeInTheDocument()
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Tue')).toBeInTheDocument()
    expect(screen.getByText('Wed')).toBeInTheDocument()
    expect(screen.getByText('Thu')).toBeInTheDocument()
    expect(screen.getByText('Fri')).toBeInTheDocument()
    expect(screen.getByText('Sat')).toBeInTheDocument()
  })

  it('highlights the selected week', () => {
    render(<WeekSelector {...defaultProps} />)
    
    // Get all buttons in the selected week
    const selectedWeekButtons = screen.getAllByRole('button').filter(button => {
      const dateAttr = button.getAttribute('data-date')
      if (!dateAttr) return false
      const buttonDate = new Date(dateAttr)
      return isSameWeek(buttonDate, currentWeekStart, { weekStartsOn: 0 })
    })
    
    // Verify all buttons in the selected week have the highlight class
    expect(selectedWeekButtons.length).toBe(7)
    selectedWeekButtons.forEach(button => {
      expect(button).toHaveClass('bg-blue-100')
    })
  })

  it('allows selecting a different week', () => {
    render(<WeekSelector {...defaultProps} />)
    
    // Find a button from next week
    const nextWeekStart = addWeeks(currentWeekStart, 1)
    const buttons = screen.getAllByRole('button').filter(button => {
      const dateAttr = button.getAttribute('data-date')
      if (!dateAttr) return false
      const buttonDate = new Date(dateAttr)
      return isSameWeek(buttonDate, nextWeekStart, { weekStartsOn: 0 })
    })
    
    if (buttons.length > 0) {
      fireEvent.click(buttons[0])
      
      expect(mockOnSelect).toHaveBeenCalledWith({
        startDate: format(startOfWeek(nextWeekStart, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
        endDate: format(endOfWeek(nextWeekStart, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
      })
    }
  })

  it('shows week numbers', () => {
    render(<WeekSelector {...defaultProps} />)
    
    // Check for week number column
    expect(screen.getByText('Wk')).toBeInTheDocument()
  })

  it('allows navigation between months', () => {
    render(<WeekSelector {...defaultProps} />)
    
    const prevButton = screen.getByLabelText('Previous month')
    const nextButton = screen.getByLabelText('Next month')
    
    expect(prevButton).toBeInTheDocument()
    expect(nextButton).toBeInTheDocument()
    
    // Get current month display
    const currentMonthText = format(today, 'MMMM yyyy')
    expect(screen.getByText(currentMonthText)).toBeInTheDocument()
    
    // Navigate to previous month
    fireEvent.click(prevButton)
    
    // The month should have changed
    expect(screen.queryByText(currentMonthText)).not.toBeInTheDocument()
  })

  it('highlights current week when Today button is clicked', () => {
    render(<WeekSelector {...defaultProps} />)
    
    // Navigate away first
    const prevButton = screen.getByLabelText('Previous month')
    fireEvent.click(prevButton)
    
    // Click Today button
    const todayButton = screen.getByText('Today')
    fireEvent.click(todayButton)
    
    // Should navigate back to current month
    expect(screen.getByText(format(today, 'MMMM yyyy'))).toBeInTheDocument()
  })

  it('shows week boundaries with different colors', () => {
    render(<WeekSelector {...defaultProps} />)
    
    // Check that buttons have week data attributes
    const buttonsWithWeekData = screen.getAllByRole('button').filter(button => 
      button.hasAttribute('data-week')
    )
    
    expect(buttonsWithWeekData.length).toBeGreaterThan(0)
  })

  it('handles edge cases for partial weeks at month boundaries', () => {
    // Set selected date to the last week of a month that spans into next month
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    const lastWeekStart = startOfWeek(lastDayOfMonth, { weekStartsOn: 0 })
    
    render(
      <WeekSelector
        selectedStart={format(lastWeekStart, 'yyyy-MM-dd')}
        selectedEnd={format(endOfWeek(lastDayOfMonth, { weekStartsOn: 0 }), 'yyyy-MM-dd')}
        onSelect={mockOnSelect}
      />
    )
    
    // The week should be highlighted even if it spans two months
    const selectedWeekButtons = screen.getAllByRole('button').filter(button => {
      const dateAttr = button.getAttribute('data-date')
      if (!dateAttr) return false
      const buttonDate = new Date(dateAttr)
      return isSameWeek(buttonDate, lastWeekStart, { weekStartsOn: 0 })
    })
    
    expect(selectedWeekButtons.length).toBeGreaterThan(0)
    selectedWeekButtons.forEach(button => {
      expect(button).toHaveClass('bg-blue-100')
    })
  })

  it('disables future weeks if maxDate is provided', () => {
    const maxDate = format(today, 'yyyy-MM-dd')
    
    render(
      <WeekSelector
        {...defaultProps}
        maxDate={maxDate}
      />
    )
    
    // Future week dates should be disabled
    const futureWeekStart = addWeeks(today, 2)
    const futureWeekDay = futureWeekStart.getDate()
    
    const futureDayElements = screen.getAllByText(futureWeekDay.toString())
    const futureDayElement = futureDayElements.find(el => {
      const button = el.closest('button')
      return button && new Date(button.getAttribute('data-date') || '') > new Date(maxDate)
    })
    
    if (futureDayElement) {
      expect(futureDayElement.closest('button')).toBeDisabled()
    }
  })

  it('shows available data indicator for weeks with data', () => {
    const availableWeeks = [
      format(currentWeekStart, 'yyyy-MM-dd'),
      format(subWeeks(currentWeekStart, 1), 'yyyy-MM-dd'),
    ]
    
    render(
      <WeekSelector
        {...defaultProps}
        availableWeeks={availableWeeks}
      />
    )
    
    // Weeks with data should have indicators on at least one day
    availableWeeks.forEach(weekStart => {
      const weekStartDate = new Date(weekStart)
      
      // Find buttons in the week with available data
      const buttonsInWeek = screen.getAllByRole('button').filter(button => {
        const dateAttr = button.getAttribute('data-date')
        if (!dateAttr) return false
        const buttonDate = new Date(dateAttr)
        return isSameWeek(buttonDate, weekStartDate, { weekStartsOn: 0 })
      })
      
      // At least one button in the week should have an available indicator
      const hasIndicator = buttonsInWeek.some(button => 
        button.querySelector('[data-available]')
      )
      expect(hasIndicator).toBe(true)
    })
  })
})