import { describe, it, expect } from 'vitest'
import {
  generateSparklineData,
  generateSparklineFromDaily,
  generateTrendData,
  calculateComparison,
} from '../sparkline'

describe('generateSparklineData', () => {
  it('should return empty array for empty input', () => {
    expect(generateSparklineData([])).toEqual([])
    expect(generateSparklineData(null as any)).toEqual([])
    expect(generateSparklineData(undefined as any)).toEqual([])
  })

  it('should return all values when input length is less than target', () => {
    const timeSeries = [
      { date: '2025-01-01', value: 100 },
      { date: '2025-01-02', value: 200 },
      { date: '2025-01-03', value: 150 },
    ]
    
    const result = generateSparklineData(timeSeries, 20)
    expect(result).toEqual([100, 200, 150])
  })

  it('should generate exactly targetPoints when input is larger', () => {
    const timeSeries = Array.from({ length: 100 }, (_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, '0')}`,
      value: i * 10,
    }))
    
    const result = generateSparklineData(timeSeries, 20)
    expect(result).toHaveLength(20)
    expect(result[0]).toBe(0) // First point
    expect(result[result.length - 1]).toBe(990) // Last point
  })

  it('should evenly distribute points across the time series', () => {
    const timeSeries = [
      { date: '2025-01-01', value: 0 },
      { date: '2025-01-02', value: 10 },
      { date: '2025-01-03', value: 20 },
      { date: '2025-01-04', value: 30 },
      { date: '2025-01-05', value: 40 },
    ]
    
    const result = generateSparklineData(timeSeries, 3)
    expect(result).toEqual([0, 20, 40]) // First, middle, last
  })
})

describe('generateSparklineFromDaily', () => {
  it('should handle empty object', () => {
    expect(generateSparklineFromDaily({})).toEqual([])
  })

  it('should sort dates and generate sparkline', () => {
    const dailyData = {
      '2025-01-03': 300,
      '2025-01-01': 100,
      '2025-01-02': 200,
      '2025-01-04': 400,
    }
    
    const result = generateSparklineFromDaily(dailyData, 4)
    expect(result).toEqual([100, 200, 300, 400])
  })

  it('should handle date strings correctly', () => {
    const dailyData = {
      '2025-01-10': 1000,
      '2025-01-02': 200,
      '2025-01-20': 2000,
    }
    
    const result = generateSparklineFromDaily(dailyData, 3)
    expect(result).toEqual([200, 1000, 2000])
  })
})

describe('generateTrendData', () => {
  it('should return empty array for empty input', () => {
    expect(generateTrendData([])).toEqual([])
    expect(generateTrendData(null as any)).toEqual([])
    expect(generateTrendData(undefined as any)).toEqual([])
  })

  it('should return original values when smooth is false', () => {
    const values = [100, 200, 150, 300]
    expect(generateTrendData(values, false)).toEqual(values)
  })

  it('should return original values when length < 3', () => {
    const values = [100, 200]
    expect(generateTrendData(values, true)).toEqual(values)
  })

  it('should apply moving average when smooth is true', () => {
    const values = [100, 200, 150, 300, 250]
    const result = generateTrendData(values, true)
    
    expect(result[0]).toBe(100) // First value unchanged
    expect(result[1]).toBe(150) // (100 + 200 + 150) / 3
    expect(result[2]).toBe(216.66666666666666) // (200 + 150 + 300) / 3
    expect(result[3]).toBe(233.33333333333334) // (150 + 300 + 250) / 3
    expect(result[4]).toBe(250) // Last value unchanged
  })
})

describe('calculateComparison', () => {
  it('should calculate positive percentage change', () => {
    expect(calculateComparison(120, 100)).toBe(20)
    expect(calculateComparison(150, 100)).toBe(50)
  })

  it('should calculate negative percentage change', () => {
    expect(calculateComparison(80, 100)).toBe(-20)
    expect(calculateComparison(50, 100)).toBe(-50)
  })

  it('should handle zero previous value', () => {
    expect(calculateComparison(100, 0)).toBe(100)
    expect(calculateComparison(0, 0)).toBe(0)
  })

  it('should round to 1 decimal place', () => {
    expect(calculateComparison(333, 100)).toBe(233)
    expect(calculateComparison(100, 333)).toBe(-70)
    expect(calculateComparison(123.456, 100)).toBe(23.5)
  })

  it('should handle no change', () => {
    expect(calculateComparison(100, 100)).toBe(0)
  })
})