/**
 * Utility functions for generating sparkline data from time series
 */

export interface TimeSeriesPoint {
  date: string
  value: number
}

/**
 * Generate evenly distributed data points from a time series
 * @param timeSeries - Array of time series data points
 * @param targetPoints - Number of points to generate (default: 20)
 * @returns Array of values for sparkline visualization
 */
export function generateSparklineData(
  timeSeries: TimeSeriesPoint[],
  targetPoints: number = 20
): number[] {
  if (!timeSeries || timeSeries.length === 0) {
    return []
  }

  // If we have fewer points than target, return all values
  if (timeSeries.length <= targetPoints) {
    return timeSeries.map(point => point.value)
  }

  // Calculate step size for even distribution
  const step = (timeSeries.length - 1) / (targetPoints - 1)
  const sparklineData: number[] = []

  for (let i = 0; i < targetPoints; i++) {
    const index = Math.round(i * step)
    sparklineData.push(timeSeries[index].value)
  }

  return sparklineData
}

/**
 * Generate sparkline data from aggregated daily values
 * @param dailyData - Object with date keys and numeric values
 * @param targetPoints - Number of points to generate (default: 20)
 * @returns Array of values for sparkline visualization
 */
export function generateSparklineFromDaily(
  dailyData: Record<string, number>,
  targetPoints: number = 20
): number[] {
  // Convert object to sorted array
  const timeSeries = Object.entries(dailyData)
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return generateSparklineData(timeSeries, targetPoints)
}

/**
 * Generate trend data for KPI sparklines from raw metric values
 * @param values - Array of metric values over time
 * @param smooth - Whether to apply smoothing (moving average)
 * @returns Processed array for sparkline visualization
 */
export function generateTrendData(values: number[], smooth: boolean = false): number[] {
  if (!values || values.length === 0) {
    return []
  }

  if (!smooth || values.length < 3) {
    return values
  }

  // Apply simple moving average with window of 3
  const smoothed: number[] = []
  for (let i = 0; i < values.length; i++) {
    if (i === 0 || i === values.length - 1) {
      smoothed.push(values[i])
    } else {
      const avg = (values[i - 1] + values[i] + values[i + 1]) / 3
      smoothed.push(avg)
    }
  }

  return smoothed
}

/**
 * Calculate the comparison percentage between two periods
 * @param current - Current period value
 * @param previous - Previous period value
 * @returns Percentage change rounded to 1 decimal place
 */
export function calculateComparison(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0
  }

  const change = ((current - previous) / previous) * 100
  return Math.round(change * 10) / 10 // Round to 1 decimal place
}