'use client'

import React, { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  format,
  startOfQuarter,
  endOfQuarter,
  parseISO,
  isAfter,
  getQuarter,
  getYear,
  setQuarter,
  setYear,
} from 'date-fns'
import { DateRange } from '../types'

interface QuarterSelectorProps {
  selectedStart: string
  selectedEnd: string
  onSelect: (range: DateRange) => void
  maxDate?: string
  availableQuarters?: string[]
}

const quarters = [
  { number: 1, label: 'Q1', months: 'Jan - Mar' },
  { number: 2, label: 'Q2', months: 'Apr - Jun' },
  { number: 3, label: 'Q3', months: 'Jul - Sep' },
  { number: 4, label: 'Q4', months: 'Oct - Dec' },
]

export function QuarterSelector({
  selectedStart,
  selectedEnd,
  onSelect,
  maxDate,
  availableQuarters = [],
}: QuarterSelectorProps) {
  const selectedDate = parseISO(selectedStart)
  const currentYear = isValid(selectedDate) ? getYear(selectedDate) : new Date().getFullYear()
  const currentQuarter = isValid(selectedDate) ? getQuarter(selectedDate) : getQuarter(new Date())
  
  const [displayYear, setDisplayYear] = useState(currentYear)
  const [isYearInputMode, setIsYearInputMode] = useState(false)
  const [yearInputValue, setYearInputValue] = useState(displayYear.toString())
  const [hoveredQuarter, setHoveredQuarter] = useState<number | null>(null)
  
  const maxDateParsed = maxDate ? parseISO(maxDate) : null

  const handlePreviousYear = () => {
    setDisplayYear(displayYear - 1)
  }

  const handleNextYear = () => {
    setDisplayYear(displayYear + 1)
  }

  const handleToday = () => {
    const today = new Date()
    setDisplayYear(getYear(today))
    const quarterStart = startOfQuarter(today)
    const quarterEnd = endOfQuarter(today)
    onSelect({
      startDate: format(quarterStart, 'yyyy-MM-dd'),
      endDate: format(quarterEnd, 'yyyy-MM-dd'),
    })
  }

  const handleQuarterClick = (quarterNumber: number) => {
    const date = setQuarter(new Date(displayYear, 0, 1), quarterNumber)
    const quarterStart = startOfQuarter(date)
    const quarterEnd = endOfQuarter(date)
    
    // Check if quarter is beyond max date
    if (maxDateParsed && isAfter(quarterStart, maxDateParsed)) {
      return
    }
    
    onSelect({
      startDate: format(quarterStart, 'yyyy-MM-dd'),
      endDate: format(quarterEnd, 'yyyy-MM-dd'),
    })
  }

  const isQuarterDisabled = (quarterNumber: number) => {
    if (!maxDateParsed) return false
    const quarterStart = startOfQuarter(setQuarter(new Date(displayYear, 0, 1), quarterNumber))
    return isAfter(quarterStart, maxDateParsed)
  }

  const isQuarterSelected = (quarterNumber: number) => {
    return displayYear === currentYear && quarterNumber === currentQuarter
  }

  const hasAvailableData = (quarterNumber: number) => {
    const quarterStart = format(startOfQuarter(setQuarter(new Date(displayYear, 0, 1), quarterNumber)), 'yyyy-MM-dd')
    return availableQuarters.some(date => {
      const availableDate = parseISO(date)
      const availableQuarter = getQuarter(availableDate)
      const availableYear = getYear(availableDate)
      return availableYear === displayYear && availableQuarter === quarterNumber
    })
  }

  const getQuarterDateRange = (quarterNumber: number) => {
    const date = setQuarter(new Date(displayYear, 0, 1), quarterNumber)
    const start = startOfQuarter(date)
    const end = endOfQuarter(date)
    return `${format(start, 'MMMM d')} - ${format(end, 'MMMM d')}`
  }

  const handleYearClick = () => {
    setIsYearInputMode(true)
    setYearInputValue(displayYear.toString())
  }

  const handleYearInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setYearInputValue(e.target.value)
  }

  const handleYearInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const year = parseInt(yearInputValue)
      if (!isNaN(year) && year >= 1900 && year <= 2100) {
        setDisplayYear(year)
      }
      setIsYearInputMode(false)
    } else if (e.key === 'Escape') {
      setIsYearInputMode(false)
      setYearInputValue(displayYear.toString())
    }
  }

  const handleYearInputBlur = () => {
    setIsYearInputMode(false)
    setYearInputValue(displayYear.toString())
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePreviousYear}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Previous year"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        
        {isYearInputMode ? (
          <input
            type="number"
            value={yearInputValue}
            onChange={handleYearInputChange}
            onKeyDown={handleYearInputKeyDown}
            onBlur={handleYearInputBlur}
            className="w-20 px-2 py-1 text-center text-lg font-medium border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
            role="spinbutton"
            aria-label="Year input"
          />
        ) : (
          <button
            onClick={handleYearClick}
            className="text-lg font-medium hover:bg-gray-100 px-3 py-1 rounded-lg transition-colors"
          >
            {displayYear}
          </button>
        )}
        
        <button
          onClick={handleNextYear}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Next year"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Quarter Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {quarters.map((quarter) => {
          const isDisabled = isQuarterDisabled(quarter.number)
          const isSelected = isQuarterSelected(quarter.number)
          const hasData = hasAvailableData(quarter.number)
          const isCurrentYearQuarter = displayYear === new Date().getFullYear() && quarter.number === getQuarter(new Date())
          
          return (
            <button
              key={quarter.number}
              onClick={() => handleQuarterClick(quarter.number)}
              onMouseEnter={() => setHoveredQuarter(quarter.number)}
              onMouseLeave={() => setHoveredQuarter(null)}
              disabled={isDisabled}
              className={`
                relative py-4 px-6 rounded-lg transition-all
                ${isSelected ? 'bg-blue-600 text-white shadow-sm' : ''}
                ${!isSelected && !isDisabled ? 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300' : ''}
                ${isDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}
              `}
            >
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold">{quarter.label}</span>
                <span className="text-sm mt-1 opacity-75">{quarter.months}</span>
              </div>
              {hasData && !isDisabled && (
                <span 
                  data-available
                  className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full"
                />
              )}
              {isCurrentYearQuarter && (
                <span 
                  data-current
                  className="absolute bottom-2 right-2 w-1 h-1 bg-blue-500 rounded-full"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* Hover tooltip */}
      {hoveredQuarter && (
        <div className="text-center text-sm text-gray-600 mb-4">
          {getQuarterDateRange(hoveredQuarter)}
        </div>
      )}

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