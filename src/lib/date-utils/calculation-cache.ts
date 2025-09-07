/**
 * Simple in-memory cache for date calculations
 * Uses LRU (Least Recently Used) eviction strategy
 */
export class CalculationCache<T = any> {
  private cache = new Map<string, { value: T; timestamp: number }>()
  private readonly maxSize: number
  private readonly ttl: number // Time to live in milliseconds

  constructor(maxSize: number = 100, ttl: number = 5 * 60 * 1000) { // 5 minutes default
    this.maxSize = maxSize
    this.ttl = ttl
  }

  /**
   * Get value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry.value
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T): void {
    // Remove oldest entry if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    })
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * Create a cache key from parameters
   */
  static createKey(...args: any[]): string {
    return JSON.stringify(args)
  }
}

// Global caches for different calculation types
export const comparisonCache = new CalculationCache(50, 10 * 60 * 1000) // 10 min TTL
export const periodDetectionCache = new CalculationCache(100, 30 * 60 * 1000) // 30 min TTL
export const validationCache = new CalculationCache(200, 5 * 60 * 1000) // 5 min TTL