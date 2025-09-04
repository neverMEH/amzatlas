'use client'

import React, { useState, useEffect } from 'react'
import { ChevronDown, Calendar, AlertCircle } from 'lucide-react'
import { PeriodType, DateRange, ComparisonRange } from './types'
import {
  getComparisonOptions,
  calculateComparisonPeriod,
  validateComparisonPeriod,
  formatComparisonLabel,
  ComparisonType,
} from './utils/comparisonPeriod'
import { SmartSuggestions } from './SmartSuggestions'
import { calculateComparisonPeriod as calculateSmartComparison } from '@/lib/date-utils/comparison-period'
import type { ComparisonPeriod } from '@/lib/date-utils/comparison-period'

interface ComparisonSelectorProps {
  mainStartDate: string
  mainEndDate: string
  periodType: PeriodType
  compareStartDate: string
  compareEndDate: string
  enabled: boolean
  onChange: (range: ComparisonRange) => void
  maxDate?: string
}

export function ComparisonSelector({
  mainStartDate,
  mainEndDate,
  periodType,
  compareStartDate,
  compareEndDate,
  enabled,
  onChange,
  maxDate,
}: ComparisonSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [comparisonType, setComparisonType] = useState<ComparisonType>('previous')
  const [customOffset, setCustomOffset] = useState(1)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [showSmartSuggestions, setShowSmartSuggestions] = useState(false)
  const [selectedComparison, setSelectedComparison] = useState<ComparisonPeriod | null>(null)

  // Get comparison options for current period type
  const comparisonOptions = getComparisonOptions(periodType)

  // Track if we've already set a default to prevent loops
  const [hasSetDefault, setHasSetDefault] = useState(false)

  // Calculate default comparison when enabled
  useEffect(() => {
    if (enabled && !compareStartDate && !compareEndDate && !hasSetDefault) {
      // Use smart comparison for initial default
      const smartComparison = calculateSmartComparison(
        { start: mainStartDate, end: mainEndDate },
        'auto'
      )
      
      setSelectedComparison(smartComparison)
      setHasSetDefault(true)
      // Use a timeout to defer the onChange to the next tick
      // This prevents infinite loops when the parent component updates URL params
      setTimeout(() => {
        onChange({
          startDate: smartComparison.start,
          endDate: smartComparison.end,
          enabled: true,
        })
      }, 0)
      setComparisonType('previous')
      setShowSmartSuggestions(true) // Show smart suggestions by default
    }
    
    // Reset the flag when comparison is disabled
    if (!enabled) {
      setHasSetDefault(false)
    }
  }, [enabled, mainStartDate, mainEndDate, compareStartDate, compareEndDate, hasSetDefault])
  // Note: onChange is intentionally omitted from deps to prevent infinite loops

  // Validate initial comparison dates
  useEffect(() => {
    if (enabled && compareStartDate && compareEndDate) {
      const validation = validateComparisonPeriod({
        mainStart: mainStartDate,
        mainEnd: mainEndDate,
        compareStart: compareStartDate,
        compareEnd: compareEndDate,
      })
      
      if (!validation.isValid) {
        setValidationErrors(validation.errors)
      }
    }
  }, [])

  // Update comparison when main period changes
  useEffect(() => {
    if (enabled && compareStartDate && compareEndDate) {
      const newComparison = calculateComparisonPeriod({
        startDate: mainStartDate,
        endDate: mainEndDate,
        periodType,
        comparisonType,
        customOffset,
      })
      
      const validation = validateComparisonPeriod({
        mainStart: mainStartDate,
        mainEnd: mainEndDate,
        compareStart: newComparison.startDate,
        compareEnd: newComparison.endDate,
      })
      
      // Only update if the dates have actually changed
      const hasChanged = newComparison.startDate !== compareStartDate || 
                        newComparison.endDate !== compareEndDate
      
      if (validation.isValid && hasChanged) {
        onChange({
          ...newComparison,
          enabled: true,
        })
        setValidationErrors([])
      } else if (!validation.isValid) {
        setValidationErrors(validation.errors)
      }
    }
  }, [mainStartDate, mainEndDate, periodType, comparisonType, compareStartDate, compareEndDate, customOffset])

  const handleComparisonTypeChange = (type: ComparisonType) => {
    setComparisonType(type)
    
    if (type !== 'custom') {
      const newComparison = calculateComparisonPeriod({
        startDate: mainStartDate,
        endDate: mainEndDate,
        periodType,
        comparisonType: type,
      })
      
      const validation = validateComparisonPeriod({
        mainStart: mainStartDate,
        mainEnd: mainEndDate,
        compareStart: newComparison.startDate,
        compareEnd: newComparison.endDate,
      })
      
      if (validation.isValid) {
        onChange({
          ...newComparison,
          enabled: true,
        })
        setValidationErrors([])
      } else {
        setValidationErrors(validation.errors)
      }
      
      setIsOpen(false)
    }
  }

  const handleCustomOffsetApply = () => {
    const newComparison = calculateComparisonPeriod({
      startDate: mainStartDate,
      endDate: mainEndDate,
      periodType,
      comparisonType: 'custom',
      customOffset,
    })
    
    const validation = validateComparisonPeriod({
      mainStart: mainStartDate,
      mainEnd: mainEndDate,
      compareStart: newComparison.startDate,
      compareEnd: newComparison.endDate,
    })
    
    if (validation.isValid) {
      onChange({
        ...newComparison,
        enabled: true,
      })
      setValidationErrors([])
      setIsOpen(false)
    } else {
      setValidationErrors(validation.errors)
    }
  }

  const handleToggle = () => {
    if (!enabled) {
      // Enable with smart comparison
      const smartComparison = calculateSmartComparison(
        { start: mainStartDate, end: mainEndDate },
        'auto'
      )
      
      setSelectedComparison(smartComparison)
      onChange({
        startDate: smartComparison.start,
        endDate: smartComparison.end,
        enabled: true,
      })
      setShowSmartSuggestions(true)
    } else {
      // Disable comparison
      setSelectedComparison(null)
      setShowSmartSuggestions(false)
      onChange({
        startDate: '',
        endDate: '',
        enabled: false,
      })
    }
  }

  const getOffsetLabel = () => {
    switch (periodType) {
      case 'week':
        return customOffset === 1 ? '1 week ago' : `${customOffset} weeks ago`
      case 'month':
        return customOffset === 1 ? '1 month ago' : `${customOffset} months ago`
      case 'quarter':
        return customOffset === 1 ? '1 quarter ago' : `${customOffset} quarters ago`
      case 'year':
        return customOffset === 1 ? '1 year ago' : `${customOffset} years ago`
    }
  }

  const handleSmartSuggestionSelect = (comparison: ComparisonPeriod) => {
    setSelectedComparison(comparison)
    onChange({
      startDate: comparison.start,
      endDate: comparison.end,
      enabled: true,
    })
    setShowSmartSuggestions(false)
    setValidationErrors([])
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-4">
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleToggle}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            aria-label="Enable comparison"
          />
          <span className="text-sm font-medium text-gray-700">Compare to another period</span>
        </label>

        {enabled && (
          <div className="flex items-center space-x-2">
            {!showSmartSuggestions && (
              <>
                <button
                  onClick={() => setShowSmartSuggestions(true)}
                  className="px-3 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  Use Smart Suggestions
                </button>
                <span className="text-sm text-gray-500">or</span>
              </>
            )}
            
            <div className="relative">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-gray-700">
                  {selectedComparison ? selectedComparison.label : 
                   compareStartDate && compareEndDate ? formatComparisonLabel({
                    startDate: compareStartDate,
                    endDate: compareEndDate,
                    periodType,
                  }) : 'Select period'}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </button>

              {isOpen && (
                <div className="absolute z-10 mt-1 w-64 bg-white border border-gray-300 rounded-lg shadow-lg p-4">
                  <div className="space-y-2">
                    {comparisonOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleComparisonTypeChange(option.value)}
                        className={`
                          w-full text-left px-3 py-2 text-sm rounded-lg transition-colors
                          ${comparisonType === option.value ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}
                        `}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {comparisonType === 'custom' && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <label htmlFor="custom-offset-input" className="block text-sm font-medium text-gray-700 mb-2">
                        Custom offset
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          id="custom-offset-input"
                          type="number"
                          min="1"
                          max="52"
                          value={customOffset}
                          onChange={(e) => setCustomOffset(parseInt(e.target.value) || 1)}
                          className="w-20 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <span className="text-sm text-gray-600">
                          {getOffsetLabel()}
                        </span>
                      </div>
                      <button
                        onClick={handleCustomOffsetApply}
                        className="mt-3 w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Visual indicator for comparison type */}
            <span className="text-xs text-gray-500">
              ({comparisonOptions.find(opt => opt.value === comparisonType)?.label})
            </span>
          </div>
        )}
      </div>

      {/* Smart Suggestions */}
      {enabled && showSmartSuggestions && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Smart comparison suggestions</h3>
            <button
              onClick={() => setShowSmartSuggestions(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Use manual selection
            </button>
          </div>
          <SmartSuggestions
            dateRange={{ start: mainStartDate, end: mainEndDate }}
            currentComparison={selectedComparison || undefined}
            onSelect={handleSmartSuggestionSelect}
            maxSuggestions={4}
            className="max-w-2xl"
          />
        </div>
      )}

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="flex items-start space-x-2 p-3 bg-red-50 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-700">
            {validationErrors.map((error, index) => (
              <div key={index}>{error}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}