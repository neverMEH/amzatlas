'use client'

import React from 'react'
import { Eye, MousePointer, ShoppingCart, Package, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

interface FunnelData {
  impressions: number
  clicks: number
  cartAdds: number
  purchases: number
}

interface KeywordFunnelChartProps {
  data: FunnelData | null
  comparisonData?: FunnelData | null
  keyword: string
  dateRange?: { start: string; end: string }
  comparisonDateRange?: { start: string; end: string }
  isLoading: boolean
  error: Error | null
}

interface FunnelStage {
  label: string
  value: number
  icon: React.ReactNode
  color: string
  bgColor: string
  key: string
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

function formatPercentage(num: number, decimals: number = 2): string {
  return `${(num * 100).toFixed(decimals)}%`
}

function calculateConversionRate(from: number, to: number): number {
  return from > 0 ? to / from : 0
}

function calculatePercentageChange(current: number, previous: number): number {
  return previous > 0 ? (current - previous) / previous : 0
}

function formatDateRange(start: string, end: string): string {
  return `${format(new Date(start), 'MMM d')} - ${format(new Date(end), 'MMM d, yyyy')}`
}

export function KeywordFunnelChart({ 
  data, 
  comparisonData,
  keyword,
  dateRange,
  comparisonDateRange,
  isLoading, 
  error 
}: KeywordFunnelChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse" data-testid="funnel-skeleton">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <p className="text-red-800 font-medium">Error loading funnel data</p>
          <p className="text-red-600 text-sm mt-1">{error.message}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12 text-gray-500">
          <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="font-medium">No funnel data available</p>
          <p className="text-sm mt-1">Select a keyword to view conversion funnel</p>
        </div>
      </div>
    )
  }

  const stages: FunnelStage[] = [
    {
      label: 'Impressions',
      value: data.impressions,
      icon: <Eye className="h-5 w-5" />,
      color: 'text-blue-700',
      bgColor: 'bg-blue-100',
      key: 'impressions',
    },
    {
      label: 'Clicks',
      value: data.clicks,
      icon: <MousePointer className="h-5 w-5" />,
      color: 'text-green-700',
      bgColor: 'bg-green-100',
      key: 'clicks',
    },
    {
      label: 'Cart Adds',
      value: data.cartAdds,
      icon: <ShoppingCart className="h-5 w-5" />,
      color: 'text-amber-700',
      bgColor: 'bg-amber-100',
      key: 'cart-adds',
    },
    {
      label: 'Purchases',
      value: data.purchases,
      icon: <Package className="h-5 w-5" />,
      color: 'text-red-700',
      bgColor: 'bg-red-100',
      key: 'purchases',
    },
  ]

  const conversionRates = [
    { label: 'CTR', value: calculateConversionRate(data.impressions, data.clicks) },
    { label: 'Cart Add Rate', value: calculateConversionRate(data.clicks, data.cartAdds) },
    { label: 'Purchase Rate', value: calculateConversionRate(data.cartAdds, data.purchases) },
  ]

  const overallCVR = calculateConversionRate(data.impressions, data.purchases)
  const maxValue = data.impressions

  const getComparisonChange = (current: number, stageKey: string): number | null => {
    if (!comparisonData) return null
    
    const comparisonMap: Record<string, number> = {
      'impressions': comparisonData.impressions,
      'clicks': comparisonData.clicks,
      'cart-adds': comparisonData.cartAdds,
      'purchases': comparisonData.purchases,
    }
    
    const previous = comparisonMap[stageKey]
    return previous !== undefined ? calculatePercentageChange(current, previous) : null
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Conversion Funnel: {keyword}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Overall CVR: <span className="font-medium text-gray-900">{formatPercentage(overallCVR)}</span>
            {dateRange && (
              <span className="ml-4">
                {formatDateRange(dateRange.start, dateRange.end)}
                {comparisonDateRange && (
                  <span className="ml-2 text-gray-400">
                    vs {formatDateRange(comparisonDateRange.start, comparisonDateRange.end)}
                  </span>
                )}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {stages.map((stage, index) => {
          const widthPercentage = maxValue > 0 ? (stage.value / maxValue) * 100 : 0
          const change = getComparisonChange(stage.value, stage.key)
          const showTrend = change !== null
          const isPositive = change !== null && change > 0
          const TrendIcon = isPositive ? TrendingUp : TrendingDown
          const trendColor = isPositive ? 'text-green-600' : 'text-red-600'
          const tooltipText = comparisonDateRange 
            ? `vs ${formatDateRange(comparisonDateRange.start, comparisonDateRange.end)}`
            : 'vs previous period'

          return (
            <div key={stage.key}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className={`p-2 rounded-lg ${stage.bgColor} ${stage.color}`}>
                    {stage.icon}
                  </div>
                  <div>
                    <span className="font-medium text-gray-900">{stage.label}</span>
                    <span className="ml-2 text-gray-600">{formatNumber(stage.value)}</span>
                  </div>
                </div>
                {showTrend && (
                  <div 
                    className={`flex items-center space-x-1 ${trendColor}`}
                    data-testid={`${stage.key}-trend`}
                    title={tooltipText}
                  >
                    <TrendIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {isPositive ? '+' : ''}{formatPercentage(Math.abs(change), 1)}
                    </span>
                  </div>
                )}
              </div>
              <div className="relative bg-gray-200 rounded-full h-8 overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 ${stage.bgColor.replace('100', '500')} transition-all duration-500`}
                  style={{ width: `${Math.max(0.75, widthPercentage)}%` }}
                  data-testid={`funnel-bar-${stage.key}`}
                />
              </div>
              {index < stages.length - 1 && (
                <div className="mt-2 text-right">
                  <span className="text-sm text-gray-500">
                    {conversionRates[index].label}: {formatPercentage(conversionRates[index].value)}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}