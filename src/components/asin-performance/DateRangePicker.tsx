'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown, Loader2 } from 'lucide-react'
import { format, subDays, startOfWeek, startOfMonth, startOfYear, isValid, parseISO } from 'date-fns'
import { SmartSuggestions } from './SmartSuggestions'
import { calculateComparisonPeriod } from '@/lib/date-utils/comparison-period'
import type { ComparisonPeriod } from '@/lib/date-utils/comparison-period'
import { useASINDataAvailability } from '@/lib/api/asin-performance'

interface DateRangePickerProps {
  startDate: string
  endDate: string
  onChange: (range: { startDate: string; endDate: string }) => void
  showComparison?: boolean
  compareStartDate?: string
  compareEndDate?: string
  onCompareChange?: (range: { startDate: string; endDate: string; enabled: boolean }) => void
  asin?: string
}

interface PresetOption {
  label: string
  getValue: () => { startDate: string; endDate: string }
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  showComparison = false,
  compareStartDate,
  compareEndDate,
  onCompareChange,
  asin,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [comparisonEnabled, setComparisonEnabled] = useState(false)
  const [selectedComparison, setSelectedComparison] = useState<ComparisonPeriod | null>(null)
  const [hasSetDefaultRange, setHasSetDefaultRange] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const previousAsinRef = useRef<string | undefined>(asin)

  // Fetch ASIN data availability
  const { data: dataAvailability, isLoading: isLoadingAvailability } = useASINDataAvailability(asin || null)

  const today = new Date()
  
  const presetOptions: PresetOption[] = [
    {
      label: 'Last 7 days',
      getValue: () => ({
        startDate: format(subDays(today, 7), 'yyyy-MM-dd'),
        endDate: format(today, 'yyyy-MM-dd'),
      }),
    },
    {
      label: 'Last 14 days',
      getValue: () => ({
        startDate: format(subDays(today, 14), 'yyyy-MM-dd'),
        endDate: format(today, 'yyyy-MM-dd'),
      }),
    },
    {
      label: 'Last 30 days',
      getValue: () => ({
        startDate: format(subDays(today, 30), 'yyyy-MM-dd'),
        endDate: format(today, 'yyyy-MM-dd'),
      }),
    },
    {
      label: 'Last 90 days',
      getValue: () => ({
        startDate: format(subDays(today, 90), 'yyyy-MM-dd'),
        endDate: format(today, 'yyyy-MM-dd'),
      }),
    },
    {
      label: 'This week',
      getValue: () => ({
        startDate: format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
        endDate: format(today, 'yyyy-MM-dd'),
      }),
    },
    {
      label: 'This month',
      getValue: () => ({
        startDate: format(startOfMonth(today), 'yyyy-MM-dd'),
        endDate: format(today, 'yyyy-MM-dd'),
      }),
    },
    {
      label: 'This year',
      getValue: () => ({
        startDate: format(startOfYear(today), 'yyyy-MM-dd'),
        endDate: format(today, 'yyyy-MM-dd'),
      }),
    },
  ]

  const getCurrentPresetLabel = () => {
    const currentRange = { startDate, endDate }
    const preset = presetOptions.find((option) => {
      const presetRange = option.getValue()
      return (
        presetRange.startDate === currentRange.startDate &&
        presetRange.endDate === currentRange.endDate
      )
    })
    return preset?.label || 'Custom range'
  }

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

  // Handle ASIN changes and set default date range
  useEffect(() => {
    // Check if ASIN has changed
    if (asin && asin !== previousAsinRef.current) {
      previousAsinRef.current = asin
      setHasSetDefaultRange(false)
    }

    // Set default date range when data is available and ASIN has changed
    if (asin && dataAvailability && !hasSetDefaultRange && !isLoadingAvailability) {
      if (dataAvailability.mostRecentCompleteMonth) {
        // Use the most recent complete month
        onChange({
          startDate: dataAvailability.mostRecentCompleteMonth.startDate,
          endDate: dataAvailability.mostRecentCompleteMonth.endDate
        })
        setHasSetDefaultRange(true)
      } else if (dataAvailability.fallbackRange) {
        // Use fallback range if no complete month
        onChange({
          startDate: dataAvailability.fallbackRange.startDate,
          endDate: dataAvailability.fallbackRange.endDate
        })
        setHasSetDefaultRange(true)
      }
      // If neither is available, don't change the date range
    }
  }, [asin, dataAvailability, hasSetDefaultRange, isLoadingAvailability, onChange])

  const handlePresetClick = (preset: PresetOption) => {
    const range = preset.getValue()
    onChange(range)
    setIsOpen(false)
  }

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = e.target.value
    if (!newStartDate) return

    const start = parseISO(newStartDate)
    const end = parseISO(endDate)

    if (isValid(start) && isValid(end) && start <= end) {
      onChange({ startDate: newStartDate, endDate })
    }
  }

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEndDate = e.target.value
    if (!newEndDate) return

    const start = parseISO(startDate)
    const end = parseISO(newEndDate)

    if (isValid(start) && isValid(end) && start <= end) {
      onChange({ startDate, endDate: newEndDate })
    }
  }

  const handleComparisonToggle = () => {
    const newEnabled = !comparisonEnabled
    setComparisonEnabled(newEnabled)
    
    if (newEnabled && onCompareChange && !selectedComparison) {
      // Calculate the default smart comparison when first enabled
      const defaultComparison = calculateComparisonPeriod({ start: startDate, end: endDate }, 'auto')
      setSelectedComparison(defaultComparison)
      onCompareChange({
        startDate: defaultComparison.start,
        endDate: defaultComparison.end,
        enabled: true,
      })
    } else if (!newEnabled && onCompareChange) {
      // Clear comparison when disabled
      setSelectedComparison(null)
      onCompareChange({
        startDate: '',
        endDate: '',
        enabled: false,
      })
    }
  }

  const handleSmartSuggestionSelect = (comparison: ComparisonPeriod) => {
    setSelectedComparison(comparison)
    if (onCompareChange) {
      onCompareChange({
        startDate: comparison.start,
        endDate: comparison.end,
        enabled: true,
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        {isLoadingAvailability && asin && (
          <div data-testid="date-range-loading" className="flex items-center space-x-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading date availability...</span>
          </div>
        )}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center space-x-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <Calendar className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{getCurrentPresetLabel()}</span>
            <ChevronDown className="h-4 w-4 text-gray-500" />
          </button>

          {isOpen && (
            <div className="absolute z-10 mt-1 w-48 bg-white border border-gray-300 rounded-lg shadow-lg">
              <ul className="py-1">
                {presetOptions.map((preset) => (
                  <li
                    key={preset.label}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700"
                    onClick={() => handlePresetClick(preset)}
                  >
                    {preset.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="date"
            value={startDate}
            onChange={handleStartDateChange}
            className="px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={endDate}
            onChange={handleEndDateChange}
            className="px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
      </div>

      {showComparison && (
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={comparisonEnabled}
                onChange={handleComparisonToggle}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                aria-label="Enable comparison"
              />
              <span className="text-sm font-medium text-gray-700">Compare to another period</span>
            </label>

            {comparisonEnabled && selectedComparison && (
              <div className="text-sm text-gray-600">
                Currently comparing to: <span className="font-medium">{selectedComparison.label}</span>
              </div>
            )}
          </div>

          {comparisonEnabled && (
            <div className="pl-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Select comparison period:
              </h3>
              <SmartSuggestions
                dateRange={{ start: startDate, end: endDate }}
                currentComparison={selectedComparison || undefined}
                onSelect={handleSmartSuggestionSelect}
                maxSuggestions={4}
                className="max-w-2xl"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}