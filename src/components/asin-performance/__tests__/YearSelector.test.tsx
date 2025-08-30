import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { YearSelector } from '../calendars/YearSelector'
import { format, startOfYear, endOfYear } from 'date-fns'

describe('YearSelector', () => {
  const mockOnSelect = vi.fn()
  const currentYear = new Date().getFullYear()

  beforeEach(() => {
    mockOnSelect.mockClear()
  })

  const defaultProps = {
    selectedStart: format(startOfYear(new Date()), 'yyyy-MM-dd'),
    selectedEnd: format(endOfYear(new Date()), 'yyyy-MM-dd'),
    onSelect: mockOnSelect,
  }

  it('renders year grid', () => {
    render(<YearSelector {...defaultProps} />)
    
    // Should show a range of years around the current year
    const yearRange = 12 // Show 12 years at a time
    const startYear = currentYear - 5
    
    for (let i = 0; i < yearRange; i++) {
      expect(screen.getByText((startYear + i).toString())).toBeInTheDocument()
    }
  })

  it('highlights the selected year', () => {
    render(<YearSelector {...defaultProps} />)
    
    const selectedYearElement = screen.getByText(currentYear.toString())
    expect(selectedYearElement.closest('button')).toHaveClass('bg-blue-600', 'text-white')
  })

  it('allows selecting a different year', () => {
    render(<YearSelector {...defaultProps} />)
    
    const targetYear = currentYear - 2
    const yearButton = screen.getByText(targetYear.toString())
    fireEvent.click(yearButton)
    
    const yearStart = startOfYear(new Date(targetYear, 0, 1))
    const yearEnd = endOfYear(new Date(targetYear, 0, 1))
    
    expect(mockOnSelect).toHaveBeenCalledWith({
      startDate: format(yearStart, 'yyyy-MM-dd'),
      endDate: format(yearEnd, 'yyyy-MM-dd'),
    })
  })

  it('allows decade navigation', () => {
    render(<YearSelector {...defaultProps} />)
    
    const prevDecadeButton = screen.getByLabelText('Previous decade')
    const nextDecadeButton = screen.getByLabelText('Next decade')
    
    expect(prevDecadeButton).toBeInTheDocument()
    expect(nextDecadeButton).toBeInTheDocument()
    
    // Navigate to previous decade
    fireEvent.click(prevDecadeButton)
    expect(screen.getByText((currentYear - 10).toString())).toBeInTheDocument()
    
    // Navigate to next decade
    fireEvent.click(nextDecadeButton)
    fireEvent.click(nextDecadeButton)
    expect(screen.getByText((currentYear + 10).toString())).toBeInTheDocument()
  })

  it('shows decade range in header', () => {
    render(<YearSelector {...defaultProps} />)
    
    const startYear = currentYear - 5
    const endYear = currentYear + 6
    expect(screen.getByText(`${startYear} - ${endYear}`)).toBeInTheDocument()
  })

  it('disables future years if maxDate is provided', () => {
    const maxDate = format(new Date(), 'yyyy-MM-dd')
    
    render(
      <YearSelector
        {...defaultProps}
        maxDate={maxDate}
      />
    )
    
    // Future years should be disabled
    const futureYear = currentYear + 1
    const futureYearButton = screen.getByText(futureYear.toString()).closest('button')
    expect(futureYearButton).toBeDisabled()
  })

  it('shows today button that returns to current year', () => {
    render(<YearSelector {...defaultProps} />)
    
    // Navigate away first
    const prevDecadeButton = screen.getByLabelText('Previous decade')
    fireEvent.click(prevDecadeButton)
    
    // Click Today button
    const todayButton = screen.getByText('Today')
    fireEvent.click(todayButton)
    
    // Should return to current decade
    expect(screen.getByText(currentYear.toString())).toBeInTheDocument()
    const currentYearElement = screen.getByText(currentYear.toString())
    expect(currentYearElement.closest('button')).toHaveClass('bg-blue-600')
  })

  it('shows available data indicators', () => {
    const availableYears = [
      '2023-01-01',
      '2024-01-01',
      '2025-01-01',
    ]
    
    render(
      <YearSelector
        {...defaultProps}
        availableYears={availableYears}
      />
    )
    
    // Years with data should have indicators
    const year2023Button = screen.getByText('2023').closest('button')
    const year2024Button = screen.getByText('2024').closest('button')
    const year2025Button = screen.getByText('2025').closest('button')
    
    expect(year2023Button?.querySelector('[data-available]')).toBeInTheDocument()
    expect(year2024Button?.querySelector('[data-available]')).toBeInTheDocument()
    expect(year2025Button?.querySelector('[data-available]')).toBeInTheDocument()
  })

  it('allows direct year input', () => {
    render(<YearSelector {...defaultProps} />)
    
    const inputButton = screen.getByLabelText('Enter year directly')
    fireEvent.click(inputButton)
    
    // Should show year input
    const yearInput = screen.getByRole('spinbutton')
    expect(yearInput).toBeInTheDocument()
    
    // Enter a specific year
    fireEvent.change(yearInput, { target: { value: '2020' } })
    fireEvent.keyDown(yearInput, { key: 'Enter' })
    
    // Should navigate to that decade
    expect(screen.getByText('2020')).toBeInTheDocument()
  })

  it('highlights current year with special indicator', () => {
    render(<YearSelector {...defaultProps} />)
    
    const currentYearButton = screen.getByText(currentYear.toString()).closest('button')
    
    // Should have a special indicator for "current year"
    expect(currentYearButton?.querySelector('[data-current]')).toBeInTheDocument()
  })
})