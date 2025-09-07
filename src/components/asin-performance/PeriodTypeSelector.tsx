'use client'

import React from 'react'
import { Calendar, CalendarDays, CalendarRange, CalendarClock, SlidersHorizontal } from 'lucide-react'
import { PeriodType } from './types'

interface PeriodTypeSelectorProps {
  value: PeriodType
  onChange: (value: PeriodType) => void
  className?: string
}

interface PeriodOption {
  value: PeriodType
  label: string
  icon: React.ReactNode
}

export function PeriodTypeSelector({ value, onChange, className = '' }: PeriodTypeSelectorProps) {
  const periodOptions: PeriodOption[] = [
    {
      value: 'week',
      label: 'Week',
      icon: <CalendarDays className="h-4 w-4" data-testid="week-icon" />,
    },
    {
      value: 'month',
      label: 'Month',
      icon: <Calendar className="h-4 w-4" data-testid="month-icon" />,
    },
    {
      value: 'quarter',
      label: 'Quarter',
      icon: <CalendarRange className="h-4 w-4" data-testid="quarter-icon" />,
    },
    {
      value: 'year',
      label: 'Year',
      icon: <CalendarClock className="h-4 w-4" data-testid="year-icon" />,
    },
    {
      value: 'custom',
      label: 'Custom',
      icon: <SlidersHorizontal className="h-4 w-4" data-testid="custom-icon" />,
    },
  ]

  const handleClick = (periodType: PeriodType) => {
    if (periodType !== value) {
      onChange(periodType)
    }
  }

  return (
    <div
      role="group"
      aria-label="Select period type"
      className={`inline-flex rounded-lg border border-gray-200 p-1 ${className}`}
    >
      {periodOptions.map((option) => {
        const isSelected = value === option.value
        
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleClick(option.value)}
            aria-pressed={isSelected}
            className={`
              flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md
              transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500
              ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }
            `}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}