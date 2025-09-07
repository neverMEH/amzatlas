/**
 * Performance tracking utilities for smart comparison feature
 */

interface PerformanceMetric {
  operation: string
  duration: number
  timestamp: number
  metadata?: Record<string, any>
}

class PerformanceTracker {
  private metrics: PerformanceMetric[] = []
  private timers: Map<string, number> = new Map()
  private enabled: boolean = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'

  /**
   * Start timing an operation
   */
  startTimer(operation: string): void {
    if (!this.enabled) return
    this.timers.set(operation, performance.now())
  }

  /**
   * End timing and record the metric
   */
  endTimer(operation: string, metadata?: Record<string, any>): number {
    if (!this.enabled) return 0

    const startTime = this.timers.get(operation)
    if (!startTime) {
      console.warn(`No start time found for operation: ${operation}`)
      return 0
    }

    const duration = performance.now() - startTime
    this.timers.delete(operation)

    this.recordMetric({
      operation,
      duration,
      timestamp: Date.now(),
      metadata,
    })

    return duration
  }

  /**
   * Record a performance metric
   */
  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric)

    // Log slow operations
    if (metric.duration > 100) {
      console.warn(`Slow operation detected: ${metric.operation} took ${metric.duration.toFixed(2)}ms`)
    }

    // Keep only last 100 metrics in memory
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100)
    }
  }

  /**
   * Get performance summary
   */
  getSummary(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const summary: Record<string, { avg: number; min: number; max: number; count: number }> = {}

    this.metrics.forEach(metric => {
      if (!summary[metric.operation]) {
        summary[metric.operation] = {
          avg: 0,
          min: Infinity,
          max: -Infinity,
          count: 0,
        }
      }

      const op = summary[metric.operation]
      op.count++
      op.min = Math.min(op.min, metric.duration)
      op.max = Math.max(op.max, metric.duration)
      op.avg = ((op.avg * (op.count - 1)) + metric.duration) / op.count
    })

    return summary
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = []
    this.timers.clear()
  }

  /**
   * Enable or disable tracking
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }
}

// Singleton instance
export const performanceTracker = new PerformanceTracker()

// Decorator for automatic performance tracking
export function trackPerformance(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value

  descriptor.value = async function (...args: any[]) {
    const operation = `${target.constructor.name}.${propertyKey}`
    performanceTracker.startTimer(operation)
    
    try {
      const result = await originalMethod.apply(this, args)
      performanceTracker.endTimer(operation)
      return result
    } catch (error) {
      performanceTracker.endTimer(operation, { error: true })
      throw error
    }
  }

  return descriptor
}

// React hook for performance tracking
export function usePerformanceTracking(componentName: string) {
  const trackRender = () => {
    performanceTracker.startTimer(`${componentName}.render`)
    return () => {
      performanceTracker.endTimer(`${componentName}.render`)
    }
  }

  const trackOperation = (operation: string) => {
    const fullOperation = `${componentName}.${operation}`
    performanceTracker.startTimer(fullOperation)
    
    return () => {
      performanceTracker.endTimer(fullOperation)
    }
  }

  return { trackRender, trackOperation }
}