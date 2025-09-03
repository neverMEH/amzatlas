'use client'

import React, { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfYear,
  parseISO,
  isAfter,
  setMonth,
  setYear,
  getMonth,
  getYear,
  isValid,
} from 'date-fns'
import { DateRange } from '../types'

interface MonthSelectorProps {
  selectedStart: string
  selectedEnd: string
  onSelect: (range: DateRange) => void
  maxDate?: string
  availableMonths?: string[]
  compareStart?: string
  compareEnd?: string
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function MonthSelector({
  selectedStart,
  selectedEnd,
  onSelect,
  maxDate,
  availableMonths = [],
  compareStart,
  compareEnd,
}: MonthSelectorProps) {
  const selectedDate = parseISO(selectedStart)
  const currentYear = isValid(selectedDate) ? getYear(selectedDate) : new Date().getFullYear()
  const currentMonth = isValid(selectedDate) ? getMonth(selectedDate) : new Date().getMonth()
  
  const [displayYear, setDisplayYear] = useState(currentYear)
  const [isYearInputMode, setIsYearInputMode] = useState(false)
  const [yearInputValue, setYearInputValue] = useState(displayYear.toString())
  
  const maxDateParsed = maxDate ? parseISO(maxDate) : null
  const compareDate = compareStart ? parseISO(compareStart) : null
  const compareYear = compareDate && isValid(compareDate) ? getYear(compareDate) : null
  const compareMonth = compareDate && isValid(compareDate) ? getMonth(compareDate) : null

  const handlePreviousYear = () => {
    setDisplayYear(displayYear - 1)
  }

  const handleNextYear = () => {
    setDisplayYear(displayYear + 1)
  }

  const handleToday = () => {
    const today = new Date()
    setDisplayYear(getYear(today))
    const monthStart = startOfMonth(today)
    const monthEnd = endOfMonth(today)
    onSelect({
      startDate: format(monthStart, 'yyyy-MM-dd'),
      endDate: format(monthEnd, 'yyyy-MM-dd'),
    })
  }

  const handleMonthClick = (monthIndex: number) => {
    const date = new Date(displayYear, monthIndex, 1)
    const monthStart = startOfMonth(date)
    const monthEnd = endOfMonth(date)
    
    // Check if month is beyond max date
    if (maxDateParsed && isAfter(monthStart, maxDateParsed)) {
      return
    }
    
    onSelect({
      startDate: format(monthStart, 'yyyy-MM-dd'),
      endDate: format(monthEnd, 'yyyy-MM-dd'),
    })
  }

  const isMonthDisabled = (monthIndex: number) => {
    if (!maxDateParsed) return false
    const monthStart = new Date(displayYear, monthIndex, 1)
    return isAfter(monthStart, maxDateParsed)
  }

  const isMonthSelected = (monthIndex: number) => {
    return displayYear === currentYear && monthIndex === currentMonth
  }

  const isMonthInComparison = (monthIndex: number) => {
    return displayYear === compareYear && monthIndex === compareMonth
  }

  const hasAvailableData = (monthIndex: number) => {
    const monthStart = format(new Date(displayYear, monthIndex, 1), 'yyyy-MM-dd')
    return availableMonths.some(date => date.startsWith(monthStart.substring(0, 7)))
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

      {/* Month Grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {monthNames.map((monthName, index) => {
          const isDisabled = isMonthDisabled(index)
          const isSelected = isMonthSelected(index)
          const isInComparison = isMonthInComparison(index)
          const hasData = hasAvailableData(index)
          const isCurrentYearMonth = displayYear === new Date().getFullYear() && index === new Date().getMonth()
          
          return (
            <button
              key={monthName}
              onClick={() => handleMonthClick(index)}
              disabled={isDisabled}
              className={`
                relative py-3 px-4 rounded-lg font-medium transition-all
                ${isSelected ? 'bg-blue-600 text-white shadow-sm' : ''}
                ${isInComparison && !isSelected ? 'bg-purple-100 text-purple-900 border-purple-300' : ''}
                ${!isSelected && !isInComparison && !isDisabled ? 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300' : ''}
                ${isDisabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}
              `}
            >
              {monthName}
              {hasData && !isDisabled && (
                <span 
                  data-available
                  className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full"
                />
              )}
              {isCurrentYearMonth && (
                <span 
                  data-current
                  className="absolute bottom-1 right-1 w-1 h-1 bg-blue-500 rounded-full"
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