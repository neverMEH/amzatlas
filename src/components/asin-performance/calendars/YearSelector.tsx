'use client'

import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import {
  format,
  startOfYear,
  endOfYear,
  parseISO,
  isAfter,
  getYear,
} from 'date-fns'
import { DateRange } from '../types'

interface YearSelectorProps {
  selectedStart: string
  selectedEnd: string
  onSelect: (range: DateRange) => void
  maxDate?: string
  availableYears?: string[]
}

export function YearSelector({
  selectedStart,
  selectedEnd,
  onSelect,
  maxDate,
  availableYears = [],
}: YearSelectorProps) {
  const selectedDate = parseISO(selectedStart)
  const currentYear = new Date().getFullYear()
  const selectedYear = isValid(selectedDate) ? getYear(selectedDate) : currentYear
  
  const [decadeStart, setDecadeStart] = useState(() => {
    const decade = Math.floor(selectedYear / 10) * 10
    return decade - 2 // Show 12 years starting from 2 years before the decade
  })
  
  const [isYearInputMode, setIsYearInputMode] = useState(false)
  const [yearInputValue, setYearInputValue] = useState('')
  
  const maxDateParsed = maxDate ? parseISO(maxDate) : null
  const yearRange = 12 // Show 12 years at a time

  const handlePreviousDecade = () => {
    setDecadeStart(decadeStart - 10)
  }

  const handleNextDecade = () => {
    setDecadeStart(decadeStart + 10)
  }

  const handleToday = () => {
    const today = new Date()
    const decade = Math.floor(currentYear / 10) * 10
    setDecadeStart(decade - 2)
    
    const yearStart = startOfYear(today)
    const yearEnd = endOfYear(today)
    onSelect({
      startDate: format(yearStart, 'yyyy-MM-dd'),
      endDate: format(yearEnd, 'yyyy-MM-dd'),
    })
  }

  const handleYearClick = (year: number) => {
    const date = new Date(year, 0, 1)
    const yearStart = startOfYear(date)
    const yearEnd = endOfYear(date)
    
    // Check if year is beyond max date
    if (maxDateParsed && isAfter(yearStart, maxDateParsed)) {
      return
    }
    
    onSelect({
      startDate: format(yearStart, 'yyyy-MM-dd'),
      endDate: format(yearEnd, 'yyyy-MM-dd'),
    })
  }

  const isYearDisabled = (year: number) => {
    if (!maxDateParsed) return false
    const yearStart = new Date(year, 0, 1)
    return isAfter(yearStart, maxDateParsed)
  }

  const isYearSelected = (year: number) => {
    return year === selectedYear
  }

  const hasAvailableData = (year: number) => {
    return availableYears.some(date => date.startsWith(`${year}-`))
  }

  const handleDirectInput = () => {
    setIsYearInputMode(true)
    setYearInputValue('')
  }

  const handleYearInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setYearInputValue(e.target.value)
  }

  const handleYearInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const year = parseInt(yearInputValue)
      if (!isNaN(year) && year >= 1900 && year <= 2100) {
        const decade = Math.floor(year / 10) * 10
        setDecadeStart(decade - 2)
        handleYearClick(year)
      }
      setIsYearInputMode(false)
    } else if (e.key === 'Escape') {
      setIsYearInputMode(false)
    }
  }

  const handleYearInputBlur = () => {
    setIsYearInputMode(false)
  }

  const years = Array.from({ length: yearRange }, (_, i) => decadeStart + i)
  const decadeEnd = decadeStart + yearRange - 1

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePreviousDecade}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Previous decade"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium">
            {decadeStart} - {decadeEnd}
          </h2>
          <button
            onClick={handleDirectInput}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Enter year directly"
          >
            <Calendar className="h-4 w-4" />
          </button>
        </div>
        
        <button
          onClick={handleNextDecade}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Next decade"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Year input modal */}
      {isYearInputMode && (
        <div className="mb-4">
          <input
            type="number"
            value={yearInputValue}
            onChange={handleYearInputChange}
            onKeyDown={handleYearInputKeyDown}
            onBlur={handleYearInputBlur}
            placeholder="Enter year"
            className="w-full px-3 py-2 text-center border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
            role="spinbutton"
            aria-label="Year input"
          />
        </div>
      )}

      {/* Year Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {years.map((year) => {
          const isDisabled = isYearDisabled(year)
          const isSelected = isYearSelected(year)
          const hasData = hasAvailableData(year)
          const isCurrentYear = year === currentYear
          
          return (
            <button
              key={year}
              onClick={() => handleYearClick(year)}
              disabled={isDisabled}
              className={`
                relative py-3 px-4 rounded-lg font-medium transition-all
                ${isSelected ? 'bg-blue-600 text-white shadow-sm' : ''}
                ${!isSelected && !isDisabled ? 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300' : ''}
                ${isDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}
              `}
            >
              {year}
              {hasData && !isDisabled && (
                <span 
                  data-available
                  className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full"
                />
              )}
              {isCurrentYear && (
                <span 
                  data-current
                  className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-4 h-1 bg-blue-500 rounded-full"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Today button */}
      <div className="flex justify-center">
        <button
          onClick={handleToday}
          className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          Today
        </button>
      </div>
    </div>
  )
}

function isValid(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime())
}