import { 
  differenceInDays, 
  differenceInMonths,
  differenceInQuarters,
  differenceInYears,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  parseISO,
  isSameDay,
} from 'date-fns'
import { DateRange, PeriodType } from './types'

/**
 * Detects the type of period based on the date range
 */
export function detectPeriodType(range: DateRange): PeriodType {
  const start = parseISO(range.start)
  const end = parseISO(range.end)
  const daysDiff = differenceInDays(end, start) + 1 // Include both start and end days

  // Check for exact period matches first
  if (daysDiff === 1) {
    return PeriodType.DAILY
  }

  if (daysDiff === 7) {
    return PeriodType.WEEKLY
  }

  if (daysDiff === 14) {
    return PeriodType.BI_WEEKLY
  }

  // Check for full calendar periods
  if (isFullMonth(start, end)) {
    return PeriodType.MONTHLY
  }

  if (isFullQuarter(start, end)) {
    return PeriodType.QUARTERLY
  }

  if (isFullYear(start, end)) {
    return PeriodType.YEARLY
  }

  // Check for approximate periods
  if (daysDiff >= 28 && daysDiff <= 31) {
    return PeriodType.MONTHLY
  }

  if (daysDiff >= 89 && daysDiff <= 92) {
    return PeriodType.QUARTERLY
  }

  if (daysDiff >= 364 && daysDiff <= 366) {
    return PeriodType.YEARLY
  }

  // Default to custom for any other period
  return PeriodType.CUSTOM
}

/**
 * Checks if the date range represents a full calendar month
 */
function isFullMonth(start: Date, end: Date): boolean {
  return (
    isSameDay(start, startOfMonth(start)) &&
    isSameDay(end, endOfMonth(start)) &&
    differenceInMonths(end, start) === 0
  )
}

/**
 * Checks if the date range represents a full calendar quarter
 */
function isFullQuarter(start: Date, end: Date): boolean {
  return (
    isSameDay(start, startOfQuarter(start)) &&
    isSameDay(end, endOfQuarter(start)) &&
    differenceInQuarters(end, start) === 0
  )
}

/**
 * Checks if the date range represents a full calendar year
 */
function isFullYear(start: Date, end: Date): boolean {
  return (
    isSameDay(start, startOfYear(start)) &&
    isSameDay(end, endOfYear(start)) &&
    differenceInYears(end, start) === 0
  )
}

/**
 * Gets the number of days in a period type
 */
export function getPeriodDays(periodType: PeriodType): number | null {
  switch (periodType) {
    case PeriodType.DAILY:
      return 1
    case PeriodType.WEEKLY:
      return 7
    case PeriodType.BI_WEEKLY:
      return 14
    case PeriodType.MONTHLY:
      return 30 // Approximate
    case PeriodType.QUARTERLY:
      return 90 // Approximate
    case PeriodType.YEARLY:
      return 365 // Approximate
    case PeriodType.CUSTOM:
      return null
  }
}

/**
 * Detects if a period spans multiple calendar units (months, quarters, years)
 */
export function detectPeriodBoundaries(range: DateRange): {
  crossesMonth: boolean
  crossesQuarter: boolean
  crossesYear: boolean
} {
  const start = parseISO(range.start)
  const end = parseISO(range.end)

  return {
    crossesMonth: start.getMonth() !== end.getMonth() || start.getFullYear() !== end.getFullYear(),
    crossesQuarter: Math.floor(start.getMonth() / 3) !== Math.floor(end.getMonth() / 3) || start.getFullYear() !== end.getFullYear(),
    crossesYear: start.getFullYear() !== end.getFullYear(),
  }
}