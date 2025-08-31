import { describe, it, expect, beforeEach } from 'vitest'
import { 
  calculateComparisonPeriod,
  detectPeriodType,
  isValidComparisonPeriod,
  getComparisonLabel,
  formatDateRange,
} from '@/lib/date-utils/comparison-period'

describe('Comparison Calculation Performance', () => {
  const testCases = [
    { start: '2024-01-01', end: '2024-01-07', label: 'Week' },
    { start: '2024-01-01', end: '2024-01-31', label: 'Month' },
    { start: '2024-01-01', end: '2024-03-31', label: 'Quarter' },
    { start: '2024-01-01', end: '2024-12-31', label: 'Year' },
    { start: '2024-01-01', end: '2024-01-15', label: 'Custom' },
  ]

  it('should calculate comparisons quickly for all period types', () => {
    const startTime = performance.now()
    
    testCases.forEach(testCase => {
      const range = { start: testCase.start, end: testCase.end }
      
      // Test all comparison modes
      const modes = ['auto', 'period-over-period', 'month-over-month', 'year-over-year'] as const
      modes.forEach(mode => {
        const comparison = calculateComparisonPeriod(range, mode)
        expect(comparison).toBeDefined()
      })
    })
    
    const endTime = performance.now()
    const duration = endTime - startTime
    
    // Should complete all calculations in under 10ms
    expect(duration).toBeLessThan(10)
    console.log(`All comparison calculations completed in ${duration.toFixed(2)}ms`)
  })

  it('should detect period types efficiently', () => {
    const startTime = performance.now()
    
    // Run detection 1000 times
    for (let i = 0; i < 1000; i++) {
      testCases.forEach(testCase => {
        const range = { start: testCase.start, end: testCase.end }
        const periodType = detectPeriodType(range)
        expect(periodType).toBeDefined()
      })
    }
    
    const endTime = performance.now()
    const duration = endTime - startTime
    
    // Should complete 5000 detections in under 50ms
    expect(duration).toBeLessThan(50)
    console.log(`5000 period detections completed in ${duration.toFixed(2)}ms`)
  })

  it('should validate comparison periods quickly', () => {
    const mainRange = { start: '2024-07-29', end: '2024-08-04' }
    const comparisons = [
      { start: '2024-07-22', end: '2024-07-28', type: 'weekly' as const, label: 'Previous Week' },
      { start: '2024-06-29', end: '2024-07-05', type: 'weekly' as const, label: 'Last Month' },
      { start: '2023-07-31', end: '2023-08-06', type: 'weekly' as const, label: 'Last Year' },
    ]
    
    const startTime = performance.now()
    
    // Validate 1000 times
    for (let i = 0; i < 1000; i++) {
      comparisons.forEach(comparison => {
        const isValid = isValidComparisonPeriod(mainRange, comparison)
        expect(typeof isValid).toBe('boolean')
      })
    }
    
    const endTime = performance.now()
    const duration = endTime - startTime
    
    // Should complete 3000 validations in under 30ms
    expect(duration).toBeLessThan(30)
    console.log(`3000 period validations completed in ${duration.toFixed(2)}ms`)
  })

  it('should format date ranges efficiently', () => {
    const comparisons = [
      { start: '2024-07-22', end: '2024-07-28', type: 'weekly' as const, label: 'Previous Week' },
      { start: '2024-06-29', end: '2024-07-05', type: 'weekly' as const, label: 'Last Month' },
      { start: '2023-07-31', end: '2023-08-06', type: 'weekly' as const, label: 'Last Year' },
    ]
    
    const startTime = performance.now()
    
    // Format 1000 times
    for (let i = 0; i < 1000; i++) {
      comparisons.forEach(comparison => {
        const formatted = formatDateRange(comparison)
        expect(formatted).toBeDefined()
        
        const label = getComparisonLabel(comparison)
        expect(label).toBeDefined()
      })
    }
    
    const endTime = performance.now()
    const duration = endTime - startTime
    
    // Should complete 6000 formatting operations in under 100ms
    expect(duration).toBeLessThan(100)
    console.log(`6000 formatting operations completed in ${duration.toFixed(2)}ms`)
  })

  it('should handle edge cases efficiently', () => {
    const edgeCases = [
      { start: '2024-02-29', end: '2024-02-29' }, // Leap year single day
      { start: '2024-01-01', end: '2024-01-01' }, // Single day
      { start: '2024-12-25', end: '2024-12-31' }, // Holiday period
      { start: '2024-01-01', end: '2025-12-31' }, // Multi-year
    ]
    
    const startTime = performance.now()
    
    edgeCases.forEach(range => {
      const periodType = detectPeriodType(range)
      const comparison = calculateComparisonPeriod(range, 'auto')
      const isValid = isValidComparisonPeriod(range, comparison)
      
      expect(periodType).toBeDefined()
      expect(comparison).toBeDefined()
      expect(typeof isValid).toBe('boolean')
    })
    
    const endTime = performance.now()
    const duration = endTime - startTime
    
    // Edge cases should be handled quickly
    expect(duration).toBeLessThan(5)
    console.log(`Edge cases handled in ${duration.toFixed(2)}ms`)
  })

  it('should cache repeated calculations efficiently', () => {
    const range = { start: '2024-07-29', end: '2024-08-04' }
    const results: any[] = []
    
    const startTime = performance.now()
    
    // Calculate the same comparison 1000 times
    for (let i = 0; i < 1000; i++) {
      const comparison = calculateComparisonPeriod(range, 'period-over-period')
      results.push(comparison)
    }
    
    const endTime = performance.now()
    const duration = endTime - startTime
    
    // Should handle repeated calculations efficiently
    expect(duration).toBeLessThan(20)
    console.log(`1000 repeated calculations completed in ${duration.toFixed(2)}ms`)
    
    // All results should be identical
    const firstResult = JSON.stringify(results[0])
    results.forEach(result => {
      expect(JSON.stringify(result)).toBe(firstResult)
    })
  })
})