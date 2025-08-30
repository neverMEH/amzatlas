'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, AlertCircle } from 'lucide-react'
import {
  format,
  subWeeks,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  getWeek,
  getYear,
  isThisWeek,
  parseISO,
} from 'date-fns'

interface CustomDateRangeProps {
  maxDate?: string
  onSelect: (range: {
    startDate: string
    endDate: string
    periodType: 'custom'
    customWeeks: number
  }) => void
  onClose: () => void
}

interface PresetOption {
  weeks: number
  label: string
}

const presetOptions: PresetOption[] = [
  { weeks: 4, label: 'Last 4 weeks' },
  { weeks: 8, label: 'Last 8 weeks' },
  { weeks: 12, label: 'Last 12 weeks' },
  { weeks: 26, label: 'Last 26 weeks' },
  { weeks: 52, label: 'Last 52 weeks' },
]

export function CustomDateRange({ maxDate, onSelect, onClose }: CustomDateRangeProps) {
  const [selectedWeeks, setSelectedWeeks] = useState(10)
  const [customInput, setCustomInput] = useState('10')
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [validationError, setValidationError] = useState('')

  const endDate = maxDate ? parseISO(maxDate) : new Date()
  const startDate = subWeeks(endDate, selectedWeeks)
  const rangeStart = startOfWeek(startDate, { weekStartsOn: 0 })
  const rangeEnd = endOfWeek(endDate, { weekStartsOn: 0 })

  // Get all weeks in the range
  const weeksInRange = eachWeekOfInterval(
    { start: rangeStart, end: rangeEnd },
    { weekStartsOn: 0 }
  )

  const handlePresetClick = (weeks: number) => {
    setSelectedWeeks(weeks)
    setCustomInput(weeks.toString())
    setSelectedPreset(weeks)
    setValidationError('')

    // Immediately apply the preset
    onSelect({
      startDate: format(startOfWeek(subWeeks(endDate, weeks), { weekStartsOn: 0 }), 'yyyy-MM-dd'),
      endDate: format(endOfWeek(endDate, { weekStartsOn: 0 }), 'yyyy-MM-dd'),
      periodType: 'custom',
      customWeeks: weeks,
    })
    onClose()
  }

  const handleCustomInputChange = (value: string) => {
    setCustomInput(value)
    setSelectedPreset(null)

    const numValue = parseInt(value) || 0
    if (numValue < 1) {
      setValidationError('Minimum 1 week')
    } else if (numValue > 104) {
      setValidationError('Maximum 104 weeks (2 years)')
    } else {
      setValidationError('')
      setSelectedWeeks(numValue)
    }
  }

  const handleApply = () => {
    if (validationError || !selectedWeeks) return

    onSelect({
      startDate: format(rangeStart, 'yyyy-MM-dd'),
      endDate: format(rangeEnd, 'yyyy-MM-dd'),
      periodType: 'custom',
      customWeeks: selectedWeeks,
    })
    onClose()
  }

  const formatDateRange = () => {
    return `${format(rangeStart, 'MMM d, yyyy')} - ${format(rangeEnd, 'MMM d, yyyy')}`
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 w-96">
      <h3 className="text-lg font-semibold mb-4">Select Date Range</h3>

      {/* Preset Options */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Select</h4>
        <div className="grid grid-cols-2 gap-2">
          {presetOptions.map((option) => (
            <button
              key={option.weeks}
              onClick={() => handlePresetClick(option.weeks)}
              className={`
                px-3 py-2 text-sm rounded-lg transition-colors text-left
                ${selectedPreset === option.weeks 
                  ? 'bg-blue-50 text-blue-700 border border-blue-300' 
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
                }
              `}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Input */}
      <div className="mb-6">
        <label htmlFor="custom-weeks" className="block text-sm font-medium text-gray-700 mb-2">
          Custom weeks
        </label>
        <div className="flex items-center space-x-2">
          <input
            id="custom-weeks"
            type="number"
            min="1"
            max="104"
            value={customInput}
            onChange={(e) => handleCustomInputChange(e.target.value)}
            className={`
              w-24 px-3 py-2 text-sm border rounded-lg
              focus:ring-2 focus:ring-blue-500 focus:border-transparent
              ${validationError ? 'border-red-300' : 'border-gray-300'}
            `}
            aria-label="Custom weeks"
          />
          <span className="text-sm text-gray-600">weeks</span>
        </div>
        {validationError && (
          <div className="flex items-center mt-1 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 mr-1" />
            {validationError}
          </div>
        )}
      </div>

      {/* Date Range Preview */}
      <div className="mb-6 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center text-sm text-gray-600 mb-1">
          <Calendar className="h-4 w-4 mr-2" />
          Date Range
        </div>
        <div className="text-sm font-medium text-gray-900">
          {formatDateRange()}
        </div>
      </div>

      {/* Week Breakdown */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          Weeks Included ({selectedWeeks})
        </h4>
        <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
          {weeksInRange.slice(-Math.min(selectedWeeks, 8)).reverse().map((weekStart) => {
            const weekNum = getWeek(weekStart, { weekStartsOn: 0 })
            const year = getYear(weekStart)
            const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 })
            const isCurrent = isThisWeek(weekStart, { weekStartsOn: 0 })

            return (
              <div
                key={weekStart.getTime()}
                className={`
                  px-3 py-2 text-sm border-b border-gray-100 last:border-b-0
                  ${isCurrent ? 'bg-blue-50' : ''}
                `}
              >
                <div className="flex justify-between items-center">
                  <span className={`font-medium ${isCurrent ? 'text-blue-700' : 'text-gray-700'}`}>
                    Week {weekNum}
                    {isCurrent && ' (Current)'}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                  </span>
                </div>
              </div>
            )
          })}
          {selectedWeeks > 8 && (
            <div className="px-3 py-2 text-sm text-gray-500 text-center">
              ... and {selectedWeeks - 8} more weeks
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={!!validationError || !selectedWeeks}
          className={`
            px-4 py-2 text-sm rounded-lg transition-colors
            ${validationError || !selectedWeeks
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
            }
          `}
        >
          Apply
        </button>
      </div>
    </div>
  )
}