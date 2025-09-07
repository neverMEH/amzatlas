import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { DateRangePicker } from '../DateRangePicker'
import { format, subDays, startOfWeek, startOfMonth, startOfYear } from 'date-fns'

// Mock the API module to prevent React Query issues
vi.mock('@/lib/api/asin-performance', () => ({
  useASINDataAvailability: vi.fn(() => ({
    data: null,
    isLoading: false,
    error: null
  }))
}))

describe('DateRangePicker', () => {
  const mockOnChange = vi.fn()
  const today = new Date()
  const defaultStartDate = format(subDays(today, 30), 'yyyy-MM-dd')
  const defaultEndDate = format(today, 'yyyy-MM-dd')

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  it('renders with default date range', () => {
    render(
      <DateRangePicker
        startDate={defaultStartDate}
        endDate={defaultEndDate}
        onChange={mockOnChange}
      />
    )

    expect(screen.getByDisplayValue(defaultStartDate)).toBeInTheDocument()
    expect(screen.getByDisplayValue(defaultEndDate)).toBeInTheDocument()
  })

  it('shows preset options when clicking the preset button', () => {
    render(
      <DateRangePicker
        startDate={defaultStartDate}
        endDate={defaultEndDate}
        onChange={mockOnChange}
      />
    )

    const presetButton = screen.getByRole('button', { name: /Last 30 days/i })
    fireEvent.click(presetButton)

    const options = screen.getAllByRole('listitem')
    expect(options).toHaveLength(7)
    expect(options[0]).toHaveTextContent('Last 7 days')
    expect(options[1]).toHaveTextContent('Last 14 days')
    expect(options[2]).toHaveTextContent('Last 30 days')
    expect(options[3]).toHaveTextContent('Last 90 days')
    expect(options[4]).toHaveTextContent('This week')
    expect(options[5]).toHaveTextContent('This month')
    expect(options[6]).toHaveTextContent('This year')
  })

  it('applies preset date range when selected', () => {
    render(
      <DateRangePicker
        startDate={defaultStartDate}
        endDate={defaultEndDate}
        onChange={mockOnChange}
      />
    )

    const presetButton = screen.getByRole('button', { name: /Last 30 days/i })
    fireEvent.click(presetButton)
    
    fireEvent.click(screen.getByText('Last 7 days'))

    expect(mockOnChange).toHaveBeenCalledWith({
      startDate: format(subDays(today, 7), 'yyyy-MM-dd'),
      endDate: format(today, 'yyyy-MM-dd'),
    })
  })

  it('allows custom date selection', () => {
    const { rerender } = render(
      <DateRangePicker
        startDate={defaultStartDate}
        endDate={defaultEndDate}
        onChange={mockOnChange}
      />
    )

    const startDateInput = screen.getByDisplayValue(defaultStartDate)
    
    // Test changing start date
    fireEvent.change(startDateInput, { target: { value: '2025-01-15' } })
    
    expect(mockOnChange).toHaveBeenCalledWith({
      startDate: '2025-01-15',
      endDate: defaultEndDate,
    })

    // Simulate the parent component updating the props
    rerender(
      <DateRangePicker
        startDate="2025-01-15"
        endDate={defaultEndDate}
        onChange={mockOnChange}
      />
    )

    mockOnChange.mockClear()

    // Test changing end date
    const endDateInput = screen.getByDisplayValue(defaultEndDate)
    fireEvent.change(endDateInput, { target: { value: '2025-01-20' } })

    expect(mockOnChange).toHaveBeenCalledWith({
      startDate: '2025-01-15',
      endDate: '2025-01-20',
    })
  })

  it('prevents end date from being before start date', () => {
    render(
      <DateRangePicker
        startDate="2024-01-15"
        endDate="2024-01-31"
        onChange={mockOnChange}
      />
    )

    const endDateInput = screen.getByDisplayValue('2024-01-31')
    fireEvent.change(endDateInput, { target: { value: '2024-01-10' } })

    // Should not call onChange with invalid date range
    expect(mockOnChange).not.toHaveBeenCalled()
  })

  it('shows comparison period when enabled', () => {
    render(
      <DateRangePicker
        startDate={defaultStartDate}
        endDate={defaultEndDate}
        onChange={mockOnChange}
        showComparison={true}
        compareStartDate={format(subDays(today, 60), 'yyyy-MM-dd')}
        compareEndDate={format(subDays(today, 31), 'yyyy-MM-dd')}
        onCompareChange={mockOnChange}
      />
    )

    expect(screen.getByText('Compare to another period')).toBeInTheDocument()
    expect(screen.getByLabelText('Enable comparison')).toBeInTheDocument()
  })

  it('toggles comparison period', () => {
    const mockCompareChange = vi.fn()
    
    render(
      <DateRangePicker
        startDate={defaultStartDate}
        endDate={defaultEndDate}
        onChange={mockOnChange}
        showComparison={true}
        onCompareChange={mockCompareChange}
      />
    )

    const compareToggle = screen.getByLabelText('Enable comparison')
    fireEvent.click(compareToggle)

    expect(mockCompareChange).toHaveBeenCalled()
  })

  it('closes preset dropdown when clicking outside', async () => {
    render(
      <div>
        <DateRangePicker
          startDate={defaultStartDate}
          endDate={defaultEndDate}
          onChange={mockOnChange}
        />
        <button>Outside button</button>
      </div>
    )

    const presetButton = screen.getByRole('button', { name: /Last 30 days/i })
    fireEvent.click(presetButton)

    expect(screen.getByText('Last 7 days')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByText('Outside button'))

    await waitFor(() => {
      expect(screen.queryByText('Last 7 days')).not.toBeInTheDocument()
    })
  })

  it('applies different preset ranges correctly', () => {
    render(
      <DateRangePicker
        startDate={defaultStartDate}
        endDate={defaultEndDate}
        onChange={mockOnChange}
      />
    )

    const presetButton = screen.getByRole('button', { name: /Last 30 days/i })
    fireEvent.click(presetButton)

    // Test "This week"
    fireEvent.click(screen.getByText('This week'))
    expect(mockOnChange).toHaveBeenCalledWith({
      startDate: format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
      endDate: format(today, 'yyyy-MM-dd'),
    })

    // Test "This month"
    fireEvent.click(presetButton)
    fireEvent.click(screen.getByText('This month'))
    expect(mockOnChange).toHaveBeenCalledWith({
      startDate: format(startOfMonth(today), 'yyyy-MM-dd'),
      endDate: format(today, 'yyyy-MM-dd'),
    })
  })

  it('displays selected preset name in button', () => {
    render(
      <DateRangePicker
        startDate={format(subDays(today, 7), 'yyyy-MM-dd')}
        endDate={format(today, 'yyyy-MM-dd')}
        onChange={mockOnChange}
      />
    )

    expect(screen.getByRole('button', { name: /Last 7 days/i })).toBeInTheDocument()
  })

  it('handles invalid date inputs gracefully', () => {
    render(
      <DateRangePicker
        startDate={defaultStartDate}
        endDate={defaultEndDate}
        onChange={mockOnChange}
      />
    )

    const startDateInput = screen.getByDisplayValue(defaultStartDate)
    fireEvent.change(startDateInput, { target: { value: 'invalid-date' } })

    // Should not crash and should not call onChange
    expect(mockOnChange).not.toHaveBeenCalled()
  })
})