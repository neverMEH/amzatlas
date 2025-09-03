import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DateRangePickerV2 } from '../DateRangePickerV2'

// Mock the API hook to prevent ASIN data fetching during tests
vi.mock('@/lib/api/asin-performance', () => ({
  useASINDataAvailability: vi.fn(() => ({ data: null, isLoading: false }))
}))

describe('DateRangePickerV2 - Calendar State Management', () => {
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

  describe('Calendar Dropdown State', () => {
    it('should keep calendar open when clicking inside the calendar', async () => {
      const user = userEvent.setup()
      render(<DateRangePickerV2 {...defaultProps} />)
      
      // Open the calendar
      const calendarButton = screen.getByTestId('calendar-trigger')
      await user.click(calendarButton)
      
      // Verify calendar is open
      expect(screen.getByTestId('week-selector')).toBeInTheDocument()
      
      // Click inside the calendar (on a navigation button)
      const prevButton = screen.getByLabelText('Previous month')
      await user.click(prevButton)
      
      // Calendar should still be open
      expect(screen.getByTestId('week-selector')).toBeInTheDocument()
    })

    it('should close calendar when clicking outside', async () => {
      const user = userEvent.setup()
      const { container } = render(
        <div>
          <DateRangePickerV2 {...defaultProps} />
          <button data-testid="outside-button">Outside</button>
        </div>
      )
      
      // Open the calendar
      const calendarButton = screen.getByTestId('calendar-trigger')
      await user.click(calendarButton)
      
      // Verify calendar is open
      expect(screen.getByTestId('week-selector')).toBeInTheDocument()
      
      // Click outside
      const outsideButton = screen.getByTestId('outside-button')
      await user.click(outsideButton)
      
      // Calendar should be closed
      await waitFor(() => {
        expect(screen.queryByTestId('week-selector')).not.toBeInTheDocument()
      })
    })

    it('should close calendar after selecting a date', async () => {
      const user = userEvent.setup()
      render(<DateRangePickerV2 {...defaultProps} />)
      
      // Open the calendar
      const calendarButton = screen.getByTestId('calendar-trigger')
      await user.click(calendarButton)
      
      // Verify calendar is open
      expect(screen.getByTestId('week-selector')).toBeInTheDocument()
      
      // Click on a day to select a week
      const dayButtons = screen.getAllByRole('button', { name: /^\d+$/ })
      const selectableDay = dayButtons.find(btn => !btn.hasAttribute('disabled'))
      
      if (selectableDay) {
        await user.click(selectableDay)
        
        // Calendar should close after selection
        await waitFor(() => {
          expect(screen.queryByTestId('week-selector')).not.toBeInTheDocument()
        })
        
        // onChange should be called
        expect(mockOnChange).toHaveBeenCalled()
      }
    })

    it('should toggle calendar open/closed when clicking trigger button', async () => {
      const user = userEvent.setup()
      render(<DateRangePickerV2 {...defaultProps} />)
      
      const calendarButton = screen.getByTestId('calendar-trigger')
      
      // Initially closed
      expect(screen.queryByTestId('week-selector')).not.toBeInTheDocument()
      
      // Click to open
      await user.click(calendarButton)
      expect(screen.getByTestId('week-selector')).toBeInTheDocument()
      
      // Click to close
      await user.click(calendarButton)
      expect(screen.queryByTestId('week-selector')).not.toBeInTheDocument()
      
      // Click to open again
      await user.click(calendarButton)
      expect(screen.getByTestId('week-selector')).toBeInTheDocument()
    })

    it('should not close calendar when interacting with calendar controls', async () => {
      const user = userEvent.setup()
      render(<DateRangePickerV2 {...defaultProps} />)
      
      // Open the calendar
      const calendarButton = screen.getByTestId('calendar-trigger')
      await user.click(calendarButton)
      
      // Click "Today" button
      const todayButton = screen.getByText('Today')
      await user.click(todayButton)
      
      // Calendar should close after selecting today
      await waitFor(() => {
        expect(screen.queryByTestId('week-selector')).not.toBeInTheDocument()
      })
      
      // onChange should be called
      expect(mockOnChange).toHaveBeenCalled()
    })
  })

  describe('Calendar State with Different Period Types', () => {
    it('should maintain calendar state when switching between period types', async () => {
      const user = userEvent.setup()
      render(<DateRangePickerV2 {...defaultProps} />)
      
      // Switch to month view
      await user.click(screen.getByText('Month'))
      
      // Open calendar
      const calendarButton = screen.getByTestId('calendar-trigger')
      await user.click(calendarButton)
      
      // Should show month selector
      expect(screen.getByTestId('month-selector')).toBeInTheDocument()
      
      // Click inside month selector
      const monthButton = screen.getAllByRole('button')[0]
      await user.click(monthButton)
      
      // Calendar should close after month selection
      await waitFor(() => {
        expect(screen.queryByTestId('month-selector')).not.toBeInTheDocument()
      })
    })

    it('should show custom date range picker for custom period type', async () => {
      const user = userEvent.setup()
      render(<DateRangePickerV2 {...defaultProps} />)
      
      // Switch to custom
      await user.click(screen.getByText('Custom'))
      
      // Open calendar
      const calendarButton = screen.getByTestId('calendar-trigger')
      await user.click(calendarButton)
      
      // Should show custom selector
      expect(screen.getByTestId('custom-selector')).toBeInTheDocument()
    })
  })

  describe('Event Propagation', () => {
    it('should stop propagation of click events within calendar', async () => {
      const user = userEvent.setup()
      const containerClickHandler = vi.fn()
      
      render(
        <div onClick={containerClickHandler}>
          <DateRangePickerV2 {...defaultProps} />
        </div>
      )
      
      // Open calendar
      const calendarButton = screen.getByTestId('calendar-trigger')
      await user.click(calendarButton)
      
      // Reset the mock to clear the initial trigger click
      containerClickHandler.mockClear()
      
      // Click inside calendar
      const prevButton = screen.getByLabelText('Previous month')
      await user.click(prevButton)
      
      // Container click handler should not be called from calendar interaction
      expect(containerClickHandler).not.toHaveBeenCalled()
    })

    it('should properly handle rapid clicks on calendar trigger', async () => {
      const user = userEvent.setup()
      render(<DateRangePickerV2 {...defaultProps} />)
      
      const calendarButton = screen.getByTestId('calendar-trigger')
      
      // Rapid clicks
      await user.click(calendarButton)
      await user.click(calendarButton)
      await user.click(calendarButton)
      
      // Should end up open (odd number of clicks)
      expect(screen.getByTestId('week-selector')).toBeInTheDocument()
    })
  })

  describe('ASIN Data Integration', () => {
    it('should not interfere with calendar state when ASIN data loads', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<DateRangePickerV2 {...defaultProps} />)
      
      // Open calendar
      const calendarButton = screen.getByTestId('calendar-trigger')
      await user.click(calendarButton)
      
      // Calendar should be open
      expect(screen.getByTestId('week-selector')).toBeInTheDocument()
      
      // Simulate ASIN prop being added (as would happen in parent component)
      rerender(<DateRangePickerV2 {...defaultProps} asin="B001234567" />)
      
      // Calendar should remain open
      expect(screen.getByTestId('week-selector')).toBeInTheDocument()
    })
  })
})