import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  subDays,
  parseISO,
  differenceInMonths,
  isAfter,
  isBefore,
} from 'date-fns'
import { DateRange } from './types'

export interface WeekRangeOptions {
  date?: Date
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
}

export interface DefaultDateRangeOptions {
  periodType?: 'week' | 'month' | 'quarter' | 'year' | 'custom'
  days?: number
  date?: Date
}

/**
 * Get the current week's date range
 * Note: For consistency with Amazon data, all dates are calculated in local time
 */
export function getCurrentWeekRange(options?: WeekRangeOptions): DateRange {
  const date = options?.date || new Date()
  const weekStartsOn = options?.weekStartsOn || 0 // Default to Sunday
  
  const start = startOfWeek(date, { weekStartsOn })
  const end = endOfWeek(date, { weekStartsOn })
  
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  }
}

/**
 * Get the default date range based on period type
 */
export function getDefaultDateRange(options?: DefaultDateRangeOptions): DateRange {
  const date = options?.date || new Date()
  const periodType = options?.periodType || 'week'
  
  switch (periodType) {
    case 'week':
      return getCurrentWeekRange({ date })
    
    case 'month':
      return {
        start: format(startOfMonth(date), 'yyyy-MM-dd'),
        end: format(endOfMonth(date), 'yyyy-MM-dd'),
      }
    
    case 'quarter':
      return {
        start: format(startOfQuarter(date), 'yyyy-MM-dd'),
        end: format(endOfQuarter(date), 'yyyy-MM-dd'),
      }
    
    case 'year':
      return {
        start: format(startOfYear(date), 'yyyy-MM-dd'),
        end: format(endOfYear(date), 'yyyy-MM-dd'),
      }
    
    case 'custom':
      const days = options?.days || 30
      const end = date
      const start = subDays(end, days - 1)
      return {
        start: format(start, 'yyyy-MM-dd'),
        end: format(end, 'yyyy-MM-dd'),
      }
    
    default:
      return getCurrentWeekRange({ date })
  }
}

/**
 * Check if a date range is considered recent (within threshold months)
 */
export function isDateRangeRecent(
  range: DateRange,
  options?: { monthsThreshold?: number }
): boolean {
  const threshold = options?.monthsThreshold || 2
  const today = new Date()
  const startDate = parseISO(range.start)
  
  const monthsDiff = differenceInMonths(today, startDate)
  
  return monthsDiff <= threshold
}

/**
 * Determine if historical data should override current date selection
 */
export function shouldOverrideDateWithHistorical(
  currentSelection: DateRange,
  historicalDataRange: DateRange,
  options?: { monthsThreshold?: number }
): boolean {
  // Don't override if current selection is recent
  if (isDateRangeRecent(currentSelection, options)) {
    return false
  }
  
  // Parse dates
  const currentStart = parseISO(currentSelection.start)
  const historicalEnd = parseISO(historicalDataRange.end)
  
  // Don't override if historical data is older than current selection
  if (isBefore(historicalEnd, currentStart)) {
    return false
  }
  
  return true
}

/**
 * Check if there's data overlap between two date ranges
 */
export function hasDataOverlap(
  dateRange: DateRange,
  dataRange: { start_date: string; end_date: string }
): boolean {
  const rangeStart = parseISO(dateRange.start)
  const rangeEnd = parseISO(dateRange.end)
  const dataStart = parseISO(dataRange.start_date)
  const dataEnd = parseISO(dataRange.end_date)
  
  // Check for any overlap
  return (
    (isAfter(dataEnd, rangeStart) || format(dataEnd, 'yyyy-MM-dd') === dateRange.start) &&
    (isBefore(dataStart, rangeEnd) || format(dataStart, 'yyyy-MM-dd') === dateRange.end)
  )
}


/**
 * Calculate confidence score for a date range based on recency
 */
export function calculateRecencyConfidence(dateEnd: string): 'high' | 'medium' | 'low' {
  const today = new Date()
  const endDate = parseISO(dateEnd)
  const monthsAgo = differenceInMonths(today, endDate)
  
  // Within 2 months = high confidence (very recent)
  // 2-6 months = medium confidence (reasonably recent)
  // Over 6 months = low confidence (historical)
  if (monthsAgo <= 2) return 'high'
  if (monthsAgo <= 6) return 'medium'
  return 'low'
}