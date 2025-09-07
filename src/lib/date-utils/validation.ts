import { parseISO, isAfter, isBefore, isEqual, differenceInDays } from 'date-fns'
import { DateRange, ComparisonPeriod } from './types'

/**
 * Validates that a comparison period is appropriate for the main period
 */
export function isValidComparisonPeriod(
  mainRange: DateRange,
  comparison: ComparisonPeriod
): boolean {
  try {
    const mainStart = parseISO(mainRange.start)
    const mainEnd = parseISO(mainRange.end)
    const compStart = parseISO(comparison.start)
    const compEnd = parseISO(comparison.end)
    
    // Check if dates are valid
    if (
      isNaN(mainStart.getTime()) ||
      isNaN(mainEnd.getTime()) ||
      isNaN(compStart.getTime()) ||
      isNaN(compEnd.getTime())
    ) {
      return false
    }
    
    // Comparison period should not overlap with main period
    if (isOverlapping(mainRange, comparison)) {
      return false
    }
    
    // Comparison period should be before main period (for historical comparison)
    if (isAfter(compStart, mainStart) || isAfter(compEnd, mainEnd)) {
      return false
    }
    
    // Check for reasonable date ranges (not too far in the past)
    const daysBetween = differenceInDays(mainStart, compEnd)
    if (daysBetween > 365 * 2) {
      // More than 2 years between periods might be unreasonable
      return false
    }
    
    return true
  } catch {
    return false
  }
}

/**
 * Checks if two date ranges overlap
 */
export function isOverlapping(range1: DateRange, range2: DateRange): boolean {
  const start1 = parseISO(range1.start)
  const end1 = parseISO(range1.end)
  const start2 = parseISO(range2.start)
  const end2 = parseISO(range2.end)
  
  // Allow adjacent periods (where one ends the day before the other starts)
  // Check if range2 ends exactly one day before range1 starts
  const daysBetweenEnd2Start1 = differenceInDays(start1, end2)
  if (daysBetweenEnd2Start1 === 1) {
    return false // Adjacent periods are OK (range2 before range1)
  }
  
  // Check if range1 ends exactly one day before range2 starts
  const daysBetweenEnd1Start2 = differenceInDays(start2, end1)
  if (daysBetweenEnd1Start2 === 1) {
    return false // Adjacent periods are OK (range1 before range2)
  }
  
  // Check if range1 starts during range2
  if ((isAfter(start1, start2) || isEqual(start1, start2)) && 
      (isBefore(start1, end2) || isEqual(start1, end2))) {
    return true
  }
  
  // Check if range1 ends during range2
  if ((isAfter(end1, start2) || isEqual(end1, start2)) && 
      (isBefore(end1, end2) || isEqual(end1, end2))) {
    return true
  }
  
  // Check if range1 completely contains range2
  if ((isBefore(start1, start2) || isEqual(start1, start2)) && 
      (isAfter(end1, end2) || isEqual(end1, end2))) {
    return true
  }
  
  // Check if range2 completely contains range1
  if ((isBefore(start2, start1) || isEqual(start2, start1)) && 
      (isAfter(end2, end1) || isEqual(end2, end1))) {
    return true
  }
  
  return false
}

/**
 * Validates comparison period constraints
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function validateComparisonPeriod(
  mainRange: DateRange,
  comparison: ComparisonPeriod
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Basic validation
  if (!isValidComparisonPeriod(mainRange, comparison)) {
    if (isOverlapping(mainRange, comparison)) {
      errors.push('Comparison period overlaps with the main period')
    }
    
    const compStart = parseISO(comparison.start)
    const mainStart = parseISO(mainRange.start)
    
    if (isAfter(compStart, mainStart)) {
      errors.push('Comparison period must be before the main period')
    }
  }
  
  // Check period durations
  const mainDuration = differenceInDays(parseISO(mainRange.end), parseISO(mainRange.start)) + 1
  const compDuration = differenceInDays(parseISO(comparison.end), parseISO(comparison.start)) + 1
  
  if (Math.abs(mainDuration - compDuration) > 1) {
    warnings.push(`Period durations differ: ${mainDuration} days vs ${compDuration} days`)
  }
  
  // Check for very old comparisons
  const daysBetween = differenceInDays(parseISO(mainRange.start), parseISO(comparison.end))
  if (daysBetween > 365) {
    warnings.push('Comparison period is more than 1 year old')
  }
  
  // Check for data availability concerns
  const compEnd = parseISO(comparison.end)
  const twoYearsAgo = new Date()
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
  
  if (isBefore(compEnd, twoYearsAgo)) {
    warnings.push('Comparison period may have limited data availability')
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Suggests alternative comparison periods if the current one is invalid
 */
export function suggestAlternativeComparisons(
  mainRange: DateRange,
  invalidComparison: ComparisonPeriod
): ComparisonPeriod[] {
  const suggestions: ComparisonPeriod[] = []
  const mainDuration = differenceInDays(parseISO(mainRange.end), parseISO(mainRange.start)) + 1
  
  // Suggest period immediately before main range
  const immediatelyBefore: ComparisonPeriod = {
    start: new Date(parseISO(mainRange.start).getTime() - mainDuration * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0],
    end: new Date(parseISO(mainRange.start).getTime() - 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0],
    type: invalidComparison.type,
    label: 'Previous Period',
  }
  
  if (isValidComparisonPeriod(mainRange, immediatelyBefore)) {
    suggestions.push(immediatelyBefore)
  }
  
  // Suggest same period last month
  const lastMonth = new Date(parseISO(mainRange.start))
  lastMonth.setMonth(lastMonth.getMonth() - 1)
  const lastMonthEnd = new Date(parseISO(mainRange.end))
  lastMonthEnd.setMonth(lastMonthEnd.getMonth() - 1)
  
  const sameLastMonth: ComparisonPeriod = {
    start: lastMonth.toISOString().split('T')[0],
    end: lastMonthEnd.toISOString().split('T')[0],
    type: invalidComparison.type,
    label: 'Same Period Last Month',
  }
  
  if (isValidComparisonPeriod(mainRange, sameLastMonth)) {
    suggestions.push(sameLastMonth)
  }
  
  // Suggest same period last year
  const lastYear = new Date(parseISO(mainRange.start))
  lastYear.setFullYear(lastYear.getFullYear() - 1)
  const lastYearEnd = new Date(parseISO(mainRange.end))
  lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1)
  
  const sameLastYear: ComparisonPeriod = {
    start: lastYear.toISOString().split('T')[0],
    end: lastYearEnd.toISOString().split('T')[0],
    type: invalidComparison.type,
    label: 'Same Period Last Year',
  }
  
  if (isValidComparisonPeriod(mainRange, sameLastYear)) {
    suggestions.push(sameLastYear)
  }
  
  return suggestions
}