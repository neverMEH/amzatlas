'use client'

import React, { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { format } from 'date-fns'
import { TrendingUp, AlertCircle } from 'lucide-react'

interface ChartDataPoint {
  date: string
  impressions: number
  clicks: number
  cartAdds: number
  purchases: number
  clickRate: number
  cartAddRate: number
  purchaseRate: number
}

interface KeywordPerformanceChartProps {
  data: ChartDataPoint[]
  comparisonData?: ChartDataPoint[]
  keyword: string
  dateRange?: { start: string; end: string }
  isLoading?: boolean
  error?: Error | null
}

interface MetricConfig {
  key: keyof ChartDataPoint
  label: string
  color: string
  comparisonColor?: string
  isRate?: boolean
  formatter?: (value: number) => string
}

const volumeMetrics: MetricConfig[] = [
  { key: 'impressions', label: 'Impressions', color: '#3b82f6' },
  { key: 'clicks', label: 'Clicks', color: '#10b981' },
  { key: 'cartAdds', label: 'Cart Adds', color: '#f59e0b' },
  { key: 'purchases', label: 'Purchases', color: '#ef4444' },
]

const rateMetrics: MetricConfig[] = [
  { key: 'clickRate', label: 'CTR', color: '#8b5cf6', isRate: true },
  { key: 'purchaseRate', label: 'CVR', color: '#ec4899', isRate: true },
]

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

function formatPercentage(num: number): string {
  return `${(num * 100).toFixed(2)}%`
}

function formatDateRange(start: string, end: string): string {
  return `${format(new Date(start), 'MMM d')} - ${format(new Date(end), 'MMM d, yyyy')}`
}

export function KeywordPerformanceChart({
  data,
  comparisonData,
  keyword,
  dateRange,
  isLoading = false,
  error = null,
}: KeywordPerformanceChartProps) {
  const [enabledMetrics, setEnabledMetrics] = useState<Set<string>>(
    new Set(['impressions', 'clicks', 'purchases'])
  )

  // Combine current and comparison data for the chart
  const chartData = useMemo(() => {
    if (!comparisonData) return data

    // Create a map of dates to combined data
    const dataMap = new Map<string, any>()

    // Add current data
    data.forEach((point) => {
      dataMap.set(point.date, {
        date: point.date,
        impressions: point.impressions,
        clicks: point.clicks,
        cartAdds: point.cartAdds,
        purchases: point.purchases,
        clickRate: point.clickRate,
        cartAddRate: point.cartAddRate,
        purchaseRate: point.purchaseRate,
      })
    })

    // Add comparison data with prefixed keys
    comparisonData.forEach((point, index) => {
      const currentPoint = data[index]
      if (currentPoint) {
        const existingData = dataMap.get(currentPoint.date) || {}
        dataMap.set(currentPoint.date, {
          ...existingData,
          comparisonImpressions: point.impressions,
          comparisonClicks: point.clicks,
          comparisonCartAdds: point.cartAdds,
          comparisonPurchases: point.purchases,
          comparisonClickRate: point.clickRate,
          comparisonCartAddRate: point.cartAddRate,
          comparisonPurchaseRate: point.purchaseRate,
        })
      }
    })

    return Array.from(dataMap.values())
  }, [data, comparisonData])

  const toggleMetric = (metricKey: string) => {
    setEnabledMetrics((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(metricKey)) {
        newSet.delete(metricKey)
      } else {
        newSet.add(metricKey)
      }
      return newSet
    })
  }

  const formatTooltipValue = (value: number, name: string) => {
    const isRate = name.toLowerCase().includes('rate') || name.includes('CTR') || name.includes('CVR')
    return isRate ? formatPercentage(value) : formatNumber(value)
  }

  const formatAxisTick = (value: number, isRate: boolean) => {
    return isRate ? formatPercentage(value) : formatNumber(value)
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse" data-testid="chart-skeleton">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
          <div className="mt-4 flex space-x-4">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="h-4 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <p className="text-red-800 font-medium">Error loading chart</p>
          <p className="text-red-600 text-sm mt-1">{error.message}</p>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <TrendingUp className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-900 font-medium">No data available</p>
          <p className="text-gray-500 text-sm mt-1">
            No performance data available for this keyword
          </p>
        </div>
      </div>
    )
  }

  const hasRateMetrics = Array.from(enabledMetrics).some((key) =>
    rateMetrics.some((m) => m.key === key)
  )

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Performance Trends: {keyword}
        </h3>
        {dateRange && (
          <p className="text-sm text-gray-500 mt-1">
            {formatDateRange(dateRange.start, dateRange.end)}
            {comparisonData && <span className="ml-2">Comparison: Enabled</span>}
          </p>
        )}
        {data.length === 1 && (
          <p className="text-sm text-amber-600 mt-1">
            Note: Showing single data point
          </p>
        )}
      </div>

      <div className="h-64 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(date) => format(new Date(date), 'MMM d')}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={(value) => formatAxisTick(value, false)}
            />
            {hasRateMetrics && (
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(value) => formatAxisTick(value, true)}
              />
            )}
            <Tooltip
              formatter={formatTooltipValue}
              labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
            />
            <Legend />

            {/* Current data lines */}
            {volumeMetrics.map((metric) =>
              enabledMetrics.has(metric.key) ? (
                <Line
                  key={metric.key}
                  yAxisId="left"
                  type="monotone"
                  dataKey={metric.key}
                  stroke={metric.color}
                  name={metric.label}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ) : null
            )}

            {rateMetrics.map((metric) =>
              enabledMetrics.has(metric.key) ? (
                <Line
                  key={metric.key}
                  yAxisId="right"
                  type="monotone"
                  dataKey={metric.key}
                  stroke={metric.color}
                  name={metric.label}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ) : null
            )}

            {/* Comparison data lines */}
            {comparisonData && (
              <>
                {volumeMetrics.map((metric) =>
                  enabledMetrics.has(metric.key) ? (
                    <Line
                      key={`comparison-${metric.key}`}
                      yAxisId="left"
                      type="monotone"
                      dataKey={`comparison${metric.key.charAt(0).toUpperCase() + metric.key.slice(1)}`}
                      stroke={metric.color}
                      name={`${metric.label} (Comparison)`}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 3 }}
                      opacity={0.6}
                    />
                  ) : null
                )}

                {rateMetrics.map((metric) =>
                  enabledMetrics.has(metric.key) ? (
                    <Line
                      key={`comparison-${metric.key}`}
                      yAxisId="right"
                      type="monotone"
                      dataKey={`comparison${metric.key.charAt(0).toUpperCase() + metric.key.slice(1)}`}
                      stroke={metric.color}
                      name={`${metric.label} (Comparison)`}
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 3 }}
                      opacity={0.6}
                    />
                  ) : null
                )}
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Metric toggles */}
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Volume Metrics</h4>
          <div className="flex flex-wrap gap-3">
            {volumeMetrics.map((metric) => (
              <label key={metric.key} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={enabledMetrics.has(metric.key)}
                  onChange={() => toggleMetric(metric.key)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  aria-label={`Show ${metric.label}`}
                />
                <span className="text-sm text-gray-600">{metric.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Rate Metrics</h4>
          <div className="flex flex-wrap gap-3">
            {rateMetrics.map((metric) => (
              <label key={metric.key} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={enabledMetrics.has(metric.key)}
                  onChange={() => toggleMetric(metric.key)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  aria-label={`Show ${metric.label}`}
                />
                <span className="text-sm text-gray-600">{metric.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}