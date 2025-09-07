export enum PeriodType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  BI_WEEKLY = 'bi-weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  CUSTOM = 'custom',
}

export interface DateRange {
  start: string // ISO date string (YYYY-MM-DD)
  end: string   // ISO date string (YYYY-MM-DD)
}

export interface ComparisonPeriod extends DateRange {
  type: PeriodType
  label: string
}

export type ComparisonMode = 
  | 'auto'           // Automatically determine based on period
  | 'period-over-period' // Same period length in the past
  | 'week-over-week'     // Compare to same period 1 week ago
  | 'month-over-month'   // Compare to same period 1 month ago
  | 'quarter-over-quarter' // Compare to same period 1 quarter ago
  | 'year-over-year'     // Compare to same period 1 year ago

export interface ComparisonOptions {
  mode?: ComparisonMode
  customOffset?: number // Days to offset for custom comparison
  excludeHolidays?: boolean
  businessDaysOnly?: boolean
}

export interface Holiday {
  date: string
  name: string
  isBusinessHoliday: boolean
}