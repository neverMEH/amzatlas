import { differenceInDays, parseISO } from 'date-fns'
import type { ChartType } from '../types'

/**
 * Calculate the number of days between two dates
 * @param startDate - Start date (ISO string or Date)
 * @param endDate - End date (ISO string or Date)
 * @returns Number of days between dates (inclusive)
 */
export function calculateDateRangeDuration(
  startDate: string | Date,
  endDate: string | Date
): number {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate
  
  // Add 1 to make it inclusive of both start and end dates
  return differenceInDays(end, start) + 1
}

/**
 * Determine the appropriate chart type based on date range duration
 * @param startDate - Start date (ISO string or Date)
 * @param endDate - End date (ISO string or Date)
 * @returns 'bar' for 7 days or less, 'line' for longer periods
 */
export function getChartTypeFromDateRange(
  startDate: string | Date,
  endDate: string | Date
): ChartType {
  const duration = calculateDateRangeDuration(startDate, endDate)
  return duration <= 7 ? 'bar' : 'line'
}

/**
 * Determine chart type from time series data when date range not available
 * @param data - Array of time series data points
 * @returns 'bar' for 7 or fewer data points, 'line' for more
 */
export function getChartTypeFromData(
  data: Array<{ date: string }>
): ChartType {
  if (!data || data.length === 0) return 'line'
  
  // If we have 7 or fewer data points, use bar chart
  // This handles weekly aggregated data where each point represents a week
  return data.length <= 1 ? 'bar' : 'line'
}