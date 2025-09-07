'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
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
  getYear,
  isAfter,
  isBefore
} from 'date-fns'
import { PeriodTypeSelector } from './PeriodTypeSelector'
import { PeriodType, DateRange, ComparisonRange } from './types'
import { WeekSelector } from './calendars/WeekSelector'
import { MonthSelector } from './calendars/MonthSelector'
import { QuarterSelector } from './calendars/QuarterSelector'
import { YearSelector } from './calendars/YearSelector'
import { ComparisonSelector } from './ComparisonSelector'
import { CustomDateRange } from './CustomDateRange'
import { useASINDataAvailability } from '@/lib/api/asin-performance'

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
  const [hasSetDefaultRange, setHasSetDefaultRange] = useState(false)
  const [lastProcessedASIN, setLastProcessedASIN] = useState<string | undefined>(undefined)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Derive comparison enabled state from props
  const comparisonEnabled = Boolean(compareStartDate && compareEndDate)

  // Fetch ASIN data availability
  const { data: dataAvailability, isLoading: isLoadingAvailability } = useASINDataAvailability(asin || null)
  
  // Check if current selection has data
  const [hasDataForCurrentPeriod, setHasDataForCurrentPeriod] = useState(true)

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
    // When user manually changes period type, mark as manual selection
    setHasSetDefaultRange(true)
    
    // Just open the dropdown to let user select the specific period
    // Don't auto-select current period
    setIsOpen(true)
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

    // Check if current dates match what we would set
    const currentMatchesAvailable = () => {
      if (dataAvailability.mostRecentCompleteMonth) {
        return startDate === dataAvailability.mostRecentCompleteMonth.startDate && 
               endDate === dataAvailability.mostRecentCompleteMonth.endDate
      } else if (dataAvailability.fallbackRange) {
        return startDate === dataAvailability.fallbackRange.startDate && 
               endDate === dataAvailability.fallbackRange.endDate
      }
      return false
    }

    // Skip if dates already match
    if (currentMatchesAvailable()) {
      setHasSetDefaultRange(true)
      setLastProcessedASIN(asin)
      return
    }

    // Check if the selected dates are recent (within last 2 months)
    const today = new Date()
    const twoMonthsAgo = subMonths(today, 2)
    const selectedStart = parseISO(startDate)
    
    // If current selection is recent, don't override with older data
    if (isAfter(selectedStart, twoMonthsAgo)) {
      // Check if there's data for the current selection
      const hasDataForCurrent = dataAvailability.dateRanges?.some(range => {
        const rangeStart = parseISO(range.start_date)
        const rangeEnd = parseISO(range.end_date)
        const currentStart = parseISO(startDate)
        const currentEnd = parseISO(endDate)
        
        return (
          (isAfter(rangeEnd, currentStart) || format(rangeEnd, 'yyyy-MM-dd') === startDate) &&
          (isBefore(rangeStart, currentEnd) || format(rangeStart, 'yyyy-MM-dd') === endDate)
        )
      })
      
      // Update state to show no data indicator
      setHasDataForCurrentPeriod(hasDataForCurrent)
      
      // If there's no data for current selection but there is historical data, 
      // show a message instead of changing dates
      if (!hasDataForCurrent && dataAvailability.summary.latestDate) {
        console.info('No data available for current date range. Historical data available.')
      }
      
      setHasSetDefaultRange(true)
      setLastProcessedASIN(asin)
      return
    }

    // Only set historical dates if current dates are already old
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
  }, [asin, dataAvailability, isLoadingAvailability, hasManualSelection, periodType, hasSetDefaultRange, lastProcessedASIN, startDate, endDate])
  // Note: onChange is intentionally omitted from deps to prevent infinite loops

  // Reset when ASIN changes
  useEffect(() => {
    if (asin !== lastProcessedASIN) {
      setHasSetDefaultRange(false)
    }
  }, [asin, lastProcessedASIN])

  // Click outside handler
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    // Add listener after a small delay to avoid catching the opening click
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    
    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

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
            onClick={(e) => {
              e.stopPropagation()
              setIsOpen(!isOpen)
            }}
            className="flex items-center space-x-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-w-[200px]"
          >
            <Calendar className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{getDisplayText()}</span>
            <ChevronDown className="h-4 w-4 text-gray-500 ml-auto" />
          </button>
          
          {/* Loading indicator for ASIN data - only show on initial load */}
          {asin && isLoadingAvailability && !dataAvailability && (
            <div className="absolute right-0 top-full mt-1 text-sm text-gray-500">
              Loading ASIN data...
            </div>
          )}
          

          {isOpen && (
            <div 
              className={`absolute z-10 mt-1 ${periodType === 'custom' ? '' : 'bg-white border border-gray-300 rounded-lg shadow-lg min-w-[350px]'}`} 
              role="dialog"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}>
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
                    compareStart={comparisonEnabled ? compareStartDate : undefined}
                    compareEnd={comparisonEnabled ? compareEndDate : undefined}
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
            onCompareChange?.(range)
          }}
          maxDate={format(new Date(), 'yyyy-MM-dd')}
        />
      )}

      {/* Custom Range Modal */}
    </div>
  )
}