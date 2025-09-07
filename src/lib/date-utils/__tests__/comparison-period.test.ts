import { describe, it, expect } from 'vitest'
import {
  detectPeriodType,
  calculateComparisonPeriod,
  getComparisonLabel,
  isValidComparisonPeriod,
  PeriodType,
  DateRange,
  ComparisonPeriod,
} from '../comparison-period'

describe('detectPeriodType', () => {
  it('should detect daily period (1 day)', () => {
    const range: DateRange = {
      start: '2024-01-01',
      end: '2024-01-01',
    }
    expect(detectPeriodType(range)).toBe(PeriodType.DAILY)
  })

  it('should detect weekly period (7 days)', () => {
    const range: DateRange = {
      start: '2024-01-01',
      end: '2024-01-07',
    }
    expect(detectPeriodType(range)).toBe(PeriodType.WEEKLY)
  })

  it('should detect bi-weekly period (14 days)', () => {
    const range: DateRange = {
      start: '2024-01-01',
      end: '2024-01-14',
    }
    expect(detectPeriodType(range)).toBe(PeriodType.BI_WEEKLY)
  })

  it('should detect monthly period (full month)', () => {
    const range: DateRange = {
      start: '2024-01-01',
      end: '2024-01-31',
    }
    expect(detectPeriodType(range)).toBe(PeriodType.MONTHLY)
  })

  it('should detect monthly period (30 days)', () => {
    const range: DateRange = {
      start: '2024-01-15',
      end: '2024-02-13',
    }
    expect(detectPeriodType(range)).toBe(PeriodType.MONTHLY)
  })

  it('should detect quarterly period (full quarter)', () => {
    const range: DateRange = {
      start: '2024-01-01',
      end: '2024-03-31',
    }
    expect(detectPeriodType(range)).toBe(PeriodType.QUARTERLY)
  })

  it('should detect yearly period (full year)', () => {
    const range: DateRange = {
      start: '2024-01-01',
      end: '2024-12-31',
    }
    expect(detectPeriodType(range)).toBe(PeriodType.YEARLY)
  })

  it('should detect custom period for irregular ranges', () => {
    const range: DateRange = {
      start: '2024-01-01',
      end: '2024-01-15',
    }
    expect(detectPeriodType(range)).toBe(PeriodType.CUSTOM)
  })
})

describe('calculateComparisonPeriod', () => {
  describe('weekly comparisons', () => {
    it('should calculate previous week for a weekly period', () => {
      const range: DateRange = {
        start: '2024-01-08',
        end: '2024-01-14',
      }
      const comparison = calculateComparisonPeriod(range)
      expect(comparison).toEqual({
        start: '2024-01-01',
        end: '2024-01-07',
        type: PeriodType.WEEKLY,
        label: 'Previous Week',
      })
    })

    it('should handle week spanning month boundary', () => {
      const range: DateRange = {
        start: '2024-01-29',
        end: '2024-02-04',
      }
      const comparison = calculateComparisonPeriod(range)
      expect(comparison).toEqual({
        start: '2024-01-22',
        end: '2024-01-28',
        type: PeriodType.WEEKLY,
        label: 'Previous Week',
      })
    })
  })

  describe('monthly comparisons', () => {
    it('should calculate previous month for a full month period', () => {
      const range: DateRange = {
        start: '2024-02-01',
        end: '2024-02-29',
      }
      const comparison = calculateComparisonPeriod(range)
      expect(comparison).toEqual({
        start: '2024-01-01',
        end: '2024-01-31',
        type: PeriodType.MONTHLY,
        label: 'Previous Month',
      })
    })

    it('should handle 30-day period comparison', () => {
      const range: DateRange = {
        start: '2024-02-15',
        end: '2024-03-15',
      }
      const comparison = calculateComparisonPeriod(range)
      expect(comparison).toEqual({
        start: '2024-01-16',
        end: '2024-02-14',
        type: PeriodType.MONTHLY,
        label: 'Previous 30 Days',
      })
    })

    it('should handle month-end edge cases', () => {
      const range: DateRange = {
        start: '2024-03-01',
        end: '2024-03-31',
      }
      const comparison = calculateComparisonPeriod(range)
      expect(comparison).toEqual({
        start: '2024-02-01',
        end: '2024-02-29', // Leap year
        type: PeriodType.MONTHLY,
        label: 'Previous Month',
      })
    })
  })

  describe('quarterly comparisons', () => {
    it('should calculate previous quarter for Q2', () => {
      const range: DateRange = {
        start: '2024-04-01',
        end: '2024-06-30',
      }
      const comparison = calculateComparisonPeriod(range)
      expect(comparison).toEqual({
        start: '2024-01-01',
        end: '2024-03-31',
        type: PeriodType.QUARTERLY,
        label: 'Previous Quarter',
      })
    })

    it('should handle year boundary for Q1', () => {
      const range: DateRange = {
        start: '2024-01-01',
        end: '2024-03-31',
      }
      const comparison = calculateComparisonPeriod(range)
      expect(comparison).toEqual({
        start: '2023-10-01',
        end: '2023-12-31',
        type: PeriodType.QUARTERLY,
        label: 'Previous Quarter',
      })
    })
  })

  describe('yearly comparisons', () => {
    it('should calculate previous year', () => {
      const range: DateRange = {
        start: '2024-01-01',
        end: '2024-12-31',
      }
      const comparison = calculateComparisonPeriod(range)
      expect(comparison).toEqual({
        start: '2023-01-01',
        end: '2023-12-31',
        type: PeriodType.YEARLY,
        label: 'Previous Year',
      })
    })
  })

  describe('custom period comparisons', () => {
    it('should calculate same duration in the past for custom periods', () => {
      const range: DateRange = {
        start: '2024-01-10',
        end: '2024-01-20',
      }
      const comparison = calculateComparisonPeriod(range)
      expect(comparison).toEqual({
        start: '2023-12-30',
        end: '2024-01-09',
        type: PeriodType.CUSTOM,
        label: 'Previous 11 Days',
      })
    })
  })

  describe('with custom comparison type', () => {
    it('should calculate year-over-year comparison for monthly period', () => {
      const range: DateRange = {
        start: '2024-01-01',
        end: '2024-01-31',
      }
      const comparison = calculateComparisonPeriod(range, 'year-over-year')
      expect(comparison).toEqual({
        start: '2023-01-01',
        end: '2023-01-31',
        type: PeriodType.MONTHLY,
        label: 'Same Month Last Year',
      })
    })

    it('should calculate month-over-month for weekly period', () => {
      const range: DateRange = {
        start: '2024-02-05',
        end: '2024-02-11',
      }
      const comparison = calculateComparisonPeriod(range, 'month-over-month')
      expect(comparison).toEqual({
        start: '2024-01-05',
        end: '2024-01-11',
        type: PeriodType.WEEKLY,
        label: '4 Weeks Ago',
      })
    })
  })
})

describe('getComparisonLabel', () => {
  it('should return correct label for weekly comparison', () => {
    const comparison: ComparisonPeriod = {
      start: '2024-01-01',
      end: '2024-01-07',
      type: PeriodType.WEEKLY,
      label: 'Previous Week',
    }
    expect(getComparisonLabel(comparison)).toBe('vs. Previous Week')
  })

  it('should return correct label for monthly comparison', () => {
    const comparison: ComparisonPeriod = {
      start: '2024-01-01',
      end: '2024-01-31',
      type: PeriodType.MONTHLY,
      label: 'Previous Month',
    }
    expect(getComparisonLabel(comparison)).toBe('vs. Previous Month')
  })

  it('should include date range for custom periods', () => {
    const comparison: ComparisonPeriod = {
      start: '2024-01-01',
      end: '2024-01-15',
      type: PeriodType.CUSTOM,
      label: 'Previous 15 Days',
    }
    expect(getComparisonLabel(comparison)).toBe('vs. Jan 1 - Jan 15, 2024')
  })
})

describe('isValidComparisonPeriod', () => {
  it('should validate that comparison period is before main period', () => {
    const range: DateRange = {
      start: '2024-02-01',
      end: '2024-02-29',
    }
    const comparison: ComparisonPeriod = {
      start: '2024-01-01',
      end: '2024-01-31',
      type: PeriodType.MONTHLY,
      label: 'Previous Month',
    }
    expect(isValidComparisonPeriod(range, comparison)).toBe(true)
  })

  it('should invalidate comparison period that overlaps with main period', () => {
    const range: DateRange = {
      start: '2024-01-15',
      end: '2024-02-15',
    }
    const comparison: ComparisonPeriod = {
      start: '2024-01-01',
      end: '2024-01-31',
      type: PeriodType.MONTHLY,
      label: 'Previous Month',
    }
    expect(isValidComparisonPeriod(range, comparison)).toBe(false)
  })

  it('should invalidate comparison period that is after main period', () => {
    const range: DateRange = {
      start: '2024-01-01',
      end: '2024-01-31',
    }
    const comparison: ComparisonPeriod = {
      start: '2024-02-01',
      end: '2024-02-29',
      type: PeriodType.MONTHLY,
      label: 'Next Month',
    }
    expect(isValidComparisonPeriod(range, comparison)).toBe(false)
  })

  it('should validate non-overlapping custom periods', () => {
    const range: DateRange = {
      start: '2024-02-10',
      end: '2024-02-20',
    }
    const comparison: ComparisonPeriod = {
      start: '2024-01-10',
      end: '2024-01-20',
      type: PeriodType.CUSTOM,
      label: 'Previous Period',
    }
    expect(isValidComparisonPeriod(range, comparison)).toBe(true)
  })
})