import { describe, it, expect } from 'vitest'
import {
  calculateComparisonPeriod,
  validateComparisonPeriod,
  getComparisonOptions,
  formatComparisonLabel,
} from '../utils/comparisonPeriod'
import { PeriodType } from '../types'

describe('Comparison Period Calculations', () => {
  describe('calculateComparisonPeriod', () => {
    it('calculates previous week correctly', () => {
      const result = calculateComparisonPeriod({
        startDate: '2025-08-24', // Sunday
        endDate: '2025-08-30',   // Saturday
        periodType: 'week',
        comparisonType: 'previous',
      })

      expect(result).toEqual({
        startDate: '2025-08-17',
        endDate: '2025-08-23',
      })
    })

    it('calculates previous month correctly', () => {
      const result = calculateComparisonPeriod({
        startDate: '2025-08-01',
        endDate: '2025-08-31',
        periodType: 'month',
        comparisonType: 'previous',
      })

      expect(result).toEqual({
        startDate: '2025-07-01',
        endDate: '2025-07-31',
      })
    })

    it('calculates previous quarter correctly', () => {
      const result = calculateComparisonPeriod({
        startDate: '2025-07-01', // Q3
        endDate: '2025-09-30',
        periodType: 'quarter',
        comparisonType: 'previous',
      })

      expect(result).toEqual({
        startDate: '2025-04-01', // Q2
        endDate: '2025-06-30',
      })
    })

    it('calculates previous year correctly', () => {
      const result = calculateComparisonPeriod({
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        periodType: 'year',
        comparisonType: 'previous',
      })

      expect(result).toEqual({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      })
    })

    it('calculates year-over-year comparison for week', () => {
      const result = calculateComparisonPeriod({
        startDate: '2025-08-24',
        endDate: '2025-08-30',
        periodType: 'week',
        comparisonType: 'year-over-year',
      })

      expect(result).toEqual({
        startDate: '2024-08-25', // Same week number in previous year
        endDate: '2024-08-31',
      })
    })

    it('calculates year-over-year comparison for month', () => {
      const result = calculateComparisonPeriod({
        startDate: '2025-08-01',
        endDate: '2025-08-31',
        periodType: 'month',
        comparisonType: 'year-over-year',
      })

      expect(result).toEqual({
        startDate: '2024-08-01',
        endDate: '2024-08-31',
      })
    })

    it('calculates custom period correctly', () => {
      const result = calculateComparisonPeriod({
        startDate: '2025-08-24',
        endDate: '2025-08-30',
        periodType: 'week',
        comparisonType: 'custom',
        customOffset: 4, // 4 weeks ago
      })

      expect(result).toEqual({
        startDate: '2025-07-27',
        endDate: '2025-08-02',
      })
    })

    it('handles period offset correctly', () => {
      const result = calculateComparisonPeriod({
        startDate: '2025-08-01',
        endDate: '2025-08-31',
        periodType: 'month',
        comparisonType: 'period-offset',
        periodOffset: 3, // 3 months ago
      })

      expect(result).toEqual({
        startDate: '2025-05-01',
        endDate: '2025-05-31',
      })
    })

    it('handles multi-week selections', () => {
      const result = calculateComparisonPeriod({
        startDate: '2025-08-03', // 3 week period
        endDate: '2025-08-23',
        periodType: 'week',
        comparisonType: 'previous',
      })

      expect(result).toEqual({
        startDate: '2025-07-13',
        endDate: '2025-08-02',
      })
    })
  })

  describe('validateComparisonPeriod', () => {
    it('validates non-overlapping periods', () => {
      const result = validateComparisonPeriod({
        mainStart: '2025-08-01',
        mainEnd: '2025-08-31',
        compareStart: '2025-07-01',
        compareEnd: '2025-07-31',
      })

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('detects overlapping periods', () => {
      const result = validateComparisonPeriod({
        mainStart: '2025-08-01',
        mainEnd: '2025-08-31',
        compareStart: '2025-08-15',
        compareEnd: '2025-09-15',
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Comparison period overlaps with selected period')
    })

    it('detects future comparison dates', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const result = validateComparisonPeriod({
        mainStart: '2025-08-01',
        mainEnd: '2025-08-31',
        compareStart: tomorrow.toISOString().split('T')[0],
        compareEnd: tomorrow.toISOString().split('T')[0],
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Comparison period cannot be in the future')
    })

    it('validates comparison period is before main period by default', () => {
      const result = validateComparisonPeriod({
        mainStart: '2025-08-01',
        mainEnd: '2025-08-31',
        compareStart: '2025-09-01',
        compareEnd: '2025-09-30',
        allowFutureComparison: false,
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Comparison period must be before the selected period')
    })

    it('allows comparison period after main period when specified', () => {
      const result = validateComparisonPeriod({
        mainStart: '2025-06-01',
        mainEnd: '2025-06-30',
        compareStart: '2025-07-01',
        compareEnd: '2025-07-31',
        allowFutureComparison: true,
      })

      expect(result.isValid).toBe(true)
    })

    it('validates date order', () => {
      const result = validateComparisonPeriod({
        mainStart: '2025-08-01',
        mainEnd: '2025-08-31',
        compareStart: '2025-07-31',
        compareEnd: '2025-07-01',
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Comparison end date must be after start date')
    })
  })

  describe('getComparisonOptions', () => {
    it('returns appropriate options for week period', () => {
      const options = getComparisonOptions('week')

      expect(options).toContainEqual({ value: 'previous', label: 'Previous week' })
      expect(options).toContainEqual({ value: 'year-over-year', label: 'Same week last year' })
      expect(options).toContainEqual({ value: 'custom', label: 'Custom' })
    })

    it('returns appropriate options for month period', () => {
      const options = getComparisonOptions('month')

      expect(options).toContainEqual({ value: 'previous', label: 'Previous month' })
      expect(options).toContainEqual({ value: 'year-over-year', label: 'Same month last year' })
      expect(options).toContainEqual({ value: 'custom', label: 'Custom' })
    })

    it('returns appropriate options for quarter period', () => {
      const options = getComparisonOptions('quarter')

      expect(options).toContainEqual({ value: 'previous', label: 'Previous quarter' })
      expect(options).toContainEqual({ value: 'year-over-year', label: 'Same quarter last year' })
      expect(options).toContainEqual({ value: 'custom', label: 'Custom' })
    })

    it('returns appropriate options for year period', () => {
      const options = getComparisonOptions('year')

      expect(options).toContainEqual({ value: 'previous', label: 'Previous year' })
      expect(options).toContainEqual({ value: 'custom', label: 'Custom' })
      // Year-over-year doesn't make sense for year period
      expect(options).not.toContainEqual(expect.objectContaining({ value: 'year-over-year' }))
    })
  })

  describe('formatComparisonLabel', () => {
    it('formats week comparison label', () => {
      const label = formatComparisonLabel({
        startDate: '2025-08-17',
        endDate: '2025-08-23',
        periodType: 'week',
      })

      expect(label).toBe('Week 34, 2025')
    })

    it('formats month comparison label', () => {
      const label = formatComparisonLabel({
        startDate: '2025-07-01',
        endDate: '2025-07-31',
        periodType: 'month',
      })

      expect(label).toBe('July 2025')
    })

    it('formats quarter comparison label', () => {
      const label = formatComparisonLabel({
        startDate: '2025-04-01',
        endDate: '2025-06-30',
        periodType: 'quarter',
      })

      expect(label).toBe('Q2 2025')
    })

    it('formats year comparison label', () => {
      const label = formatComparisonLabel({
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        periodType: 'year',
      })

      expect(label).toBe('2024')
    })

    it('formats custom period label', () => {
      const label = formatComparisonLabel({
        startDate: '2025-07-01',
        endDate: '2025-08-15',
        periodType: 'week',
      })

      expect(label).toBe('Jul 1 - Aug 15, 2025')
    })
  })
})