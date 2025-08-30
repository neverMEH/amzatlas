'use client'

import React, { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameWeek,
  isToday,
  addMonths,
  subMonths,
  getWeek,
  parseISO,
  isAfter,
  isBefore,
  isEqual,
} from 'date-fns'
import { DateRange } from '../types'

interface WeekSelectorProps {
  selectedStart: string
  selectedEnd: string
  onSelect: (range: DateRange) => void
  maxDate?: string
  availableWeeks?: string[]
}

export function WeekSelector({
  selectedStart,
  selectedEnd,
  onSelect,
  maxDate,
  availableWeeks = [],
}: WeekSelectorProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const selected = parseISO(selectedStart)
    return isValid(selected) ? startOfMonth(selected) : startOfMonth(new Date())
  })

  const selectedStartDate = parseISO(selectedStart)
  const maxDateParsed = maxDate ? parseISO(maxDate) : null

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const handleToday = () => {
    const today = new Date()
    setCurrentMonth(startOfMonth(today))
    const weekStart = startOfWeek(today, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(today, { weekStartsOn: 0 })
    onSelect({
      startDate: format(weekStart, 'yyyy-MM-dd'),
      endDate: format(weekEnd, 'yyyy-MM-dd'),
    })
  }

  const handleDayClick = (date: Date) => {
    const weekStart = startOfWeek(date, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(date, { weekStartsOn: 0 })
    
    // Check if week end is beyond max date
    if (maxDateParsed && isAfter(weekEnd, maxDateParsed)) {
      return
    }
    
    onSelect({
      startDate: format(weekStart, 'yyyy-MM-dd'),
      endDate: format(weekEnd, 'yyyy-MM-dd'),
    })
  }

  // Get calendar days
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  // Group days by week
  const weeks: Date[][] = []
  let currentWeek: Date[] = []
  
  calendarDays.forEach((day, index) => {
    currentWeek.push(day)
    if ((index + 1) % 7 === 0) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  })

  const isDateDisabled = (date: Date) => {
    if (!maxDateParsed) return false
    return isAfter(date, maxDateParsed)
  }

  const isWeekSelected = (date: Date) => {
    return isSameWeek(date, selectedStartDate, { weekStartsOn: 0 })
  }

  const hasAvailableData = (date: Date) => {
    const weekStart = format(startOfWeek(date, { weekStartsOn: 0 }), 'yyyy-MM-dd')
    return availableWeeks.includes(weekStart)
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePreviousMonth}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        
        <h2 className="text-lg font-medium">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        
        <button
          onClick={handleNextMonth}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="mb-3">
        <div className="grid grid-cols-8 gap-0" role="grid">
          {/* Week number header */}
          <div className="text-center text-xs font-medium text-gray-500 py-2">
            Wk
          </div>
          
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
          
          {/* Calendar weeks */}
          {weeks.map((week, weekIndex) => {
            const weekNumber = getWeek(week[0], { weekStartsOn: 0 })
            const isWeekDisabled = week.every(day => isDateDisabled(day))
            const isCurrentWeek = week.some(day => isWeekSelected(day))
            
            return (
              <React.Fragment key={weekIndex}>
                {/* Week number */}
                <div className="text-center text-xs text-gray-400 py-1">
                  {weekNumber}
                </div>
                
                {/* Week days */}
                {week.map((day, dayIndex) => {
                  const isDisabled = isDateDisabled(day)
                  const isSelected = isWeekSelected(day)
                  const isCurrentMonth = isSameMonth(day, currentMonth)
                  const isTodayDate = isToday(day)
                  const hasData = hasAvailableData(day)
                  
                  return (
                    <button
                      key={dayIndex}
                      onClick={() => handleDayClick(day)}
                      disabled={isDisabled}
                      data-date={format(day, 'yyyy-MM-dd')}
                      data-week={weekNumber}
                      className={`
                        relative h-10 w-full border-r border-b
                        ${dayIndex === 0 ? 'border-l' : ''}
                        ${weekIndex === 0 ? 'border-t' : ''}
                        ${isCurrentWeek && !isDisabled ? 'bg-blue-100' : ''}
                        ${isSelected && !isDisabled ? 'bg-blue-100' : ''}
                        ${!isCurrentMonth ? 'text-gray-400' : ''}
                        ${isDisabled ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'}
                        ${isTodayDate ? 'font-semibold' : ''}
                        transition-colors
                      `}
                    >
                      <span className="text-sm">{format(day, 'd')}</span>
                      {hasData && !isDisabled && (
                        <span 
                          data-available
                          className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-green-500 rounded-full"
                        />
                      )}
                      {isTodayDate && (
                        <span 
                          data-current
                          className="absolute top-1 right-1 w-1 h-1 bg-blue-500 rounded-full"
                        />
                      )}
                    </button>
                  )
                })}
              </React.Fragment>
            )
          })}
        </div>
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