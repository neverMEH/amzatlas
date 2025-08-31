import {
  subDays,
  subWeeks,
  subMonths,
  subQuarters,
  subYears,
  addDays,
  format,
  parseISO,
  differenceInDays,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
} from 'date-fns'
import { DateRange, ComparisonPeriod, PeriodType, ComparisonMode, ComparisonOptions } from './types'
import { detectPeriodType } from './period-detector'
import { performanceTracker } from '../monitoring/performance-tracker'
import { comparisonCache, CalculationCache } from './calculation-cache'

/**
 * Calculates the comparison period based on the main date range
 */
export function calculateComparisonPeriod(
  range: DateRange,
  mode: ComparisonMode = 'auto',
  options?: ComparisonOptions
): ComparisonPeriod {
  // Check cache first
  const cacheKey = CalculationCache.createKey(range, mode, options)
  const cached = comparisonCache.get(cacheKey)
  if (cached) {
    return cached
  }
  
  performanceTracker.startTimer('calculateComparisonPeriod')
  
  try {
    // Validate date range first
    let start: Date
    let end: Date
    
    try {
      start = parseISO(range.start)
      end = parseISO(range.end)
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date format')
      }
    } catch (error) {
      // Return a default comparison period for invalid dates
      return {
        start: '',
        end: '',
        type: PeriodType.CUSTOM,
        label: 'Invalid date range',
      }
    }
    
    const periodType = detectPeriodType(range)
    const duration = differenceInDays(end, start) + 1

    // Handle auto mode by determining the best comparison based on period type
    if (mode === 'auto') {
      switch (periodType) {
        case PeriodType.DAILY:
          return calculateDailyComparison(range)
        case PeriodType.WEEKLY:
          return calculateWeeklyComparison(range)
        case PeriodType.BI_WEEKLY:
          return calculateBiWeeklyComparison(range)
        case PeriodType.MONTHLY:
          return calculateMonthlyComparison(range)
        case PeriodType.QUARTERLY:
          return calculateQuarterlyComparison(range)
        case PeriodType.YEARLY:
          return calculateYearlyComparison(range)
        case PeriodType.CUSTOM:
          return calculateCustomComparison(range, duration)
      }
    }

    // Handle specific comparison modes
    let result: ComparisonPeriod
    switch (mode) {
      case 'period-over-period':
        result = calculatePeriodOverPeriod(range, periodType, duration)
        break
      case 'week-over-week':
        result = calculateWeekOverWeek(range, periodType)
        break
      case 'month-over-month':
        result = calculateMonthOverMonth(range, periodType)
        break
      case 'quarter-over-quarter':
        result = calculateQuarterOverQuarter(range, periodType)
        break
      case 'year-over-year':
        result = calculateYearOverYear(range, periodType)
        break
      default:
        result = calculatePeriodOverPeriod(range, periodType, duration)
    }
    
    // Cache the result
    comparisonCache.set(cacheKey, result)
    return result
  } finally {
    performanceTracker.endTimer('calculateComparisonPeriod', { mode, range })
  }
}

function calculateDailyComparison(range: DateRange): ComparisonPeriod {
  const start = parseISO(range.start)
  const comparisonEnd = subDays(start, 1)
  const comparisonStart = comparisonEnd

  return {
    start: format(comparisonStart, 'yyyy-MM-dd'),
    end: format(comparisonEnd, 'yyyy-MM-dd'),
    type: PeriodType.DAILY,
    label: 'Previous Day',
  }
}

function calculateWeeklyComparison(range: DateRange): ComparisonPeriod {
  const start = parseISO(range.start)
  const end = parseISO(range.end)
  const duration = differenceInDays(end, start)
  
  // Calculate the same duration period immediately before
  const comparisonEnd = subDays(start, 1)
  const comparisonStart = subDays(start, duration + 1)

  return {
    start: format(comparisonStart, 'yyyy-MM-dd'),
    end: format(comparisonEnd, 'yyyy-MM-dd'),
    type: PeriodType.WEEKLY,
    label: 'Previous Week',
  }
}

function calculateBiWeeklyComparison(range: DateRange): ComparisonPeriod {
  const start = parseISO(range.start)
  const end = parseISO(range.end)
  const comparisonEnd = subDays(start, 1)
  const comparisonStart = subDays(end, 14)

  return {
    start: format(comparisonStart, 'yyyy-MM-dd'),
    end: format(comparisonEnd, 'yyyy-MM-dd'),
    type: PeriodType.BI_WEEKLY,
    label: 'Previous 2 Weeks',
  }
}

function calculateMonthlyComparison(range: DateRange): ComparisonPeriod {
  const start = parseISO(range.start)
  const end = parseISO(range.end)

  // Check if it's a full calendar month
  const isFullMonth = 
    format(start, 'd') === '1' && 
    format(addDays(end, 1), 'd') === '1'

  if (isFullMonth) {
    const previousMonthStart = startOfMonth(subMonths(start, 1))
    const previousMonthEnd = endOfMonth(subMonths(start, 1))

    return {
      start: format(previousMonthStart, 'yyyy-MM-dd'),
      end: format(previousMonthEnd, 'yyyy-MM-dd'),
      type: PeriodType.MONTHLY,
      label: 'Previous Month',
    }
  } else {
    // For partial months or 30-day periods
    const duration = differenceInDays(end, start) + 1
    const comparisonEnd = subDays(start, 1)
    const comparisonStart = subDays(start, duration)

    return {
      start: format(comparisonStart, 'yyyy-MM-dd'),
      end: format(comparisonEnd, 'yyyy-MM-dd'),
      type: PeriodType.MONTHLY,
      label: `Previous ${duration} Days`,
    }
  }
}

function calculateQuarterlyComparison(range: DateRange): ComparisonPeriod {
  const start = parseISO(range.start)
  
  // Check if it's a full calendar quarter
  const isFullQuarter = 
    format(start, 'yyyy-MM-dd') === format(startOfQuarter(start), 'yyyy-MM-dd') &&
    format(parseISO(range.end), 'yyyy-MM-dd') === format(endOfQuarter(start), 'yyyy-MM-dd')

  if (isFullQuarter) {
    const previousQuarterStart = startOfQuarter(subQuarters(start, 1))
    const previousQuarterEnd = endOfQuarter(subQuarters(start, 1))

    return {
      start: format(previousQuarterStart, 'yyyy-MM-dd'),
      end: format(previousQuarterEnd, 'yyyy-MM-dd'),
      type: PeriodType.QUARTERLY,
      label: 'Previous Quarter',
    }
  } else {
    // For partial quarters
    const duration = differenceInDays(parseISO(range.end), start) + 1
    const comparisonEnd = subDays(start, 1)
    const comparisonStart = subDays(start, duration)

    return {
      start: format(comparisonStart, 'yyyy-MM-dd'),
      end: format(comparisonEnd, 'yyyy-MM-dd'),
      type: PeriodType.QUARTERLY,
      label: `Previous ${duration} Days`,
    }
  }
}

function calculateYearlyComparison(range: DateRange): ComparisonPeriod {
  const start = parseISO(range.start)
  const end = parseISO(range.end)
  const comparisonStart = subYears(start, 1)
  const comparisonEnd = subYears(end, 1)

  return {
    start: format(comparisonStart, 'yyyy-MM-dd'),
    end: format(comparisonEnd, 'yyyy-MM-dd'),
    type: PeriodType.YEARLY,
    label: 'Previous Year',
  }
}

function calculateCustomComparison(range: DateRange, duration: number): ComparisonPeriod {
  const start = parseISO(range.start)
  const comparisonEnd = subDays(start, 1)
  const comparisonStart = subDays(start, duration)

  return {
    start: format(comparisonStart, 'yyyy-MM-dd'),
    end: format(comparisonEnd, 'yyyy-MM-dd'),
    type: PeriodType.CUSTOM,
    label: `Previous ${duration} Days`,
  }
}

function calculatePeriodOverPeriod(range: DateRange, periodType: PeriodType, duration: number): ComparisonPeriod {
  const start = parseISO(range.start)
  const comparisonEnd = subDays(start, 1)
  const comparisonStart = subDays(start, duration)

  const labelMap: Record<PeriodType, string> = {
    [PeriodType.DAILY]: 'Previous Day',
    [PeriodType.WEEKLY]: 'Previous Week',
    [PeriodType.BI_WEEKLY]: 'Previous 2 Weeks',
    [PeriodType.MONTHLY]: 'Previous Month',
    [PeriodType.QUARTERLY]: 'Previous Quarter',
    [PeriodType.YEARLY]: 'Previous Year',
    [PeriodType.CUSTOM]: `Previous ${duration} Days`,
  }

  return {
    start: format(comparisonStart, 'yyyy-MM-dd'),
    end: format(comparisonEnd, 'yyyy-MM-dd'),
    type: periodType,
    label: labelMap[periodType],
  }
}

function calculateWeekOverWeek(range: DateRange, periodType: PeriodType): ComparisonPeriod {
  const start = parseISO(range.start)
  const end = parseISO(range.end)
  const comparisonStart = subWeeks(start, 1)
  const comparisonEnd = subWeeks(end, 1)

  return {
    start: format(comparisonStart, 'yyyy-MM-dd'),
    end: format(comparisonEnd, 'yyyy-MM-dd'),
    type: periodType,
    label: '1 Week Ago',
  }
}

function calculateMonthOverMonth(range: DateRange, periodType: PeriodType): ComparisonPeriod {
  const start = parseISO(range.start)
  const end = parseISO(range.end)
  const comparisonStart = subMonths(start, 1)
  const comparisonEnd = subMonths(end, 1)

  const weeks = Math.round(differenceInDays(start, comparisonStart) / 7)

  return {
    start: format(comparisonStart, 'yyyy-MM-dd'),
    end: format(comparisonEnd, 'yyyy-MM-dd'),
    type: periodType,
    label: `${weeks} Weeks Ago`,
  }
}

function calculateQuarterOverQuarter(range: DateRange, periodType: PeriodType): ComparisonPeriod {
  const start = parseISO(range.start)
  const end = parseISO(range.end)
  const comparisonStart = subQuarters(start, 1)
  const comparisonEnd = subQuarters(end, 1)

  return {
    start: format(comparisonStart, 'yyyy-MM-dd'),
    end: format(comparisonEnd, 'yyyy-MM-dd'),
    type: periodType,
    label: '1 Quarter Ago',
  }
}

function calculateYearOverYear(range: DateRange, periodType: PeriodType): ComparisonPeriod {
  const start = parseISO(range.start)
  const end = parseISO(range.end)
  const comparisonStart = subYears(start, 1)
  const comparisonEnd = subYears(end, 1)

  const label = periodType === PeriodType.MONTHLY 
    ? 'Same Month Last Year'
    : periodType === PeriodType.QUARTERLY
    ? 'Same Quarter Last Year'
    : periodType === PeriodType.WEEKLY
    ? 'Same Week Last Year'
    : 'Same Period Last Year'

  return {
    start: format(comparisonStart, 'yyyy-MM-dd'),
    end: format(comparisonEnd, 'yyyy-MM-dd'),
    type: periodType,
    label,
  }
}