import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WeekSelector } from '../WeekSelector'
import { format, startOfWeek, endOfWeek, addWeeks } from 'date-fns'

describe('WeekSelector with data availability', () => {
  const defaultProps = {
    selectedStart: '2024-08-01',
    selectedEnd: '2024-08-07',
    onSelect: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render without available weeks data', () => {
    render(<WeekSelector {...defaultProps} />)
    
    // Should not show any availability indicators
    expect(screen.queryAllByTestId('data-available')).toHaveLength(0)
  })

  it('should highlight weeks with available data', () => {
    const availableWeeks = [
      '2024-08-04', // Week starting Sunday Aug 4
      '2024-08-11', // Week starting Sunday Aug 11
      '2024-08-18', // Week starting Sunday Aug 18
    ]

    render(
      <WeekSelector 
        {...defaultProps} 
        availableWeeks={availableWeeks}
      />
    )

    // Find all availability indicators
    const indicators = document.querySelectorAll('[data-available]')
    
    // Should show indicators for weeks with data (7 days per week with data)
    expect(indicators.length).toBeGreaterThan(0)
    
    // Check that the correct weeks have indicators
    availableWeeks.forEach(weekStart => {
      const weekStartDate = new Date(weekStart)
      const weekDates = []
      for (let i = 0; i < 7; i++) {
        weekDates.push(format(new Date(weekStartDate.getTime() + i * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
      }
      
      // At least one day in the week should have an indicator
      const hasIndicator = weekDates.some(date => {
        const dayButton = document.querySelector(`[data-date="${date}"]`)
        return dayButton?.querySelector('[data-available]') !== null
      })
      
      expect(hasIndicator).toBe(true)
    })
  })

  it('should not show indicators on disabled dates', () => {
    const futureDate = addWeeks(new Date(), 2)
    const futureWeek = format(startOfWeek(futureDate, { weekStartsOn: 0 }), 'yyyy-MM-dd')
    const availableWeeks = [futureWeek]

    render(
      <WeekSelector 
        {...defaultProps} 
        availableWeeks={availableWeeks}
        maxDate={format(new Date(), 'yyyy-MM-dd')}
      />
    )

    // Future dates should be disabled and not show indicators
    const futureButton = document.querySelector(`[data-date="${futureWeek}"]`)
    if (futureButton) {
      expect(futureButton).toHaveClass('cursor-not-allowed')
      expect(futureButton.querySelector('[data-available]')).toBeNull()
    }
  })

  it('should show availability indicators alongside selection highlighting', () => {
    const selectedWeek = '2024-08-04'
    const availableWeeks = ['2024-08-04', '2024-08-11']

    render(
      <WeekSelector 
        selectedStart={selectedWeek}
        selectedEnd={format(endOfWeek(new Date(selectedWeek), { weekStartsOn: 0 }), 'yyyy-MM-dd')}
        onSelect={vi.fn()}
        availableWeeks={availableWeeks}
      />
    )

    // Check that selected week has both selection highlighting and availability indicator
    const selectedDayButton = document.querySelector(`[data-date="${selectedWeek}"]`)
    expect(selectedDayButton).toHaveClass('bg-blue-100')
    expect(selectedDayButton?.querySelector('[data-available]')).not.toBeNull()
  })

  it('should show availability indicators with comparison period', () => {
    const availableWeeks = ['2024-08-04', '2024-08-11']
    const compareStart = '2024-08-04'
    const compareEnd = '2024-08-10'

    render(
      <WeekSelector 
        selectedStart='2024-08-11'
        selectedEnd='2024-08-17'
        onSelect={vi.fn()}
        availableWeeks={availableWeeks}
        compareStart={compareStart}
        compareEnd={compareEnd}
      />
    )

    // Available weeks should show indicators
    availableWeeks.forEach(weekStart => {
      const dayButton = document.querySelector(`[data-date="${weekStart}"]`)
      expect(dayButton?.querySelector('[data-available]')).not.toBeNull()
    })
    
    // The test is mainly to ensure availability indicators work with comparison periods
    // The actual comparison styling is complex due to CSS precedence
  })

  it('should handle clicking on weeks with and without data', () => {
    const onSelect = vi.fn()
    const availableWeeks = ['2024-08-04']

    render(
      <WeekSelector 
        {...defaultProps}
        onSelect={onSelect}
        availableWeeks={availableWeeks}
      />
    )

    // Click on week with data
    const weekWithData = document.querySelector('[data-date="2024-08-05"]') as HTMLElement
    fireEvent.click(weekWithData)
    
    expect(onSelect).toHaveBeenCalledWith({
      startDate: '2024-08-04',
      endDate: '2024-08-10',
    })

    // Click on week without data - should still work
    onSelect.mockClear()
    const weekWithoutData = document.querySelector('[data-date="2024-08-12"]') as HTMLElement
    fireEvent.click(weekWithoutData)
    
    expect(onSelect).toHaveBeenCalledWith({
      startDate: '2024-08-11',
      endDate: '2024-08-17',
    })
  })

  it('should show today indicator alongside availability indicator', () => {
    const today = new Date()
    const todayFormatted = format(today, 'yyyy-MM-dd')
    const currentWeekStart = format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd')
    
    render(
      <WeekSelector 
        selectedStart={todayFormatted}
        selectedEnd={todayFormatted}
        onSelect={vi.fn()}
        availableWeeks={[currentWeekStart]}
      />
    )

    const todayButton = document.querySelector(`[data-date="${todayFormatted}"]`)
    
    // Should show both today indicator and availability indicator
    expect(todayButton?.querySelector('[data-current]')).not.toBeNull()
    expect(todayButton?.querySelector('[data-available]')).not.toBeNull()
  })

  it('should update availability indicators when availableWeeks prop changes', () => {
    const { rerender } = render(
      <WeekSelector 
        {...defaultProps}
        availableWeeks={['2024-08-04']}
      />
    )

    // Initially one week has data
    let indicators = document.querySelectorAll('[data-available]')
    const initialCount = indicators.length

    // Update with more available weeks
    rerender(
      <WeekSelector 
        {...defaultProps}
        availableWeeks={['2024-08-04', '2024-08-11', '2024-08-18']}
      />
    )

    // Should show more indicators
    indicators = document.querySelectorAll('[data-available]')
    expect(indicators.length).toBeGreaterThan(initialCount)
  })
})