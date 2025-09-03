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
  const [comparisonEnabled, setComparisonEnabled] = useState(false)
  const [hasSetDefaultRange, setHasSetDefaultRange] = useState(false)
  const [lastProcessedASIN, setLastProcessedASIN] = useState<string | undefined>(undefined)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch ASIN data availability
  const { data: dataAvailability, isLoading: isLoadingAvailability } = useASINDataAvailability(asin || null)

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

    // Use 'click' instead of 'mousedown' to avoid timing issues
    // Add a small delay to ensure the dropdown has rendered
    if (isOpen) {
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside)
      }, 0)
      
      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('click', handleClickOutside)
      }
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
          
          {/* Loading indicator for ASIN data */}
          {asin && isLoadingAvailability && (
            <div className="absolute right-0 top-full mt-1 text-sm text-gray-500">
              Loading ASIN data...
            </div>
          )}
          
          {/* No data message */}
          {asin && !isLoadingAvailability && dataAvailability && 
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