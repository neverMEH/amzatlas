import { useEffect, useRef } from 'react'
import { performanceTracker } from '@/lib/monitoring/performance-tracker'
import type { DateRange, ComparisonPeriod } from '@/lib/date-utils/types'

interface PerformanceMetrics {
  calculationTime: number
  apiCallTime?: number
  renderTime: number
  totalTime: number
}

export function usePerformanceSuggestions(
  dateRange: DateRange,
  enabled: boolean = true
) {
  const metricsRef = useRef<PerformanceMetrics>({
    calculationTime: 0,
    apiCallTime: 0,
    renderTime: 0,
    totalTime: 0,
  })
  const startTimeRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled) return

    startTimeRef.current = performance.now()
    performanceTracker.startTimer('suggestions.total')

    return () => {
      const totalTime = performance.now() - startTimeRef.current
      metricsRef.current.totalTime = totalTime
      performanceTracker.endTimer('suggestions.total', {
        dateRange,
        ...metricsRef.current,
      })

      // Log if performance is poor
      if (totalTime > 500) {
        console.warn(`Slow suggestion generation: ${totalTime.toFixed(2)}ms`, {
          metrics: metricsRef.current,
          dateRange,
        })
      }
    }
  }, [dateRange, enabled])

  const trackCalculation = () => {
    performanceTracker.startTimer('suggestions.calculation')
    return () => {
      const time = performanceTracker.endTimer('suggestions.calculation')
      metricsRef.current.calculationTime = time
    }
  }

  const trackApiCall = () => {
    performanceTracker.startTimer('suggestions.api')
    return () => {
      const time = performanceTracker.endTimer('suggestions.api')
      metricsRef.current.apiCallTime = time
    }
  }

  const trackRender = () => {
    performanceTracker.startTimer('suggestions.render')
    return () => {
      const time = performanceTracker.endTimer('suggestions.render')
      metricsRef.current.renderTime = time
    }
  }

  return {
    trackCalculation,
    trackApiCall,
    trackRender,
    metrics: metricsRef.current,
  }
}