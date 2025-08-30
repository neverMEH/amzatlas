'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Calendar, ChevronDown, X } from 'lucide-react'
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

interface DateRangePickerV2Props {
  startDate: string
  endDate: string
  onChange: (range: DateRange) => void
  showComparison?: boolean
  compareStartDate?: string
  compareEndDate?: string
  onCompareChange?: (range: ComparisonRange) => void
}

export function DateRangePickerV2({
  startDate,
  endDate,
  onChange,
  showComparison = false,
  compareStartDate,
  compareEndDate,
  onCompareChange,
}: DateRangePickerV2Props) {
  const [periodType, setPeriodType] = useState<PeriodType>('week')
  const [isOpen, setIsOpen] = useState(false)
  const [comparisonEnabled, setComparisonEnabled] = useState(false)
  const [showCustomRange, setShowCustomRange] = useState(false)
  const [customWeeks, setCustomWeeks] = useState(10)
  const dropdownRef = useRef<HTMLDivElement>(null)

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
    }
  }, [])

  // Get comparison period dates
  const getComparisonDates = useCallback((mainRange: DateRange, type: PeriodType): DateRange => {
    const start = parseISO(mainRange.startDate)
    
    switch (type) {
      case 'week':
        return {
          startDate: format(subWeeks(start, 1), 'yyyy-MM-dd'),
          endDate: format(subWeeks(parseISO(mainRange.endDate), 1), 'yyyy-MM-dd'),
        }
      case 'month':
        return {
          startDate: format(subMonths(start, 1), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(subMonths(start, 1)), 'yyyy-MM-dd'),
        }
      case 'quarter':
        return {
          startDate: format(subQuarters(start, 1), 'yyyy-MM-dd'),
          endDate: format(endOfQuarter(subQuarters(start, 1)), 'yyyy-MM-dd'),
        }
      case 'year':
        return {
          startDate: format(subYears(start, 1), 'yyyy-MM-dd'),
          endDate: format(endOfYear(subYears(start, 1)), 'yyyy-MM-dd'),
        }
    }
  }, [])

  // Handle period type change
  const handlePeriodTypeChange = (newType: PeriodType) => {
    setPeriodType(newType)
    const newDates = getCurrentPeriodDates(newType)
    onChange(newDates)
    
    // Update comparison if enabled
    if (comparisonEnabled && onCompareChange) {
      const comparisonDates = getComparisonDates(newDates, newType)
      onCompareChange({
        ...comparisonDates,
        enabled: true,
      })
    }
  }

  // Handle comparison toggle
  const handleComparisonToggle = () => {
    const newEnabled = !comparisonEnabled
    setComparisonEnabled(newEnabled)
    
    if (onCompareChange) {
      if (newEnabled) {
        const comparisonDates = getComparisonDates({ startDate, endDate }, periodType)
        onCompareChange({
          ...comparisonDates,
          enabled: true,
        })
      } else {
        onCompareChange({
          startDate: compareStartDate || '',
          endDate: compareEndDate || '',
          enabled: false,
        })
      }
    }
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
      default:
        return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`
    }
  }

  // Handle custom range
  const applyCustomRange = () => {
    const today = new Date()
    const start = subWeeks(today, customWeeks - 1)
    onChange({
      startDate: format(startOfWeek(start, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
      endDate: format(endOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
    })
    setShowCustomRange(false)
    setIsOpen(false)
  }

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

          {isOpen && (
            <div className="absolute z-10 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg min-w-[350px]" role="dialog">
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
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowCustomRange(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Custom Range
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showComparison && (
        <div className="flex items-center space-x-4 pl-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={comparisonEnabled}
              onChange={handleComparisonToggle}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              aria-label="Enable comparison"
            />
            <span className="text-sm text-gray-700">Compare to:</span>
          </label>

          {comparisonEnabled && compareStartDate && compareEndDate && (
            <div className="text-sm text-gray-600">
              {(() => {
                const start = parseISO(compareStartDate)
                const end = parseISO(compareEndDate)
                if (!isValid(start) || !isValid(end)) return 'Invalid dates'
                
                switch (periodType) {
                  case 'week':
                    return `Week ${getWeek(start, { weekStartsOn: 0 })}, ${getYear(start)}`
                  case 'month':
                    return format(start, 'MMMM yyyy')
                  case 'quarter':
                    const quarter = Math.floor(start.getMonth() / 3) + 1
                    return `Q${quarter} ${format(start, 'yyyy')}`
                  case 'year':
                    return format(start, 'yyyy')
                  default:
                    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`
                }
              })()}
            </div>
          )}
        </div>
      )}

      {/* Custom Range Modal */}
      {showCustomRange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Custom Date Range</h3>
              <button
                onClick={() => setShowCustomRange(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="weeks-input" className="block text-sm font-medium text-gray-700 mb-1">
                  Number of weeks
                </label>
                <input
                  id="weeks-input"
                  type="number"
                  min="1"
                  max="52"
                  value={customWeeks}
                  onChange={(e) => setCustomWeeks(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCustomRange(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={applyCustomRange}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}