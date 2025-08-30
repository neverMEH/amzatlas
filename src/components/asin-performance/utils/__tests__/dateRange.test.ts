import { describe, it, expect } from 'vitest'
import {
  calculateDateRangeDuration,
  getChartTypeFromDateRange,
  getChartTypeFromData,
} from '../dateRange'
import type { ChartType } from '../../types'

describe('dateRange utilities', () => {
  describe('calculateDateRangeDuration', () => {
    it('should calculate duration for same day', () => {
      const duration = calculateDateRangeDuration('2024-01-01', '2024-01-01')
      expect(duration).toBe(1)
    })

    it('should calculate duration for 7 days', () => {
      const duration = calculateDateRangeDuration('2024-01-01', '2024-01-07')
      expect(duration).toBe(7)
    })

    it('should calculate duration for multiple weeks', () => {
      const duration = calculateDateRangeDuration('2024-01-01', '2024-01-14')
      expect(duration).toBe(14)
    })

    it('should handle Date objects', () => {
      const start = new Date('2024-01-01')
      const end = new Date('2024-01-07')
      const duration = calculateDateRangeDuration(start, end)
      expect(duration).toBe(7)
    })

    it('should handle mixed string and Date inputs', () => {
      const start = '2024-01-01'
      const end = new Date('2024-01-07')
      const duration = calculateDateRangeDuration(start, end)
      expect(duration).toBe(7)
    })
  })

  describe('getChartTypeFromDateRange', () => {
    it('should return bar for 1 day', () => {
      const chartType = getChartTypeFromDateRange('2024-01-01', '2024-01-01')
      expect(chartType).toBe('bar')
    })

    it('should return bar for exactly 7 days', () => {
      const chartType = getChartTypeFromDateRange('2024-01-01', '2024-01-07')
      expect(chartType).toBe('bar')
    })

    it('should return bar for less than 7 days', () => {
      const chartType = getChartTypeFromDateRange('2024-01-01', '2024-01-05')
      expect(chartType).toBe('bar')
    })

    it('should return line for 8 days', () => {
      const chartType = getChartTypeFromDateRange('2024-01-01', '2024-01-08')
      expect(chartType).toBe('line')
    })

    it('should return line for multiple weeks', () => {
      const chartType = getChartTypeFromDateRange('2024-01-01', '2024-01-31')
      expect(chartType).toBe('line')
    })

    it('should handle partial weeks correctly', () => {
      // Wednesday to Tuesday (7 days)
      const chartType = getChartTypeFromDateRange('2024-01-03', '2024-01-09')
      expect(chartType).toBe('bar')
    })
  })

  describe('getChartTypeFromData', () => {
    it('should return line for empty data', () => {
      const chartType = getChartTypeFromData([])
      expect(chartType).toBe('line')
    })

    it('should return bar for single data point', () => {
      const chartType = getChartTypeFromData([{ date: '2024-01-01' }])
      expect(chartType).toBe('bar')
    })

    it('should return line for 2 data points', () => {
      const chartType = getChartTypeFromData([
        { date: '2024-01-01' },
        { date: '2024-01-08' },
      ])
      expect(chartType).toBe('line')
    })

    it('should return line for many data points', () => {
      const data = Array.from({ length: 10 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      }))
      const chartType = getChartTypeFromData(data)
      expect(chartType).toBe('line')
    })
  })

  describe('ChartType type', () => {
    it('should only allow valid chart types', () => {
      const validTypes: ChartType[] = ['line', 'bar']
      expect(validTypes).toHaveLength(2)
    })
  })
})