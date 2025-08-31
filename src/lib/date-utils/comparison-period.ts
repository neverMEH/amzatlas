// Main export file for comparison period utilities

export * from './types'
export * from './period-detector'
export * from './comparison-calculator'
export * from './edge-cases'
export * from './period-labels'
export * from './validation'

// Re-export main functions for convenience
export { detectPeriodType } from './period-detector'
export { calculateComparisonPeriod } from './comparison-calculator'
export { getComparisonLabel, formatDateRange } from './period-labels'
export { isValidComparisonPeriod, validateComparisonPeriod } from './validation'