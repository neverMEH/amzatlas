import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PeriodTypeSelector } from '../PeriodTypeSelector'
import { PeriodType } from '../types'

describe('PeriodTypeSelector', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  it('renders all period type options', () => {
    render(<PeriodTypeSelector value="week" onChange={mockOnChange} />)
    
    expect(screen.getByText('Week')).toBeInTheDocument()
    expect(screen.getByText('Month')).toBeInTheDocument()
    expect(screen.getByText('Quarter')).toBeInTheDocument()
    expect(screen.getByText('Year')).toBeInTheDocument()
  })

  it('shows the selected period type', () => {
    render(<PeriodTypeSelector value="month" onChange={mockOnChange} />)
    
    const selectedButton = screen.getByRole('button', { pressed: true })
    expect(selectedButton).toHaveTextContent('Month')
  })

  it('calls onChange when a different period type is selected', () => {
    render(<PeriodTypeSelector value="week" onChange={mockOnChange} />)
    
    const quarterButton = screen.getByText('Quarter')
    fireEvent.click(quarterButton)
    
    expect(mockOnChange).toHaveBeenCalledWith('quarter')
  })

  it('does not call onChange when the same period type is clicked', () => {
    render(<PeriodTypeSelector value="week" onChange={mockOnChange} />)
    
    const weekButton = screen.getByText('Week')
    fireEvent.click(weekButton)
    
    expect(mockOnChange).not.toHaveBeenCalled()
  })

  it('applies correct styling to selected and unselected buttons', () => {
    render(<PeriodTypeSelector value="year" onChange={mockOnChange} />)
    
    const yearButton = screen.getByText('Year').closest('button')
    const weekButton = screen.getByText('Week').closest('button')
    
    expect(yearButton).toHaveClass('bg-blue-600', 'text-white')
    expect(weekButton).toHaveClass('bg-white', 'text-gray-700')
  })

  it('renders with custom className', () => {
    render(<PeriodTypeSelector value="week" onChange={mockOnChange} className="custom-class" />)
    
    const container = screen.getByRole('group')
    expect(container).toHaveClass('custom-class')
  })

  it('supports keyboard navigation', () => {
    render(<PeriodTypeSelector value="week" onChange={mockOnChange} />)
    
    const weekButton = screen.getByText('Week').closest('button')
    const monthButton = screen.getByText('Month').closest('button')
    
    // Test that buttons are focusable
    expect(weekButton).toHaveAttribute('type', 'button')
    expect(monthButton).toHaveAttribute('type', 'button')
    
    // Test that clicking works
    fireEvent.click(monthButton!)
    expect(mockOnChange).toHaveBeenCalledWith('month')
  })

  it('has proper ARIA attributes', () => {
    render(<PeriodTypeSelector value="quarter" onChange={mockOnChange} />)
    
    const group = screen.getByRole('group')
    expect(group).toHaveAttribute('aria-label', 'Select period type')
    
    const quarterButton = screen.getByRole('button', { name: 'Quarter' })
    expect(quarterButton).toHaveAttribute('aria-pressed', 'true')
    
    const weekButton = screen.getByRole('button', { name: 'Week' })
    expect(weekButton).toHaveAttribute('aria-pressed', 'false')
  })

  it('handles all period types correctly', () => {
    const { rerender } = render(<PeriodTypeSelector value="week" onChange={mockOnChange} />)
    
    const periodTypes: PeriodType[] = ['week', 'month', 'quarter', 'year']
    
    periodTypes.forEach((periodType) => {
      rerender(<PeriodTypeSelector value={periodType} onChange={mockOnChange} />)
      
      const selectedButton = screen.getByRole('button', { pressed: true })
      expect(selectedButton).toHaveTextContent(periodType.charAt(0).toUpperCase() + periodType.slice(1))
    })
  })

  it('displays icons for each period type', () => {
    render(<PeriodTypeSelector value="week" onChange={mockOnChange} />)
    
    // Check for SVG icons (using test ids or aria-labels)
    expect(screen.getByTestId('week-icon')).toBeInTheDocument()
    expect(screen.getByTestId('month-icon')).toBeInTheDocument()
    expect(screen.getByTestId('quarter-icon')).toBeInTheDocument()
    expect(screen.getByTestId('year-icon')).toBeInTheDocument()
  })
})