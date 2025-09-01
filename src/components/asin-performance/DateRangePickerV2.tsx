'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfQuarter, 
  endOfQuarter, 
  startOfYear, 
  endOfYear,
  subWeeks,
  subMonths,
  subQuarters,
  subYears,
  parseISO,
  isValid,
  addDays,
  isSameWeek,
  getWeek,
  getYear
} from 'date-fns'
import { PeriodTypeSelector } from './PeriodTypeSelector'
import { PeriodType, DateRange, ComparisonRange } from './types'
import { WeekSelector } from './calendars/WeekSelector'
import { MonthSelector } from './calendars/MonthSelector'
import { QuarterSelector } from './calendars/QuarterSelector'
import { YearSelector } from './calendars/YearSelector'
import { ComparisonSelector } from './ComparisonSelector'
import { CustomDateRange } from './CustomDateRange'
import { useASINDataAvailability, useASINMonthlyDataAvailability } from '@/lib/api/asin-performance'

interface DateRangePickerV2Props {
  startDate: string
  endDate: string
  onChange: (range: DateRange) => void
  showComparison?: boolean
  compareStartDate?: string
  compareEndDate?: string
  onCompareChange?: (range: ComparisonRange) => void
  asin?: string
  hasManualSelection?: boolean
}

export function DateRangePickerV2({
  startDate,
  endDate,
  onChange,
  showComparison = false,
  compareStartDate,
  compareEndDate,
  onCompareChange,
  asin,
  hasManualSelection = false,
}: DateRangePickerV2Props) {
  const [periodType, setPeriodType] = useState<PeriodType>('week')
  const [isOpen, setIsOpen] = useState(false)
  const [comparisonEnabled, setComparisonEnabled] = useState(false)
  const [hasSetDefaultRange, setHasSetDefaultRange] = useState(false)
  const [lastProcessedASIN, setLastProcessedASIN] = useState<string | undefined>(undefined)
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState<{ year: number; month: number } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch ASIN data availability
  const { data: dataAvailability, isLoading: isLoadingAvailability, error: availabilityError } = useASINDataAvailability(asin || null)
  
  // Fetch monthly data when in month view and calendar is open
  const { data: monthlyDataAvailability } = useASINMonthlyDataAvailability(
    asin || null,
    currentCalendarMonth?.year || null,
    currentCalendarMonth?.month || null
  )

  // Extract available weeks and months from data availability
  const availableWeeks = React.useMemo(() => {
    if (!dataAvailability?.dateRanges) return []
    
    // Get unique week start dates
    const weekStarts = new Set<string>()
    dataAvailability.dateRanges.forEach(range => {
      const start = parseISO(range.start_date)
      const weekStart = startOfWeek(start, { weekStartsOn: 0 })
      weekStarts.add(format(weekStart, 'yyyy-MM-dd'))
    })
    
    return Array.from(weekStarts)
  }, [dataAvailability])

  const availableMonths = React.useMemo(() => {
    if (!dataAvailability?.dateRanges) return []
    
    // Get all dates that have data
    const dates: string[] = []
    dataAvailability.dateRanges.forEach(range => {
      dates.push(range.start_date)
      if (range.end_date !== range.start_date) {
        dates.push(range.end_date)
      }
    })
    
    return dates
  }, [dataAvailability])

  // Calculate monthly data counts
  const monthlyDataCounts = React.useMemo(() => {
    if (!dataAvailability?.dateRanges) return {}
    
    const counts: Record<string, number> = {}
    dataAvailability.dateRanges.forEach(range => {
      const monthKey = range.start_date.substring(0, 7) // YYYY-MM
      counts[monthKey] = (counts[monthKey] || 0) + range.record_count
    })
    
    return counts
  }, [dataAvailability])

  // Update calendar month when opening calendar
  React.useEffect(() => {
    if (isOpen && startDate) {
      const date = parseISO(startDate)
      if (isValid(date)) {
        setCurrentCalendarMonth({
          year: date.getFullYear(),
          month: date.getMonth() + 1
        })
      }
    }
  }, [isOpen, startDate])

  // Get current period dates based on type
  const getCurrentPeriodDates = useCallback((type: PeriodType): DateRange => {
    const today = new Date()
    
    switch (type) {
      case 'week':
        return {
          startDate: format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
          endDate: format(endOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
        }
      case 'month':
        return {
          startDate: format(startOfMonth(today), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(today), 'yyyy-MM-dd'),
        }
      case 'quarter':
        return {
          startDate: format(startOfQuarter(today), 'yyyy-MM-dd'),
          endDate: format(endOfQuarter(today), 'yyyy-MM-dd'),
        }
      case 'year':
        return {
          startDate: format(startOfYear(today), 'yyyy-MM-dd'),
          endDate: format(endOfYear(today), 'yyyy-MM-dd'),
        }
      case 'custom':
        // Default to last 4 weeks for custom
        const fourWeeksAgo = subWeeks(today, 4)
        return {
          startDate: format(startOfWeek(fourWeeksAgo, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
          endDate: format(endOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
        }
      default:
        return {
          startDate: format(today, 'yyyy-MM-dd'),
          endDate: format(today, 'yyyy-MM-dd'),
        }
    }
  }, [])


  // Handle period type change
  const handlePeriodTypeChange = (newType: PeriodType) => {
    setPeriodType(newType)
    const newDates = getCurrentPeriodDates(newType)
    onChange(newDates)
    // When user manually changes period type, mark as manual selection
    setHasSetDefaultRange(true)
  }


  // Format display text
  const getDisplayText = () => {
    const start = parseISO(startDate)
    const end = parseISO(endDate)
    
    if (!isValid(start) || !isValid(end)) return 'Select dates'
    
    switch (periodType) {
      case 'week':
        const weekNum = getWeek(start, { weekStartsOn: 0 })
        const year = getYear(start)
        return `Week ${weekNum}, ${year}`
      case 'month':
        return format(start, 'MMMM yyyy')
      case 'quarter':
        const quarter = Math.floor(start.getMonth() / 3) + 1
        return `Q${quarter} ${format(start, 'yyyy')}`
      case 'year':
        return format(start, 'yyyy')
      case 'custom':
        // Calculate weeks between dates
        const weeks = Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))
        return `Last ${weeks} weeks`
      default:
        return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`
    }
  }


  // Set default date range when ASIN data becomes available
  useEffect(() => {
    // Skip if manual selection was made or if we're loading or if no ASIN
    if (hasManualSelection || !asin || isLoadingAvailability || !dataAvailability) {
      return
    }

    // Skip if we already processed this ASIN
    if (asin === lastProcessedASIN && hasSetDefaultRange) {
      return
    }

    // Determine the date range to use
    let newDateRange: DateRange | null = null
    let shouldSetMonthPeriod = false

    if (dataAvailability.mostRecentCompleteMonth) {
      newDateRange = {
        startDate: dataAvailability.mostRecentCompleteMonth.startDate,
        endDate: dataAvailability.mostRecentCompleteMonth.endDate
      }
      shouldSetMonthPeriod = true
    } else if (dataAvailability.fallbackRange) {
      newDateRange = {
        startDate: dataAvailability.fallbackRange.startDate,
        endDate: dataAvailability.fallbackRange.endDate
      }
    }

    if (newDateRange) {
      // Update period type if we're setting a complete month
      if (shouldSetMonthPeriod && periodType !== 'month') {
        setPeriodType('month')
      }
      
      // Set the date range
      onChange(newDateRange)
      setHasSetDefaultRange(true)
      setLastProcessedASIN(asin)
    }
  }, [asin, dataAvailability, isLoadingAvailability, hasManualSelection, onChange, periodType, hasSetDefaultRange, lastProcessedASIN])

  // Reset when ASIN changes
  useEffect(() => {
    if (asin !== lastProcessedASIN) {
      setHasSetDefaultRange(false)
    }
  }, [asin, lastProcessedASIN])

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <PeriodTypeSelector
          value={periodType}
          onChange={handlePeriodTypeChange}
        />
        
        <div className="relative" ref={dropdownRef}>
          <button
            data-testid="calendar-trigger"
            aria-label="Select date range"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center space-x-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-w-[200px]"
          >
            <Calendar className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{getDisplayText()}</span>
            <ChevronDown className="h-4 w-4 text-gray-500 ml-auto" />
          </button>
          
          {/* Loading indicator */}
          {asin && isLoadingAvailability && (
            <div className="absolute right-0 top-full mt-1 text-sm text-gray-500 flex items-center space-x-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Loading data availability...</span>
            </div>
          )}
          
          {/* Error message */}
          {asin && !isLoadingAvailability && availabilityError && (
            <div className="absolute right-0 top-full mt-1 text-sm text-red-600">
              Failed to load data availability
            </div>
          )}
          
          {/* No data message */}
          {asin && !isLoadingAvailability && !availabilityError && dataAvailability && 
           !dataAvailability.mostRecentCompleteMonth && !dataAvailability.fallbackRange && (
            <div className="absolute right-0 top-full mt-1 text-sm text-amber-600">
              No historical data available for this ASIN
            </div>
          )}

          {isOpen && (
            <div className={`absolute z-10 mt-1 ${periodType === 'custom' ? '' : 'bg-white border border-gray-300 rounded-lg shadow-lg min-w-[350px]'}`} role="dialog">
              {periodType === 'week' && (
                <div data-testid="week-selector">
                  <WeekSelector
                    selectedStart={startDate}
                    selectedEnd={endDate}
                    onSelect={(range) => {
                      onChange(range)
                      setIsOpen(false)
                    }}
                    maxDate={format(new Date(), 'yyyy-MM-dd')}
                    availableWeeks={availableWeeks}
                    dailyData={monthlyDataAvailability?.dailyData}
                    compareStart={comparisonEnabled ? compareStartDate : undefined}
                    compareEnd={comparisonEnabled ? compareEndDate : undefined}
                    onMonthChange={(year, month) => {
                      setCurrentCalendarMonth({ year, month })
                    }}
                  />
                </div>
              )}
              
              {periodType === 'month' && (
                <div data-testid="month-selector">
                  <MonthSelector
                    selectedStart={startDate}
                    selectedEnd={endDate}
                    onSelect={(range) => {
                      onChange(range)
                      setIsOpen(false)
                    }}
                    maxDate={format(new Date(), 'yyyy-MM-dd')}
                    availableMonths={availableMonths}
                    monthlyDataCounts={monthlyDataCounts}
                    compareStart={comparisonEnabled ? compareStartDate : undefined}
                    compareEnd={comparisonEnabled ? compareEndDate : undefined}
                  />
                </div>
              )}
              
              {periodType === 'quarter' && (
                <div data-testid="quarter-selector">
                  <QuarterSelector
                    selectedStart={startDate}
                    selectedEnd={endDate}
                    onSelect={(range) => {
                      onChange(range)
                      setIsOpen(false)
                    }}
                    maxDate={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
              )}
              
              {periodType === 'year' && (
                <div data-testid="year-selector">
                  <YearSelector
                    selectedStart={startDate}
                    selectedEnd={endDate}
                    onSelect={(range) => {
                      onChange(range)
                      setIsOpen(false)
                    }}
                    maxDate={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
              )}
              
              {periodType === 'custom' && (
                <div data-testid="custom-selector">
                  <CustomDateRange
                    maxDate={format(new Date(), 'yyyy-MM-dd')}
                    onSelect={(range) => {
                      onChange({
                        startDate: range.startDate,
                        endDate: range.endDate,
                      })
                      setIsOpen(false)
                    }}
                    onClose={() => setIsOpen(false)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showComparison && (
        <ComparisonSelector
          mainStartDate={startDate}
          mainEndDate={endDate}
          periodType={periodType}
          compareStartDate={compareStartDate || ''}
          compareEndDate={compareEndDate || ''}
          enabled={comparisonEnabled}
          onChange={(range) => {
            setComparisonEnabled(range.enabled)
            onCompareChange?.(range)
          }}
          maxDate={format(new Date(), 'yyyy-MM-dd')}
        />
      )}

      {/* Custom Range Modal */}
    </div>
  )
}