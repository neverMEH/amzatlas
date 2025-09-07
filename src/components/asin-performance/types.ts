export type PeriodType = 'week' | 'month' | 'quarter' | 'year' | 'custom'

export type ChartType = 'line' | 'bar'

export interface DateRange {
  startDate: string
  endDate: string
}

export interface ComparisonRange extends DateRange {
  enabled: boolean
}

export interface PeriodSelection {
  type: PeriodType
  range: DateRange
  comparison?: ComparisonRange
}

export interface WeekInfo {
  weekNumber: number
  year: number
  startDate: Date
  endDate: Date
}

export interface QuarterInfo {
  quarter: number
  year: number
  startDate: Date
  endDate: Date
}

export interface CustomRangeOptions {
  weeks?: number
  months?: number
  quarters?: number
  years?: number
}