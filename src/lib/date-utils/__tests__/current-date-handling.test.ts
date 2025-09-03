import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  detectPeriodType,
  calculateComparisonPeriod,
  PeriodType,
  DateRange,
} from '../comparison-period'
import { getCurrentWeekRange, getDefaultDateRange } from '../current-date-utils'

describe('Current Date Handling - September 2025', () => {
  // Mock the current date to September 3, 2025
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-09-03T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getCurrentWeekRange', () => {
    it('should return current week for September 2025', () => {
      const range = getCurrentWeekRange()
      expect(range).toEqual({
        start: '2025-08-31', // Sunday
        end: '2025-09-06',   // Saturday
      })
    })

    it('should handle week starting on Monday', () => {
      const range = getCurrentWeekRange({ weekStartsOn: 1 })
      expect(range).toEqual({
        start: '2025-09-01', // Monday
        end: '2025-09-07',   // Sunday
      })
    })

    it('should handle custom date input', () => {
      const customDate = new Date('2025-09-15T12:00:00Z')
      const range = getCurrentWeekRange({ date: customDate })
      expect(range).toEqual({
        start: '2025-09-14', // Sunday
        end: '2025-09-20',   // Saturday
      })
    })
  })

  describe('getDefaultDateRange', () => {
    it('should return current week by default', () => {
      const range = getDefaultDateRange()
      expect(range).toEqual({
        start: '2025-08-31',
        end: '2025-09-06',
      })
    })

    it('should return current month when period is month', () => {
      const range = getDefaultDateRange({ periodType: 'month' })
      expect(range).toEqual({
        start: '2025-09-01',
        end: '2025-09-30',
      })
    })

    it('should return current quarter when period is quarter', () => {
      const range = getDefaultDateRange({ periodType: 'quarter' })
      expect(range).toEqual({
        start: '2025-07-01', // Q3 2025
        end: '2025-09-30',
      })
    })

    it('should return current year when period is year', () => {
      const range = getDefaultDateRange({ periodType: 'year' })
      expect(range).toEqual({
        start: '2025-01-01',
        end: '2025-12-31',
      })
    })

    it('should return last N days for custom period', () => {
      const range = getDefaultDateRange({ periodType: 'custom', days: 30 })
      expect(range).toEqual({
        start: '2025-08-05', // 30 days including end date
        end: '2025-09-03',
      })
    })
  })

  describe('Recent Date Detection', () => {
    it('should identify current week as recent', () => {
      const range: DateRange = {
        start: '2025-08-31',
        end: '2025-09-06',
      }
      const isRecent = isDateRangeRecent(range)
      expect(isRecent).toBe(true)
    })

    it('should identify last month as recent', () => {
      const range: DateRange = {
        start: '2025-08-01',
        end: '2025-08-31',
      }
      const isRecent = isDateRangeRecent(range)
      expect(isRecent).toBe(true)
    })

    it('should identify 3 months ago as not recent', () => {
      const range: DateRange = {
        start: '2025-06-01',
        end: '2025-06-30',
      }
      const isRecent = isDateRangeRecent(range, { monthsThreshold: 2 })
      expect(isRecent).toBe(false)
    })

    it('should identify 2024 dates as not recent', () => {
      const range: DateRange = {
        start: '2024-08-01',
        end: '2024-08-31',
      }
      const isRecent = isDateRangeRecent(range)
      expect(isRecent).toBe(false)
    })
  })

  describe('Comparison Period Suggestions for Current Dates', () => {
    it('should suggest previous week for current week', () => {
      const currentWeek: DateRange = {
        start: '2025-08-31',
        end: '2025-09-06',
      }
      const comparison = calculateComparisonPeriod(currentWeek)
      expect(comparison).toEqual({
        start: '2025-08-24',
        end: '2025-08-30',
        type: PeriodType.WEEKLY,
        label: 'Previous Week',
      })
    })

    it('should suggest August 2025 for September 2025', () => {
      const september: DateRange = {
        start: '2025-09-01',
        end: '2025-09-30',
      }
      const comparison = calculateComparisonPeriod(september)
      expect(comparison).toEqual({
        start: '2025-08-01',
        end: '2025-08-31',
        type: PeriodType.MONTHLY,
        label: 'Previous Month',
      })
    })

    it('should suggest same week last month for weekly comparison', () => {
      const currentWeek: DateRange = {
        start: '2025-08-31',
        end: '2025-09-06',
      }
      const comparison = calculateComparisonPeriod(currentWeek, 'month-over-month')
      expect(comparison).toEqual({
        start: '2025-07-31',
        end: '2025-08-06',
        type: PeriodType.WEEKLY,
        label: '4 Weeks Ago',
      })
    })

    it('should suggest September 2024 for year-over-year', () => {
      const september2025: DateRange = {
        start: '2025-09-01',
        end: '2025-09-30',
      }
      const comparison = calculateComparisonPeriod(september2025, 'year-over-year')
      expect(comparison).toEqual({
        start: '2024-09-01',
        end: '2024-09-30',
        type: PeriodType.MONTHLY,
        label: 'Same Month Last Year',
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle month boundaries correctly', () => {
      // Set date to August 31, 2025
      vi.setSystemTime(new Date('2025-08-31T12:00:00Z'))
      
      const range = getCurrentWeekRange()
      expect(range).toEqual({
        start: '2025-08-31', // Sunday Aug 31
        end: '2025-09-06',   // Saturday Sep 6
      })
    })

    it('should handle year boundaries correctly', () => {
      // Set date to December 30, 2025
      vi.setSystemTime(new Date('2025-12-30T12:00:00Z'))
      
      const range = getCurrentWeekRange()
      expect(range).toEqual({
        start: '2025-12-28', // Sunday Dec 28
        end: '2026-01-03',   // Saturday Jan 3
      })
    })

    it('should handle leap year correctly', () => {
      // Set date to February 29, 2024 (leap year)
      vi.setSystemTime(new Date('2024-02-29T12:00:00Z'))
      
      const monthRange = getDefaultDateRange({ periodType: 'month' })
      expect(monthRange).toEqual({
        start: '2024-02-01',
        end: '2024-02-29',
      })
    })
  })

  describe('Data Availability Override Prevention', () => {
    it('should not override recent date selection', () => {
      const recentSelection: DateRange = {
        start: '2025-08-25',
        end: '2025-08-31',
      }
      const historicalData: DateRange = {
        start: '2024-01-01',
        end: '2024-12-31',
      }
      
      const shouldOverride = shouldOverrideDateWithHistorical(
        recentSelection, 
        historicalData,
        { monthsThreshold: 2 }
      )
      
      expect(shouldOverride).toBe(false)
    })

    it('should allow override for old date selection', () => {
      const oldSelection: DateRange = {
        start: '2024-01-01',
        end: '2024-01-31',
      }
      const moreRecentData: DateRange = {
        start: '2024-08-01',
        end: '2024-08-31',
      }
      
      const shouldOverride = shouldOverrideDateWithHistorical(
        oldSelection, 
        moreRecentData,
        { monthsThreshold: 2 }
      )
      
      expect(shouldOverride).toBe(true)
    })

    it('should not override when historical data is older than current selection', () => {
      const currentSelection: DateRange = {
        start: '2025-08-01',
        end: '2025-08-31',
      }
      const olderHistoricalData: DateRange = {
        start: '2024-01-01',
        end: '2024-12-31',
      }
      
      const shouldOverride = shouldOverrideDateWithHistorical(
        currentSelection, 
        olderHistoricalData
      )
      
      expect(shouldOverride).toBe(false)
    })
  })
})

// Helper functions that should be in the actual implementation
function isDateRangeRecent(
  range: DateRange, 
  options?: { monthsThreshold?: number }
): boolean {
  const threshold = options?.monthsThreshold || 2
  const today = new Date()
  const startDate = new Date(range.start)
  
  const monthsDiff = (today.getFullYear() - startDate.getFullYear()) * 12 + 
    (today.getMonth() - startDate.getMonth())
  
  return monthsDiff <= threshold
}

function shouldOverrideDateWithHistorical(
  currentSelection: DateRange,
  historicalDataRange: DateRange,
  options?: { monthsThreshold?: number }
): boolean {
  // Don't override if current selection is recent
  if (isDateRangeRecent(currentSelection, options)) {
    return false
  }
  
  // Don't override if historical data is older than current selection
  const currentStart = new Date(currentSelection.start)
  const historicalEnd = new Date(historicalDataRange.end)
  
  if (historicalEnd < currentStart) {
    return false
  }
  
  return true
}