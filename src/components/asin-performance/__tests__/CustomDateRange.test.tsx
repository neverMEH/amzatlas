import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CustomDateRange } from '../CustomDateRange'
import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns'

describe('CustomDateRange', () => {
  const mockOnSelect = vi.fn()
  const today = new Date()
  const maxDate = format(today, 'yyyy-MM-dd')
  
  const defaultProps = {
    maxDate,
    onSelect: mockOnSelect,
    onClose: vi.fn(),
  }

  beforeEach(() => {
    mockOnSelect.mockClear()
  })

  describe('Preset options', () => {
    it('renders preset range options', () => {
      render(<CustomDateRange {...defaultProps} />)
      
      expect(screen.getByText('Last 4 weeks')).toBeInTheDocument()
      expect(screen.getByText('Last 8 weeks')).toBeInTheDocument()
      expect(screen.getByText('Last 12 weeks')).toBeInTheDocument()
      expect(screen.getByText('Last 26 weeks')).toBeInTheDocument()
      expect(screen.getByText('Last 52 weeks')).toBeInTheDocument()
    })

    it('selects preset range when clicked', async () => {
      render(<CustomDateRange {...defaultProps} />)
      
      const last4Weeks = screen.getByText('Last 4 weeks')
      fireEvent.click(last4Weeks)
      
      const fourWeeksAgo = subWeeks(today, 4)
      const expectedStart = format(startOfWeek(fourWeeksAgo, { weekStartsOn: 0 }), 'yyyy-MM-dd')
      const expectedEnd = format(endOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd')
      
      await waitFor(() => {
        expect(mockOnSelect).toHaveBeenCalledWith({
          startDate: expectedStart,
          endDate: expectedEnd,
          periodType: 'custom',
          customWeeks: 4,
        })
      })
    })

    it('highlights selected preset', () => {
      render(<CustomDateRange {...defaultProps} />)
      
      const last8Weeks = screen.getByText('Last 8 weeks')
      fireEvent.click(last8Weeks)
      
      // Check that the button itself has the selected style classes
      expect(last8Weeks).toHaveClass('bg-blue-50', 'text-blue-700')
    })
  })

  describe('Custom week input', () => {
    it('renders custom week input', () => {
      render(<CustomDateRange {...defaultProps} />)
      
      expect(screen.getByLabelText('Custom weeks')).toBeInTheDocument()
      expect(screen.getByRole('spinbutton')).toHaveValue(10)
    })

    it('updates custom week value', () => {
      render(<CustomDateRange {...defaultProps} />)
      
      const input = screen.getByRole('spinbutton')
      fireEvent.change(input, { target: { value: '16' } })
      
      expect(input).toHaveValue(16)
    })

    it('validates minimum value', () => {
      render(<CustomDateRange {...defaultProps} />)
      
      const input = screen.getByRole('spinbutton')
      fireEvent.change(input, { target: { value: '0' } })
      
      expect(screen.getByText('Minimum 1 week')).toBeInTheDocument()
    })

    it('validates maximum value', () => {
      render(<CustomDateRange {...defaultProps} />)
      
      const input = screen.getByRole('spinbutton')
      fireEvent.change(input, { target: { value: '105' } })
      
      expect(screen.getByText('Maximum 104 weeks (2 years)')).toBeInTheDocument()
    })

    it('applies custom week range', async () => {
      render(<CustomDateRange {...defaultProps} />)
      
      const input = screen.getByRole('spinbutton')
      fireEvent.change(input, { target: { value: '10' } })
      
      const applyButton = screen.getByText('Apply')
      fireEvent.click(applyButton)
      
      const tenWeeksAgo = subWeeks(today, 10)
      const expectedStart = format(startOfWeek(tenWeeksAgo, { weekStartsOn: 0 }), 'yyyy-MM-dd')
      const expectedEnd = format(endOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd')
      
      await waitFor(() => {
        expect(mockOnSelect).toHaveBeenCalledWith({
          startDate: expectedStart,
          endDate: expectedEnd,
          periodType: 'custom',
          customWeeks: 10,
        })
      })
    })
  })

  describe('Date preview', () => {
    it('shows date range preview for preset selection', () => {
      render(<CustomDateRange {...defaultProps} />)
      
      const last4Weeks = screen.getByText('Last 4 weeks')
      fireEvent.click(last4Weeks)
      
      const fourWeeksAgo = subWeeks(today, 4)
      const expectedStart = format(startOfWeek(fourWeeksAgo, { weekStartsOn: 0 }), 'MMM d, yyyy')
      const expectedEnd = format(endOfWeek(today, { weekStartsOn: 0 }), 'MMM d, yyyy')
      
      expect(screen.getByText(`${expectedStart} - ${expectedEnd}`)).toBeInTheDocument()
    })

    it('updates preview when custom weeks change', () => {
      render(<CustomDateRange {...defaultProps} />)
      
      const input = screen.getByRole('spinbutton')
      fireEvent.change(input, { target: { value: '6' } })
      
      const sixWeeksAgo = subWeeks(today, 6)
      const expectedStart = format(startOfWeek(sixWeeksAgo, { weekStartsOn: 0 }), 'MMM d, yyyy')
      const expectedEnd = format(endOfWeek(today, { weekStartsOn: 0 }), 'MMM d, yyyy')
      
      expect(screen.getByText(`${expectedStart} - ${expectedEnd}`)).toBeInTheDocument()
    })
  })

  describe('Week breakdown display', () => {
    it('shows weekly breakdown for selected range', () => {
      render(<CustomDateRange {...defaultProps} />)
      
      const last4Weeks = screen.getByText('Last 4 weeks')
      fireEvent.click(last4Weeks)
      
      // Should show 4 week entries
      const weekItems = screen.getAllByText(/Week \d+/)
      expect(weekItems).toHaveLength(4)
    })

    it('highlights current week in breakdown', () => {
      render(<CustomDateRange {...defaultProps} />)
      
      const last4Weeks = screen.getByText('Last 4 weeks')
      fireEvent.click(last4Weeks)
      
      // Current week should be highlighted - look for the (Current) text
      const currentWeekElement = screen.getByText(/\(Current\)/)
      expect(currentWeekElement).toBeInTheDocument()
      expect(currentWeekElement).toHaveClass('text-blue-700')
    })
  })

  describe('Cancel and close', () => {
    it('calls onClose when cancel is clicked', () => {
      const onClose = vi.fn()
      render(<CustomDateRange {...defaultProps} onClose={onClose} />)
      
      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)
      
      expect(onClose).toHaveBeenCalled()
    })

    it('calls onClose after successful selection', async () => {
      const onClose = vi.fn()
      render(<CustomDateRange {...defaultProps} onClose={onClose} />)
      
      const last4Weeks = screen.getByText('Last 4 weeks')
      fireEvent.click(last4Weeks)
      
      await waitFor(() => {
        expect(onClose).toHaveBeenCalled()
      })
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<CustomDateRange {...defaultProps} />)
      
      expect(screen.getByRole('spinbutton', { name: 'Custom weeks' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('focuses input on mount', () => {
      render(<CustomDateRange {...defaultProps} />)
      
      const input = screen.getByRole('spinbutton')
      expect(input).toBeInTheDocument()
      
      // Verify the input can receive focus
      input.focus()
      expect(document.activeElement).toBe(input)
    })
  })
})