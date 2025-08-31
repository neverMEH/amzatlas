'use client'

import React, { memo } from 'react'
import { SparklineChart } from './SparklineChart'

export interface MetricSparklineProps {
  data: Array<Record<string, any>>
  metric: string
  label: string
  currentValue: number
  comparisonValue?: number
  chartType?: 'line' | 'bar' | 'area'
  color?: string
  height?: number
  formatValue?: (value: number) => string
  className?: string
  isLoading?: boolean
}

function defaultFormatValue(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+∞' : '0.0%'
  const change = ((current - previous) / previous) * 100
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`
}

function MetricSparklineComponent({
  data,
  metric,
  label,
  currentValue,
  comparisonValue,
  chartType = 'line',
  color = '#3B82F6',
  height = 40,
  formatValue = defaultFormatValue,
  className = '',
  isLoading = false,
}: MetricSparklineProps) {
  if (isLoading) {
    return (
      <div className={`${className} animate-pulse`} data-testid="metric-sparkline-skeleton">
        <div className="flex items-center justify-between mb-1">
          <div className="h-4 bg-gray-200 rounded w-20"></div>
          <div className="h-5 bg-gray-200 rounded w-16"></div>
        </div>
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    )
  }

  const showChange = comparisonValue !== undefined
  const changeValue = showChange ? formatChange(currentValue, comparisonValue) : null
  const changeClass = 
    currentValue > (comparisonValue || 0) ? 'text-green-600' : 
    currentValue < (comparisonValue || 0) ? 'text-red-600' : 
    'text-gray-500'

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-600 truncate">{label}</span>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-gray-900">
            {formatValue(currentValue)}
          </span>
          {showChange && (
            <span className={`text-xs ${changeClass}`}>
              {changeValue}
            </span>
          )}
        </div>
      </div>
      <SparklineChart
        data={data}
        dataKey={metric}
        type={chartType}
        color={color}
        height={height}
        className="w-full"
      />
    </div>
  )
}

export const MetricSparkline = memo(MetricSparklineComponent)