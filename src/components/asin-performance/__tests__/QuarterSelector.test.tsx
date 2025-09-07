import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { QuarterSelector } from '../calendars/QuarterSelector'
import { format, startOfQuarter, endOfQuarter } from 'date-fns'

describe('QuarterSelector', () => {
  const mockOnSelect = vi.fn()
  const currentYear = new Date().getFullYear()
  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1

  beforeEach(() => {
    mockOnSelect.mockClear()
  })

  const defaultProps = {
    selectedStart: format(startOfQuarter(new Date()), 'yyyy-MM-dd'),
    selectedEnd: format(endOfQuarter(new Date()), 'yyyy-MM-dd'),
    onSelect: mockOnSelect,
  }

  it('renders all four quarters', () => {
    render(<QuarterSelector {...defaultProps} />)
    
    expect(screen.getByText('Q1')).toBeInTheDocument()
    expect(screen.getByText('Q2')).toBeInTheDocument()
    expect(screen.getByText('Q3')).toBeInTheDocument()
    expect(screen.getByText('Q4')).toBeInTheDocument()
    
    // Also shows month ranges
    expect(screen.getByText('Jan - Mar')).toBeInTheDocument()
    expect(screen.getByText('Apr - Jun')).toBeInTheDocument()
    expect(screen.getByText('Jul - Sep')).toBeInTheDocument()
    expect(screen.getByText('Oct - Dec')).toBeInTheDocument()
  })

  it('highlights the selected quarter', () => {
    render(<QuarterSelector {...defaultProps} />)
    
    const selectedQuarterElement = screen.getByText(`Q${currentQuarter}`)
    expect(selectedQuarterElement.closest('button')).toHaveClass('bg-blue-600', 'text-white')
  })

  it('shows current year', () => {
    render(<QuarterSelector {...defaultProps} />)
    
    expect(screen.getByText(currentYear.toString())).toBeInTheDocument()
  })

  it('allows selecting a different quarter', () => {
    render(<QuarterSelector {...defaultProps} />)
    
    const q2Button = screen.getByText('Q2')
    fireEvent.click(q2Button)
    
    const q2Start = startOfQuarter(new Date(currentYear, 3, 1))
    const q2End = endOfQuarter(new Date(currentYear, 3, 1))
    
    expect(mockOnSelect).toHaveBeenCalledWith({
      startDate: format(q2Start, 'yyyy-MM-dd'),
      endDate: format(q2End, 'yyyy-MM-dd'),
    })
  })

  it('allows year navigation', () => {
    render(<QuarterSelector {...defaultProps} />)
    
    const prevYearButton = screen.getByLabelText('Previous year')
    const nextYearButton = screen.getByLabelText('Next year')
    
    // Navigate to previous year
    fireEvent.click(prevYearButton)
    expect(screen.getByText((currentYear - 1).toString())).toBeInTheDocument()
    
    // Navigate to next year
    fireEvent.click(nextYearButton)
    fireEvent.click(nextYearButton)
    expect(screen.getByText((currentYear + 1).toString())).toBeInTheDocument()
  })

  it('disables future quarters if maxDate is provided', () => {
    const maxDate = format(new Date(), 'yyyy-MM-dd')
    
    render(
      <QuarterSelector
        {...defaultProps}
        maxDate={maxDate}
      />
    )
    
    // Future quarters should be disabled
    const futureQuarter = currentQuarter === 4 ? 1 : currentQuarter + 1
    
    if (futureQuarter > currentQuarter) {
      const futureQuarterButton = screen.getByText(`Q${futureQuarter}`).closest('button')
      expect(futureQuarterButton).toBeDisabled()
    }
  })

  it('shows today button that returns to current quarter', () => {
    render(<QuarterSelector {...defaultProps} />)
    
    // Navigate away first
    const prevYearButton = screen.getByLabelText('Previous year')
    fireEvent.click(prevYearButton)
    
    // Click Today button
    const todayButton = screen.getByText('Today')
    fireEvent.click(todayButton)
    
    // Should return to current year and highlight current quarter
    expect(screen.getByText(currentYear.toString())).toBeInTheDocument()
    const currentQuarterElement = screen.getByText(`Q${currentQuarter}`)
    expect(currentQuarterElement.closest('button')).toHaveClass('bg-blue-600')
  })

  it('shows available data indicators', () => {
    const availableQuarters = [
      '2025-01-01', // Q1
      '2025-04-01', // Q2
    ]
    
    render(
      <QuarterSelector
        {...defaultProps}
        availableQuarters={availableQuarters}
      />
    )
    
    // Quarters with data should have indicators
    const q1Button = screen.getByText('Q1').closest('button')
    const q2Button = screen.getByText('Q2').closest('button')
    
    expect(q1Button?.querySelector('[data-available]')).toBeInTheDocument()
    expect(q2Button?.querySelector('[data-available]')).toBeInTheDocument()
  })

  it('displays quarter details on hover', () => {
    render(<QuarterSelector {...defaultProps} />)
    
    const q1Button = screen.getByText('Q1').closest('button')
    
    // Hover should show tooltip or additional info
    fireEvent.mouseEnter(q1Button!)
    
    // Could show exact date range
    expect(screen.getByText(/January 1 - March 31/)).toBeInTheDocument()
  })

  it('handles year input for quick navigation', () => {
    render(<QuarterSelector {...defaultProps} />)
    
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