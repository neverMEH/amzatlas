import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { 
  calculateComparisonPeriod,
  detectPeriodType,
  isValidComparisonPeriod,
} from '@/lib/date-utils/comparison-period'
import { comparisonCache, periodDetectionCache, validationCache } from '@/lib/date-utils/calculation-cache'
import { performanceTracker } from '@/lib/monitoring/performance-tracker'

describe('Optimized Comparison Performance', () => {
  beforeEach(() => {
    // Clear caches before each test
    comparisonCache.clear()
    periodDetectionCache.clear()
    validationCache.clear()
    performanceTracker.clear()
    performanceTracker.setEnabled(true)
  })

  afterEach(() => {
    // Log performance summary after each test
    const summary = performanceTracker.getSummary()
    console.log('Performance Summary:', summary)
  })

  it('should demonstrate cache effectiveness', () => {
    const range = { start: '2024-07-29', end: '2024-08-04' }
    
    // First call - no cache
    const start1 = performance.now()
    const result1 = calculateComparisonPeriod(range, 'period-over-period')
    const time1 = performance.now() - start1
    
    // Second call - should use cache
    const start2 = performance.now()
    const result2 = calculateComparisonPeriod(range, 'period-over-period')
    const time2 = performance.now() - start2
    
    // Cache should make second call much faster
    expect(time2).toBeLessThan(time1 * 0.1) // At least 10x faster
    expect(result2).toEqual(result1)
    
    console.log(`First call: ${time1.toFixed(2)}ms, Cached call: ${time2.toFixed(2)}ms`)
    console.log(`Cache speedup: ${(time1 / time2).toFixed(1)}x`)
  })

  it('should handle concurrent calculations efficiently', async () => {
    const ranges = [
      { start: '2024-01-01', end: '2024-01-07' },
      { start: '2024-02-01', end: '2024-02-29' },
      { start: '2024-03-01', end: '2024-03-31' },
      { start: '2024-04-01', end: '2024-06-30' },
      { start: '2024-07-01', end: '2024-12-31' },
    ]
    
    const startTime = performance.now()
    
    // Simulate concurrent calculations
    const promises = ranges.flatMap(range => [
      Promise.resolve(detectPeriodType(range)),
      Promise.resolve(calculateComparisonPeriod(range, 'auto')),
      Promise.resolve(calculateComparisonPeriod(range, 'period-over-period')),
      Promise.resolve(calculateComparisonPeriod(range, 'year-over-year')),
    ])
    
    const results = await Promise.all(promises)
    const endTime = performance.now()
    const duration = endTime - startTime
    
    expect(results).toHaveLength(20)
    expect(duration).toBeLessThan(50) // Should complete quickly
    
    console.log(`Concurrent calculations (${promises.length} operations): ${duration.toFixed(2)}ms`)
  })

  it('should maintain performance with cache hits', () => {
    const testData = [
      { start: '2024-07-29', end: '2024-08-04' },
      { start: '2024-07-22', end: '2024-07-28' },
      { start: '2024-07-15', end: '2024-07-21' },
    ]
    
    // Warm up cache
    testData.forEach(range => {
      calculateComparisonPeriod(range, 'period-over-period')
      detectPeriodType(range)
    })
    
    const startTime = performance.now()
    
    // Test with cache hits
    for (let i = 0; i < 100; i++) {
      testData.forEach(range => {
        calculateComparisonPeriod(range, 'period-over-period')
        detectPeriodType(range)
      })
    }
    
    const endTime = performance.now()
    const duration = endTime - startTime
    
    // 600 operations (100 iterations * 3 ranges * 2 operations)
    const opsPerSecond = 600 / (duration / 1000)
    
    expect(opsPerSecond).toBeGreaterThan(10000) // Should handle >10k ops/second with cache
    console.log(`Cache hit performance: ${opsPerSecond.toFixed(0)} ops/second`)
  })

  it('should track performance metrics accurately', () => {
    // Clear cache to ensure all operations are tracked
    comparisonCache.clear()
    periodDetectionCache.clear()
    
    // Perform several operations with different ranges to avoid cache hits
    for (let i = 0; i < 10; i++) {
      const range = { start: `2024-07-${i + 1}`, end: `2024-07-${i + 7}` }
      detectPeriodType(range)
      calculateComparisonPeriod(range, 'auto')
    }
    
    const summary = performanceTracker.getSummary()
    
    // Check that metrics were tracked
    expect(summary['detectPeriodType']).toBeDefined()
    expect(summary['calculateComparisonPeriod']).toBeDefined()
    
    // Verify metric properties
    const detectMetrics = summary['detectPeriodType']
    expect(detectMetrics.count).toBe(10)
    expect(detectMetrics.avg).toBeGreaterThan(0)
    expect(detectMetrics.min).toBeLessThanOrEqual(detectMetrics.avg)
    expect(detectMetrics.max).toBeGreaterThanOrEqual(detectMetrics.avg)
    
    console.log('Performance metrics:', {
      detectPeriodType: {
        avg: `${detectMetrics.avg.toFixed(2)}ms`,
        min: `${detectMetrics.min.toFixed(2)}ms`,
        max: `${detectMetrics.max.toFixed(2)}ms`,
        count: detectMetrics.count,
      },
    })
  })

  it('should handle cache eviction gracefully', () => {
    // Fill cache to capacity
    const maxSize = 50 // comparisonCache max size
    
    for (let i = 0; i < maxSize + 10; i++) {
      const range = { start: `2024-01-${(i % 28) + 1}`, end: `2024-01-${(i % 28) + 2}` }
      calculateComparisonPeriod(range, 'auto')
    }
    
    // Cache should not exceed max size
    expect(comparisonCache.size).toBeLessThanOrEqual(maxSize)
    
    console.log(`Cache size after overflow: ${comparisonCache.size}/${maxSize}`)
  })

  it('should optimize batch operations', () => {
    const ranges = Array.from({ length: 50 }, (_, i) => ({
      start: `2024-${String(Math.floor(i / 4) + 1).padStart(2, '0')}-01`,
      end: `2024-${String(Math.floor(i / 4) + 1).padStart(2, '0')}-07`,
    }))
    
    const startTime = performance.now()
    
    // Batch process all ranges
    const results = ranges.map(range => ({
      range,
      periodType: detectPeriodType(range),
      comparison: calculateComparisonPeriod(range, 'auto'),
      validation: isValidComparisonPeriod(range, calculateComparisonPeriod(range, 'period-over-period')),
    }))
    
    const endTime = performance.now()
    const duration = endTime - startTime
    const avgTimePerRange = duration / ranges.length
    
    expect(results).toHaveLength(50)
    expect(avgTimePerRange).toBeLessThan(2) // Less than 2ms per range
    
    console.log(`Batch processing: ${duration.toFixed(2)}ms total, ${avgTimePerRange.toFixed(2)}ms per range`)
  })
})