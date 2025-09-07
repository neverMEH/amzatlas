import { format, parseISO, differenceInDays } from 'date-fns'
import { ComparisonPeriod, PeriodType, DateRange } from './types'

/**
 * Generates a user-friendly label for a comparison period
 */
export function getComparisonLabel(comparison: ComparisonPeriod): string {
  const prefix = 'vs. '
  
  // For standard period types, use the label directly
  if (comparison.type !== PeriodType.CUSTOM) {
    return prefix + comparison.label
  }
  
  // For custom periods, format the date range
  const start = parseISO(comparison.start)
  const end = parseISO(comparison.end)
  const duration = differenceInDays(end, start) + 1
  
  // If it's a single day
  if (duration === 1) {
    return prefix + format(start, 'MMM d, yyyy')
  }
  
  // If within the same month
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return prefix + format(start, 'MMM d') + ' - ' + format(end, 'MMM d, yyyy')
  }
  
  // If within the same year
  if (start.getFullYear() === end.getFullYear()) {
    return prefix + format(start, 'MMM d') + ' - ' + format(end, 'MMM d, yyyy')
  }
  
  // Different years
  return prefix + format(start, 'MMM d, yyyy') + ' - ' + format(end, 'MMM d, yyyy')
}

/**
 * Generates a short label for UI elements with limited space
 */
export function getShortComparisonLabel(comparison: ComparisonPeriod): string {
  switch (comparison.type) {
    case PeriodType.DAILY:
      return 'vs. Yesterday'
    case PeriodType.WEEKLY:
      return 'vs. Last Week'
    case PeriodType.BI_WEEKLY:
      return 'vs. 2 Weeks Ago'
    case PeriodType.MONTHLY:
      return 'vs. Last Month'
    case PeriodType.QUARTERLY:
      return 'vs. Last Quarter'
    case PeriodType.YEARLY:
      return 'vs. Last Year'
    case PeriodType.CUSTOM:
      const duration = differenceInDays(parseISO(comparison.end), parseISO(comparison.start)) + 1
      return `vs. ${duration}d ago`
  }
}

/**
 * Formats a date range into a readable string
 */
export function formatDateRange(range: DateRange): string {
  const start = parseISO(range.start)
  const end = parseISO(range.end)
  
  // Same day
  if (range.start === range.end) {
    return format(start, 'MMM d, yyyy')
  }
  
  // Same month and year
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return format(start, 'MMM d') + ' - ' + format(end, 'd, yyyy')
  }
  
  // Same year
  if (start.getFullYear() === end.getFullYear()) {
    return format(start, 'MMM d') + ' - ' + format(end, 'MMM d, yyyy')
  }
  
  // Different years
  return format(start, 'MMM d, yyyy') + ' - ' + format(end, 'MMM d, yyyy')
}

/**
 * Generates a description of the comparison for tooltips and help text
 */
export function getComparisonDescription(
  mainRange: DateRange,
  comparison: ComparisonPeriod
): string {
  const mainLabel = formatDateRange(mainRange)
  const comparisonLabel = formatDateRange(comparison)
  
  switch (comparison.type) {
    case PeriodType.DAILY:
      return `Comparing ${mainLabel} with the previous day (${comparisonLabel})`
    case PeriodType.WEEKLY:
      return `Comparing ${mainLabel} with the previous week (${comparisonLabel})`
    case PeriodType.BI_WEEKLY:
      return `Comparing ${mainLabel} with the previous 2-week period (${comparisonLabel})`
    case PeriodType.MONTHLY:
      return `Comparing ${mainLabel} with the previous month (${comparisonLabel})`
    case PeriodType.QUARTERLY:
      return `Comparing ${mainLabel} with the previous quarter (${comparisonLabel})`
    case PeriodType.YEARLY:
      return `Comparing ${mainLabel} with the same period last year (${comparisonLabel})`
    case PeriodType.CUSTOM:
      const days = differenceInDays(parseISO(comparison.end), parseISO(comparison.start)) + 1
      return `Comparing ${mainLabel} with the previous ${days}-day period (${comparisonLabel})`
  }
}

/**
 * Gets period-specific icons for UI display
 */
export function getPeriodIcon(periodType: PeriodType): string {
  switch (periodType) {
    case PeriodType.DAILY:
      return '📅' // Calendar
    case PeriodType.WEEKLY:
      return '📊' // Bar chart
    case PeriodType.BI_WEEKLY:
      return '📈' // Chart increasing
    case PeriodType.MONTHLY:
      return '📆' // Tear-off calendar
    case PeriodType.QUARTERLY:
      return '🗓️' // Spiral calendar
    case PeriodType.YEARLY:
      return '📍' // Pushpin (marking a year)
    case PeriodType.CUSTOM:
      return '🔢' // Numbers
  }
}

/**
 * Generates preset labels for the date picker dropdown
 */
export function getPresetLabel(periodType: PeriodType, duration?: number): string {
  switch (periodType) {
    case PeriodType.DAILY:
      return 'Today'
    case PeriodType.WEEKLY:
      return 'Last 7 days'
    case PeriodType.BI_WEEKLY:
      return 'Last 14 days'
    case PeriodType.MONTHLY:
      return duration === 30 ? 'Last 30 days' : 'This month'
    case PeriodType.QUARTERLY:
      return 'This quarter'
    case PeriodType.YEARLY:
      return 'This year'
    case PeriodType.CUSTOM:
      return duration ? `Last ${duration} days` : 'Custom range'
  }
}