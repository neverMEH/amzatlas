import {
  format,
  parseISO,
  subWeeks,
  subMonths,
  subQuarters,
  subYears,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  getWeek,
  getYear,
  isAfter,
  isBefore,
  isWithinInterval,
  differenceInWeeks,
  differenceInCalendarWeeks,
  addWeeks,
} from 'date-fns'
import { PeriodType, DateRange } from '../types'

export type ComparisonType = 'previous' | 'year-over-year' | 'custom' | 'period-offset'

export interface ComparisonOption {
  value: ComparisonType
  label: string
}

export interface CalculateComparisonParams {
  startDate: string
  endDate: string
  periodType: PeriodType
  comparisonType: ComparisonType
  customOffset?: number
  periodOffset?: number
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export interface ValidateComparisonParams {
  mainStart: string
  mainEnd: string
  compareStart: string
  compareEnd: string
  allowFutureComparison?: boolean
}

export interface FormatLabelParams {
  startDate: string
  endDate: string
  periodType: PeriodType
}

/**
 * Calculate comparison period based on the selected period and comparison type
 */
export function calculateComparisonPeriod({
  startDate,
  endDate,
  periodType,
  comparisonType,
  customOffset = 1,
  periodOffset = 1,
}: CalculateComparisonParams): DateRange {
  const start = parseISO(startDate)
  const end = parseISO(endDate)

  switch (comparisonType) {
    case 'previous':
      return calculatePreviousPeriod(start, end, periodType)
    
    case 'year-over-year':
      return calculateYearOverYear(start, end, periodType)
    
    case 'period-offset':
      return calculatePeriodOffset(start, end, periodType, periodOffset)
    
    case 'custom':
      return calculateCustomPeriod(start, end, periodType, customOffset)
    
    default:
      return { startDate, endDate }
  }
}

/**
 * Calculate the previous period of the same duration
 */
function calculatePreviousPeriod(start: Date, end: Date, periodType: PeriodType): DateRange {
  switch (periodType) {
    case 'week': {
      // For week period, simply go back one week
      const newStart = subWeeks(start, 1)
      const newEnd = subWeeks(end, 1)
      
      return {
        startDate: format(newStart, 'yyyy-MM-dd'),
        endDate: format(newEnd, 'yyyy-MM-dd'),
      }
    }
    
    case 'month': {
      const newStart = subMonths(start, 1)
      return {
        startDate: format(startOfMonth(newStart), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(newStart), 'yyyy-MM-dd'),
      }
    }
    
    case 'quarter': {
      const newStart = subQuarters(start, 1)
      return {
        startDate: format(startOfQuarter(newStart), 'yyyy-MM-dd'),
        endDate: format(endOfQuarter(newStart), 'yyyy-MM-dd'),
      }
    }
    
    case 'year': {
      const newStart = subYears(start, 1)
      return {
        startDate: format(startOfYear(newStart), 'yyyy-MM-dd'),
        endDate: format(endOfYear(newStart), 'yyyy-MM-dd'),
      }
    }
    
    case 'custom': {
      // For custom periods, shift by the same duration
      const duration = end.getTime() - start.getTime()
      const daysInPeriod = Math.ceil(duration / (24 * 60 * 60 * 1000))
      const newEnd = subDays(start, 1)
      const newStart = subDays(newEnd, daysInPeriod - 1)
      
      return {
        startDate: format(newStart, 'yyyy-MM-dd'),
        endDate: format(newEnd, 'yyyy-MM-dd'),
      }
    }
  }
}

/**
 * Calculate the same period in the previous year
 */
function calculateYearOverYear(start: Date, end: Date, periodType: PeriodType): DateRange {
  switch (periodType) {
    case 'week': {
      // For year-over-year comparison, go back exactly 52 weeks
      const newStart = subWeeks(start, 52)
      const newEnd = subWeeks(end, 52)
      
      return {
        startDate: format(newStart, 'yyyy-MM-dd'),
        endDate: format(newEnd, 'yyyy-MM-dd'),
      }
    }
    
    case 'month': {
      const newStart = subYears(start, 1)
      return {
        startDate: format(startOfMonth(newStart), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(newStart), 'yyyy-MM-dd'),
      }
    }
    
    case 'quarter': {
      const newStart = subYears(start, 1)
      return {
        startDate: format(startOfQuarter(newStart), 'yyyy-MM-dd'),
        endDate: format(endOfQuarter(newStart), 'yyyy-MM-dd'),
      }
    }
    
    case 'year':
      // Year-over-year doesn't make sense for year period
      return calculatePreviousPeriod(start, end, periodType)
    
    case 'custom': {
      // For custom periods, shift by one year
      const newStart = subYears(start, 1)
      const newEnd = subYears(end, 1)
      return {
        startDate: format(newStart, 'yyyy-MM-dd'),
        endDate: format(newEnd, 'yyyy-MM-dd'),
      }
    }
  }
}

/**
 * Calculate a custom period offset
 */
function calculatePeriodOffset(start: Date, end: Date, periodType: PeriodType, offset: number): DateRange {
  switch (periodType) {
    case 'week': {
      // Maintain exact week duration
      const newStart = subWeeks(start, offset)
      const newEnd = subWeeks(end, offset)
      return {
        startDate: format(newStart, 'yyyy-MM-dd'),
        endDate: format(newEnd, 'yyyy-MM-dd'),
      }
    }
    
    case 'month': {
      const newStart = subMonths(start, offset)
      return {
        startDate: format(startOfMonth(newStart), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(newStart), 'yyyy-MM-dd'),
      }
    }
    
    case 'quarter': {
      const newStart = subQuarters(start, offset)
      return {
        startDate: format(startOfQuarter(newStart), 'yyyy-MM-dd'),
        endDate: format(endOfQuarter(newStart), 'yyyy-MM-dd'),
      }
    }
    
    case 'year': {
      const newStart = subYears(start, offset)
      return {
        startDate: format(startOfYear(newStart), 'yyyy-MM-dd'),
        endDate: format(endOfYear(newStart), 'yyyy-MM-dd'),
      }
    }
    
    case 'custom': {
      // For custom periods, offset by weeks
      const newStart = subWeeks(start, offset)
      const newEnd = subWeeks(end, offset)
      return {
        startDate: format(newStart, 'yyyy-MM-dd'),
        endDate: format(newEnd, 'yyyy-MM-dd'),
      }
    }
  }
}

/**
 * Calculate a custom period based on period type
 */
function calculateCustomPeriod(start: Date, end: Date, periodType: PeriodType, offset: number): DateRange {
  switch (periodType) {
    case 'week': {
      // Maintain exact duration when going back by offset weeks
      const newStart = subWeeks(start, offset)
      const newEnd = subWeeks(end, offset)
      return {
        startDate: format(newStart, 'yyyy-MM-dd'),
        endDate: format(newEnd, 'yyyy-MM-dd'),
      }
    }
    
    case 'month': {
      const newStart = subMonths(start, offset)
      return {
        startDate: format(startOfMonth(newStart), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(newStart), 'yyyy-MM-dd'),
      }
    }
    
    case 'quarter': {
      const newStart = subQuarters(start, offset)
      return {
        startDate: format(startOfQuarter(newStart), 'yyyy-MM-dd'),
        endDate: format(endOfQuarter(newStart), 'yyyy-MM-dd'),
      }
    }
    
    case 'year': {
      const newStart = subYears(start, offset)
      return {
        startDate: format(startOfYear(newStart), 'yyyy-MM-dd'),
        endDate: format(endOfYear(newStart), 'yyyy-MM-dd'),
      }
    }
    
    case 'custom': {
      // For custom periods, offset by weeks
      const newStart = subWeeks(start, offset)
      const newEnd = subWeeks(end, offset)
      return {
        startDate: format(newStart, 'yyyy-MM-dd'),
        endDate: format(newEnd, 'yyyy-MM-dd'),
      }
    }
  }
}

/**
 * Validate comparison period selection
 */
export function validateComparisonPeriod({
  mainStart,
  mainEnd,
  compareStart,
  compareEnd,
  allowFutureComparison = false,
}: ValidateComparisonParams): ValidationResult {
  const errors: string[] = []
  
  const mainStartDate = parseISO(mainStart)
  const mainEndDate = parseISO(mainEnd)
  const compareStartDate = parseISO(compareStart)
  const compareEndDate = parseISO(compareEnd)
  const today = new Date()
  
  // Check date order
  if (isAfter(compareStartDate, compareEndDate)) {
    errors.push('Comparison end date must be after start date')
  }
  
  // Check for future dates
  if (isAfter(compareStartDate, today) || isAfter(compareEndDate, today)) {
    errors.push('Comparison period cannot be in the future')
  }
  
  // Check for overlap
  const mainInterval = { start: mainStartDate, end: mainEndDate }
  if (
    isWithinInterval(compareStartDate, mainInterval) ||
    isWithinInterval(compareEndDate, mainInterval) ||
    isWithinInterval(mainStartDate, { start: compareStartDate, end: compareEndDate }) ||
    isWithinInterval(mainEndDate, { start: compareStartDate, end: compareEndDate })
  ) {
    errors.push('Comparison period overlaps with selected period')
  }
  
  // Check comparison is before main period (unless allowed)
  if (!allowFutureComparison && isAfter(compareStartDate, mainStartDate)) {
    errors.push('Comparison period must be before the selected period')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Get available comparison options based on period type
 */
export function getComparisonOptions(periodType: PeriodType): ComparisonOption[] {
  const baseOptions: ComparisonOption[] = [
    {
      value: 'previous',
      label: `Previous ${periodType === 'custom' ? 'period' : periodType}`,
    },
  ]
  
  if (periodType !== 'year' && periodType !== 'custom') {
    baseOptions.push({
      value: 'year-over-year',
      label: `Same ${periodType} last year`,
    })
  }
  
  baseOptions.push({
    value: 'custom',
    label: 'Custom',
  })
  
  return baseOptions
}

/**
 * Format comparison period label
 */
export function formatComparisonLabel({ startDate, endDate, periodType }: FormatLabelParams): string {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  
  // Check if it's a standard period
  const isStandardWeek = periodType === 'week' && differenceInCalendarWeeks(end, start) === 0
  const isStandardMonth = periodType === 'month' && 
    format(start, 'yyyy-MM') === format(end, 'yyyy-MM') &&
    start.getDate() === 1 &&
    end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate()
  const isStandardQuarter = periodType === 'quarter' &&
    Math.floor(start.getMonth() / 3) === Math.floor(end.getMonth() / 3) &&
    start.getMonth() % 3 === 0 &&
    start.getDate() === 1
  const isStandardYear = periodType === 'year' &&
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === 0 &&
    start.getDate() === 1 &&
    end.getMonth() === 11 &&
    end.getDate() === 31
  
  switch (periodType) {
    case 'week':
      if (isStandardWeek) {
        const weekNum = getWeek(start, { weekStartsOn: 0 })
        const year = getYear(start)
        return `Week ${weekNum}, ${year}`
      }
      break
    
    case 'month':
      if (isStandardMonth) {
        return format(start, 'MMMM yyyy')
      }
      break
    
    case 'quarter':
      if (isStandardQuarter) {
        const quarter = Math.floor(start.getMonth() / 3) + 1
        return `Q${quarter} ${format(start, 'yyyy')}`
      }
      break
    
    case 'year':
      if (isStandardYear) {
        return format(start, 'yyyy')
      }
      break
    
    case 'custom':
      // Always show date range for custom periods
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`
  }
  
  // Default to date range format
  return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`
}