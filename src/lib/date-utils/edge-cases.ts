import {
  parseISO,
  isLeapYear,
  getDaysInMonth,
  setDate,
  format,
  endOfMonth,
  min,
  isAfter,
  isBefore,
  differenceInDays,
} from 'date-fns'
import { DateRange } from './types'

/**
 * Handles month-end edge cases when calculating comparison periods
 * For example, comparing Jan 31 to Feb (which has 28/29 days)
 */
export function adjustForMonthEnd(date: Date, targetMonth: Date): Date {
  const targetDaysInMonth = getDaysInMonth(targetMonth)
  const currentDay = date.getDate()
  
  if (currentDay > targetDaysInMonth) {
    // If the day doesn't exist in target month (e.g., Jan 31 -> Feb)
    // Use the last day of the target month
    return endOfMonth(targetMonth)
  }
  
  return setDate(targetMonth, currentDay)
}

/**
 * Handles leap year adjustments for date calculations
 */
export function adjustForLeapYear(date: Date, targetYear: number): Date {
  const month = date.getMonth()
  const day = date.getDate()
  
  // Special handling for February 29
  if (month === 1 && day === 29) {
    const targetDate = new Date(targetYear, month, 1)
    if (!isLeapYear(targetDate)) {
      // If target year is not a leap year, use Feb 28
      return new Date(targetYear, month, 28)
    }
  }
  
  // For all other dates, adjust using month-end logic
  const targetDate = new Date(targetYear, month, 1)
  return adjustForMonthEnd(date, targetDate)
}

/**
 * Ensures date ranges don't exceed reasonable boundaries
 */
export function clampDateRange(range: DateRange, minDate?: string, maxDate?: string): DateRange {
  const start = parseISO(range.start)
  const end = parseISO(range.end)
  
  let clampedStart = start
  let clampedEnd = end
  
  if (minDate) {
    const min = parseISO(minDate)
    if (isBefore(start, min)) {
      clampedStart = min
    }
  }
  
  if (maxDate) {
    const max = parseISO(maxDate)
    if (isAfter(end, max)) {
      clampedEnd = max
    }
  }
  
  // Ensure start is before end
  if (isAfter(clampedStart, clampedEnd)) {
    clampedStart = clampedEnd
  }
  
  return {
    start: format(clampedStart, 'yyyy-MM-dd'),
    end: format(clampedEnd, 'yyyy-MM-dd'),
  }
}

/**
 * Handles partial period calculations at month/quarter/year boundaries
 */
export function handlePartialPeriods(range: DateRange): {
  isPartial: boolean
  fullPeriodStart?: string
  fullPeriodEnd?: string
  partialDays: number
  totalPeriodDays: number
} {
  const start = parseISO(range.start)
  const end = parseISO(range.end)
  const duration = differenceInDays(end, start) + 1
  
  // Check if it's a partial month
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1)
  const monthEnd = endOfMonth(start)
  
  if (start.getTime() !== monthStart.getTime() || end.getTime() !== monthEnd.getTime()) {
    return {
      isPartial: true,
      fullPeriodStart: format(monthStart, 'yyyy-MM-dd'),
      fullPeriodEnd: format(monthEnd, 'yyyy-MM-dd'),
      partialDays: duration,
      totalPeriodDays: getDaysInMonth(start),
    }
  }
  
  return {
    isPartial: false,
    partialDays: duration,
    totalPeriodDays: duration,
  }
}

/**
 * Calculates the equivalent period in a different month/year accounting for varying month lengths
 */
export function calculateEquivalentPeriod(
  range: DateRange,
  targetStartDate: Date
): DateRange {
  const start = parseISO(range.start)
  const end = parseISO(range.end)
  const duration = differenceInDays(end, start)
  
  // Get the day of month for the start date
  const startDay = start.getDate()
  
  // Calculate the equivalent start date in the target period
  let equivalentStart = setDate(targetStartDate, startDay)
  
  // Handle month-end cases
  if (startDay > getDaysInMonth(targetStartDate)) {
    equivalentStart = endOfMonth(targetStartDate)
  }
  
  // Calculate end date based on duration
  const equivalentEnd = new Date(equivalentStart)
  equivalentEnd.setDate(equivalentEnd.getDate() + duration)
  
  // Ensure we don't exceed month boundaries if original range was within a month
  const originalSpansMonths = start.getMonth() !== end.getMonth() || start.getFullYear() !== end.getFullYear()
  if (!originalSpansMonths && equivalentEnd.getMonth() !== equivalentStart.getMonth()) {
    // Keep within the same month
    return {
      start: format(equivalentStart, 'yyyy-MM-dd'),
      end: format(endOfMonth(equivalentStart), 'yyyy-MM-dd'),
    }
  }
  
  return {
    start: format(equivalentStart, 'yyyy-MM-dd'),
    end: format(equivalentEnd, 'yyyy-MM-dd'),
  }
}

/**
 * Validates that a date range is valid and handles common edge cases
 */
export function validateAndFixDateRange(range: DateRange): {
  valid: boolean
  fixed?: DateRange
  issues: string[]
} {
  const issues: string[] = []
  
  try {
    const start = parseISO(range.start)
    const end = parseISO(range.end)
    
    // Check if dates are valid
    if (isNaN(start.getTime())) {
      issues.push('Invalid start date')
    }
    if (isNaN(end.getTime())) {
      issues.push('Invalid end date')
    }
    
    if (issues.length > 0) {
      return { valid: false, issues }
    }
    
    // Check if start is after end
    if (isAfter(start, end)) {
      issues.push('Start date is after end date')
      // Fix by swapping
      return {
        valid: false,
        fixed: {
          start: range.end,
          end: range.start,
        },
        issues,
      }
    }
    
    // Check for unreasonable date ranges (more than 5 years)
    const daysDiff = differenceInDays(end, start)
    if (daysDiff > 365 * 5) {
      issues.push('Date range spans more than 5 years')
    }
    
    // Check for future dates (assuming we don't want to compare future periods)
    const today = new Date()
    if (isAfter(start, today)) {
      issues.push('Start date is in the future')
    }
    if (isAfter(end, today)) {
      issues.push('End date is in the future')
    }
    
    return {
      valid: issues.length === 0,
      fixed: range,
      issues,
    }
  } catch (error) {
    issues.push('Invalid date format')
    return { valid: false, issues }
  }
}