'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'
import { format, subDays, startOfWeek, startOfMonth, startOfYear, isValid, parseISO } from 'date-fns'

interface DateRangePickerProps {
  startDate: string
  endDate: string
  onChange: (range: { startDate: string; endDate: string }) => void
  showComparison?: boolean
  compareStartDate?: string
  compareEndDate?: string
  onCompareChange?: (range: { startDate: string; endDate: string; enabled: boolean }) => void
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
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [comparisonEnabled, setComparisonEnabled] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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
    if (onCompareChange) {
      const defaultCompareRange = {
        startDate: compareStartDate || format(subDays(parseISO(startDate), 30), 'yyyy-MM-dd'),
        endDate: compareEndDate || format(subDays(parseISO(endDate), 30), 'yyyy-MM-dd'),
        enabled: newEnabled,
      }
      onCompareChange(defaultCompareRange)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
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

          {comparisonEnabled && (
            <div className="flex items-center space-x-2 opacity-100 transition-opacity">
              <input
                type="date"
                value={compareStartDate}
                onChange={(e) =>
                  onCompareChange?.({
                    startDate: e.target.value,
                    endDate: compareEndDate || '',
                    enabled: true,
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              />
              <span className="text-gray-500 text-sm">to</span>
              <input
                type="date"
                value={compareEndDate}
                onChange={(e) =>
                  onCompareChange?.({
                    startDate: compareStartDate || '',
                    endDate: e.target.value,
                    enabled: true,
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}