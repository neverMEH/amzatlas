'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { Calendar, TrendingUp, Clock, AlertCircle, CheckCircle } from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'
import { 
  DateRange, 
  ComparisonPeriod,
  PeriodType,
  calculateComparisonPeriod,
  getComparisonLabel,
  formatDateRange,
  isValidComparisonPeriod,
  detectPeriodType,
} from '@/lib/date-utils/comparison-period'
import { parseISO, differenceInDays, isAfter, differenceInMonths } from 'date-fns'
import { cn } from '@/lib/utils'
import { usePerformanceTracking } from '@/lib/monitoring/performance-tracker'

interface SmartSuggestionsProps {
  dateRange: DateRange
  currentComparison?: ComparisonPeriod
  onSelect: (comparison: ComparisonPeriod) => void
  maxSuggestions?: number
  isCalculating?: boolean
  className?: string
  asin?: string // Optional ASIN for API-based suggestions
  useApiSuggestions?: boolean // Whether to use API suggestions
}

interface SuggestionWithMetadata extends ComparisonPeriod {
  confidence: 'high' | 'medium' | 'low'
  reason: string
  dataAvailability: 'full' | 'partial' | 'limited'
  icon: React.ReactNode
  periodLength?: number // Number of days in the period
  historicalContext?: string // e.g., "Holiday season", "Q4 2023"
}

// Helper function to calculate confidence based on recency
function calculateRecencyConfidence(comparisonEnd: string): 'high' | 'medium' | 'low' {
  const today = new Date()
  const endDate = parseISO(comparisonEnd)
  const monthsAgo = differenceInMonths(today, endDate)
  
  // Within 2 months = high confidence (very recent)
  // 2-6 months = medium confidence (reasonably recent)
  // Over 6 months = low confidence (historical)
  if (monthsAgo <= 2) return 'high'
  if (monthsAgo <= 6) return 'medium'
  return 'low'
}

export function SmartSuggestions({
  dateRange,
  currentComparison,
  onSelect,
  maxSuggestions = 4,
  isCalculating = false,
  className,
}: SmartSuggestionsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const { trackRender, trackOperation } = usePerformanceTracking('SmartSuggestions')
  
  // Track component render time
  useEffect(() => {
    const cleanup = trackRender()
    return cleanup
  })

  const suggestions = useMemo(() => {
    const endTracking = trackOperation('generateSuggestions')
    
    try {
      const periodType = detectPeriodType(dateRange)
      const suggestionsWithMeta: SuggestionWithMetadata[] = []

      // Previous period (period-over-period)
      const previousPeriod = calculateComparisonPeriod(dateRange, 'period-over-period')
      if (isValidComparisonPeriod(dateRange, previousPeriod)) {
        const recencyConfidence = calculateRecencyConfidence(previousPeriod.end)
        const monthsAgo = differenceInMonths(new Date(), parseISO(previousPeriod.end))
        
        suggestionsWithMeta.push({
          ...previousPeriod,
          confidence: recencyConfidence,
          reason: monthsAgo <= 1 ? 'Most recent comparable period' : `Previous period (${monthsAgo} months ago)`,
          dataAvailability: getDataAvailability(previousPeriod),
          icon: <Clock className="h-4 w-4" />,
          periodLength: getPeriodLength(previousPeriod),
          historicalContext: getHistoricalContext(previousPeriod),
        })
      }

      // Same period last month (if applicable)
      if (periodType === PeriodType.WEEKLY || periodType === PeriodType.DAILY) {
        const lastMonth = calculateComparisonPeriod(dateRange, 'month-over-month')
        if (isValidComparisonPeriod(dateRange, lastMonth)) {
          const recencyConfidence = calculateRecencyConfidence(lastMonth.end)
          
          suggestionsWithMeta.push({
            ...lastMonth,
            label: `Same ${periodType === PeriodType.WEEKLY ? 'Week' : 'Days'} Last Month`,
            confidence: recencyConfidence,
            reason: 'Accounts for monthly seasonality',
            dataAvailability: getDataAvailability(lastMonth),
            icon: <Calendar className="h-4 w-4" />,
            periodLength: getPeriodLength(lastMonth),
            historicalContext: getHistoricalContext(lastMonth),
          })
        }
      }

      // Same period last year
      const lastYear = calculateComparisonPeriod(dateRange, 'year-over-year')
      if (isValidComparisonPeriod(dateRange, lastYear)) {
        // Year-over-year comparisons get lower confidence due to age
        // but boost slightly for monthly/quarterly due to seasonal importance
        const baseConfidence = calculateRecencyConfidence(lastYear.end)
        const isSeasonalPeriod = periodType === PeriodType.MONTHLY || periodType === PeriodType.QUARTERLY
        const adjustedConfidence = isSeasonalPeriod && baseConfidence === 'low' ? 'medium' : baseConfidence
        
        suggestionsWithMeta.push({
          ...lastYear,
          confidence: adjustedConfidence,
          reason: 'Year-over-year comparison for seasonal trends',
          dataAvailability: getDataAvailability(lastYear),
          icon: <TrendingUp className="h-4 w-4" />,
          periodLength: getPeriodLength(lastYear),
          historicalContext: getHistoricalContext(lastYear),
        })
      }

      // Custom suggestions based on period type
      if (periodType === PeriodType.MONTHLY) {
        // Previous quarter for monthly view
        const quarterAgo = calculateComparisonPeriod(dateRange, 'quarter-over-quarter')
        if (isValidComparisonPeriod(dateRange, quarterAgo)) {
          suggestionsWithMeta.push({
            ...quarterAgo,
            label: 'Same Month Last Quarter',
            confidence: 'medium',
            reason: 'Quarterly business cycle comparison',
            dataAvailability: getDataAvailability(quarterAgo),
            icon: <Calendar className="h-4 w-4" />,
            periodLength: getPeriodLength(quarterAgo),
            historicalContext: getHistoricalContext(quarterAgo),
          })
        }
      }

      // Sort suggestions by confidence (prefer recent dates)
      const sortedSuggestions = suggestionsWithMeta.sort((a, b) => {
        // Define confidence order
        const confidenceOrder = { high: 3, medium: 2, low: 1 }
        const aScore = confidenceOrder[a.confidence]
        const bScore = confidenceOrder[b.confidence]
        
        // Sort by confidence first, then by recency if confidence is equal
        if (aScore !== bScore) {
          return bScore - aScore
        }
        
        // If confidence is equal, prefer more recent dates
        const aDate = parseISO(a.end)
        const bDate = parseISO(b.end)
        return bDate.getTime() - aDate.getTime()
      })
      
      return sortedSuggestions.slice(0, maxSuggestions)
    } catch (error) {
      console.error('Error generating suggestions:', error)
      return []
    } finally {
      endTracking()
    }
  }, [dateRange, maxSuggestions, trackOperation])

  if (isCalculating) {
    return (
      <div data-testid="suggestions-loading" className={cn('space-y-2', className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-20 bg-gray-100 rounded-lg animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (suggestions.length === 0) {
    return (
      <div data-testid="smart-suggestions" className={cn('p-4 text-center text-gray-500', className)}>
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p>Unable to generate suggestions</p>
      </div>
    )
  }

  return (
    <div data-testid="smart-suggestions" className={cn('space-y-2', className)}>
      {suggestions.map((suggestion, index) => {
        const isSelected = currentComparison && 
          currentComparison.start === suggestion.start && 
          currentComparison.end === suggestion.end

        return (
          <Tooltip
            key={index}
            content={
              <div className="space-y-2 max-w-xs">
                <div>
                  <p className="font-medium">{formatDateRange(suggestion)}</p>
                  {suggestion.periodLength && (
                    <p className="text-xs text-gray-400">
                      {suggestion.periodLength} day{suggestion.periodLength !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <p className="text-sm text-gray-300">{suggestion.reason}</p>
                {suggestion.historicalContext && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-blue-400" />
                    <p className="text-sm text-blue-400">{suggestion.historicalContext}</p>
                  </div>
                )}
                {suggestion.dataAvailability !== 'full' && (
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-yellow-500" />
                    <p className="text-sm text-yellow-500">
                      Limited data availability
                    </p>
                  </div>
                )}
              </div>
            }
            open={hoveredIndex === index}
          >
            <button
              role="button"
              data-testid="suggestion-card"
              className={cn(
                'w-full p-4 rounded-lg border-2 transition-all',
                'hover:border-gray-300 hover:shadow-md',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                isSelected
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                  : 'border-gray-200 bg-white'
              )}
              onClick={() => onSelect(suggestion)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className={cn(
                    'p-2 rounded-lg',
                    isSelected ? 'bg-blue-100' : 'bg-gray-100'
                  )}>
                    {suggestion.icon}
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-gray-900">
                      {suggestion.label}
                    </h4>
                    <p className="text-sm text-gray-500 mt-1">
                      {getComparisonLabel(suggestion)}
                    </p>
                    {suggestion.historicalContext && (suggestion.historicalContext.includes('season') || suggestion.historicalContext.includes('period')) && (
                      <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {suggestion.historicalContext}
                      </p>
                    )}
                    {suggestion.dataAvailability !== 'full' && (
                      <p className="text-xs text-yellow-600 mt-1">
                        Limited data availability
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {renderConfidenceIndicator(suggestion.confidence)}
                  {isSelected && (
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                  )}
                </div>
              </div>
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}

function getDataAvailability(comparison: ComparisonPeriod): 'full' | 'partial' | 'limited' {
  const end = parseISO(comparison.end)
  const today = new Date()
  const daysSinceEnd = differenceInDays(today, end)

  if (daysSinceEnd < 90) return 'full'
  if (daysSinceEnd < 365) return 'partial'
  return 'limited'
}

function getPeriodLength(comparison: ComparisonPeriod): number {
  const start = parseISO(comparison.start)
  const end = parseISO(comparison.end)
  return differenceInDays(end, start) + 1
}

function getHistoricalContext(comparison: ComparisonPeriod): string | undefined {
  const start = parseISO(comparison.start)
  const end = parseISO(comparison.end)
  const month = start.getMonth()
  const year = start.getFullYear()
  
  // Check for specific periods
  if (month === 11 && start.getDate() <= 25 && end.getDate() >= 25) {
    return 'Holiday season'
  }
  if (month === 10 && start.getDate() <= 24 && end.getDate() >= 24) {
    return 'Black Friday period'
  }
  if (month === 0 && start.getDate() === 1) {
    return 'New Year period'
  }
  if (month === 6 && start.getDate() <= 15 && end.getDate() >= 15) {
    return 'Prime Day period'
  }
  
  // Return quarter info for monthly/quarterly comparisons
  if (comparison.type === PeriodType.MONTHLY || comparison.type === PeriodType.QUARTERLY) {
    const quarter = Math.floor(month / 3) + 1
    return `Q${quarter} ${year}`
  }
  
  return undefined
}

function renderConfidenceIndicator(confidence: 'high' | 'medium' | 'low') {
  const colors = {
    high: 'text-green-600',
    medium: 'text-yellow-600',
    low: 'text-gray-400',
  }

  const dots = confidence === 'high' ? 3 : confidence === 'medium' ? 2 : 1

  return (
    <div 
      className="flex space-x-1"
      data-testid={`confidence-${confidence}`}
      aria-label={`${confidence} confidence`}
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-2 w-2 rounded-full',
            i < dots ? colors[confidence] : 'bg-gray-200'
          )}
        />
      ))}
    </div>
  )
}