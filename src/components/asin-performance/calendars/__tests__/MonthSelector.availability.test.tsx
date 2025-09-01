import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MonthSelector } from '../MonthSelector'
import { format, startOfMonth, endOfMonth } from 'date-fns'

describe('MonthSelector with data availability', () => {
  const defaultProps = {
    selectedStart: '2024-08-01',
    selectedEnd: '2024-08-31',
    onSelect: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render without available months data', () => {
    render(<MonthSelector {...defaultProps} />)
    
    // Should not show any availability indicators
    expect(document.querySelectorAll('[data-available]')).toHaveLength(0)
  })

  it('should highlight months with available data', () => {
    const availableMonths = [
      '2024-01-15', // January has data
      '2024-03-20', // March has data
      '2024-08-01', // August has data
      '2024-08-15', // Another August date
      '2024-12-25', // December has data
    ]

    render(
      <MonthSelector 
        {...defaultProps} 
        availableMonths={availableMonths}
      />
    )

    // Find all month buttons with availability indicators
    const indicators = document.querySelectorAll('[data-available]')
    
    // Should show 4 indicators (Jan, Mar, Aug, Dec) - duplicate months count as one
    expect(indicators).toHaveLength(4)
    
    // Check specific months have indicators
    const monthButtons = screen.getAllByRole('button')
    const janButton = monthButtons.find(btn => btn.textContent === 'Jan')
    const marButton = monthButtons.find(btn => btn.textContent === 'Mar')
    const augButton = monthButtons.find(btn => btn.textContent === 'Aug')
    const decButton = monthButtons.find(btn => btn.textContent === 'Dec')
    
    expect(janButton?.querySelector('[data-available]')).not.toBeNull()
    expect(marButton?.querySelector('[data-available]')).not.toBeNull()
    expect(augButton?.querySelector('[data-available]')).not.toBeNull()
    expect(decButton?.querySelector('[data-available]')).not.toBeNull()
  })

  it('should not show indicators on disabled months', () => {
    const futureDate = new Date()
    futureDate.setMonth(futureDate.getMonth() + 2)
    const futureMonthDate = format(futureDate, 'yyyy-MM-dd')
    
    render(
      <MonthSelector 
        {...defaultProps} 
        availableMonths={[futureMonthDate]}
        maxDate={format(new Date(), 'yyyy-MM-dd')}
      />
    )

    // Future months should be disabled and not show indicators
    const monthButtons = screen.getAllByRole('button')
    const disabledButtons = monthButtons.filter(btn => btn.disabled)
    
    disabledButtons.forEach(button => {
      expect(button.querySelector('[data-available]')).toBeNull()
    })
  })

  it('should show availability indicators alongside selection highlighting', () => {
    const availableMonths = ['2024-08-15', '2024-09-10']

    render(
      <MonthSelector 
        selectedStart='2024-08-01'
        selectedEnd='2024-08-31'
        onSelect={vi.fn()}
        availableMonths={availableMonths}
      />
    )

    // August should be both selected and have availability
    const augButton = screen.getAllByRole('button').find(btn => btn.textContent === 'Aug')
    expect(augButton).toHaveClass('bg-blue-600')
    expect(augButton?.querySelector('[data-available]')).not.toBeNull()
  })

  it('should show availability indicators with comparison period', () => {
    const availableMonths = ['2024-08-15', '2024-07-10']
    const compareStart = '2024-07-01'
    const compareEnd = '2024-07-31'

    render(
      <MonthSelector 
        {...defaultProps}
        availableMonths={availableMonths}
        compareStart={compareStart}
        compareEnd={compareEnd}
      />
    )

    // July should show comparison highlighting and availability
    const julButton = screen.getAllByRole('button').find(btn => btn.textContent === 'Jul')
    expect(julButton).toHaveClass('bg-purple-100')
    expect(julButton?.querySelector('[data-available]')).not.toBeNull()
  })

  it('should handle year changes and show correct availability', () => {
    const availableMonths = [
      '2023-12-15', // December 2023
      '2024-01-10', // January 2024
      '2024-08-15', // August 2024
    ]

    const { rerender } = render(
      <MonthSelector 
        selectedStart='2024-08-01'
        selectedEnd='2024-08-31'
        onSelect={vi.fn()}
        availableMonths={availableMonths}
      />
    )

    // In 2024 view, should show Jan and Aug indicators
    let indicators = document.querySelectorAll('[data-available]')
    expect(indicators).toHaveLength(2)

    // Navigate to previous year
    const prevButton = screen.getByLabelText('Previous year')
    fireEvent.click(prevButton)

    // Should now show December 2023 indicator
    indicators = document.querySelectorAll('[data-available]')
    const decButton = screen.getAllByRole('button').find(btn => btn.textContent === 'Dec')
    expect(decButton?.querySelector('[data-available]')).not.toBeNull()
  })

  it('should handle clicking on months with and without data', () => {
    const onSelect = vi.fn()
    const availableMonths = ['2024-08-15']

    render(
      <MonthSelector 
        {...defaultProps}
        onSelect={onSelect}
        availableMonths={availableMonths}
      />
    )

    // Click on month with data
    const augButton = screen.getAllByRole('button').find(btn => btn.textContent === 'Aug')!
    fireEvent.click(augButton)
    
    expect(onSelect).toHaveBeenCalledWith({
      startDate: '2024-08-01',
      endDate: '2024-08-31',
    })

    // Click on month without data - should still work
    onSelect.mockClear()
    const sepButton = screen.getAllByRole('button').find(btn => btn.textContent === 'Sep')!
    fireEvent.click(sepButton)
    
    expect(onSelect).toHaveBeenCalledWith({
      startDate: '2024-09-01',
      endDate: '2024-09-30',
    })
  })

  it('should show current month indicator alongside availability', () => {
    const currentDate = new Date()
    const currentMonthDate = format(currentDate, 'yyyy-MM-15')
    
    render(
      <MonthSelector 
        selectedStart={format(startOfMonth(currentDate), 'yyyy-MM-dd')}
        selectedEnd={format(endOfMonth(currentDate), 'yyyy-MM-dd')}
        onSelect={vi.fn()}
        availableMonths={[currentMonthDate]}
      />
    )

    const currentMonthName = format(currentDate, 'MMM')
    const currentMonthButton = screen.getAllByRole('button').find(btn => 
      btn.textContent === currentMonthName
    )
    
    // Should show both current indicator and availability indicator
    expect(currentMonthButton?.querySelector('[data-current]')).not.toBeNull()
    expect(currentMonthButton?.querySelector('[data-available]')).not.toBeNull()
  })

  it('should update availability when availableMonths prop changes', () => {
    const { rerender } = render(
      <MonthSelector 
        {...defaultProps}
        availableMonths={['2024-08-15']}
      />
    )

    // Initially one month has data
    let indicators = document.querySelectorAll('[data-available]')
    expect(indicators).toHaveLength(1)

    // Update with more available months
    rerender(
      <MonthSelector 
        {...defaultProps}
        availableMonths={['2024-08-15', '2024-09-10', '2024-10-20']}
      />
    )

    // Should show more indicators
    indicators = document.querySelectorAll('[data-available]')
    expect(indicators).toHaveLength(3)
  })

  it('should handle months with multiple data points', () => {
    const availableMonths = [
      '2024-08-01',
      '2024-08-05',
      '2024-08-10',
      '2024-08-15',
      '2024-08-20',
      '2024-08-25',
      '2024-08-30',
    ]

    render(
      <MonthSelector 
        {...defaultProps}
        availableMonths={availableMonths}
      />
    )

    // August should still only show one indicator despite multiple dates
    const augButton = screen.getAllByRole('button').find(btn => btn.textContent === 'Aug')
    const indicators = augButton?.querySelectorAll('[data-available]')
    expect(indicators).toHaveLength(1)
  })
})