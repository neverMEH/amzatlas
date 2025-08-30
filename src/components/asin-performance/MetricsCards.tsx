'use client'

import React from 'react'
import { TrendingUp, TrendingDown, ShoppingCart, MousePointer, Package, Eye } from 'lucide-react'
import { format } from 'date-fns'

interface MetricsData {
  totals: {
    impressions: number
    clicks: number
    cartAdds: number
    purchases: number
  }
  rates: {
    clickThroughRate: number
    cartAddRate: number
    purchaseRate: number
    overallConversionRate: number
  }
}

interface ComparisonData {
  metrics: MetricsData
  changes: {
    impressions: number
    clicks: number
    purchases: number
    conversionRate: number
  }
}

interface MetricsCardsProps {
  data?: MetricsData
  comparisonData?: ComparisonData
  dateRange?: { start: string; end: string }
  comparisonDateRange?: { start: string; end: string }
  isLoading: boolean
  error: Error | null
}

interface MetricCardProps {
  title: string
  value: string | number
  subtext?: string
  change?: number
  icon: React.ReactNode
  isLoading?: boolean
  comparisonDateRange?: { start: string; end: string }
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

function formatPercentage(num: number, decimals: number = 2): string {
  return `${(num * 100).toFixed(decimals)}%`
}

function formatDateRange(start: string, end: string): string {
  return `${format(new Date(start), 'MMM d')} - ${format(new Date(end), 'MMM d, yyyy')}`
}

function MetricCard({ title, value, subtext, change, icon, isLoading, comparisonDateRange }: MetricCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse" data-testid="metric-card-skeleton">
        <div className="flex items-center justify-between mb-4">
          <div className="h-10 w-10 bg-gray-200 rounded-lg"></div>
          <div className="h-4 w-16 bg-gray-200 rounded"></div>
        </div>
        <div className="h-8 w-24 bg-gray-200 rounded mb-2"></div>
        <div className="h-4 w-20 bg-gray-200 rounded"></div>
      </div>
    )
  }

  const isPositive = change !== undefined && change > 0
  const isNegative = change !== undefined && change < 0
  const changeColor = isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
          {icon}
        </div>
        {change !== undefined && (
          <div 
            className={`flex items-center space-x-1 text-sm font-medium ${changeColor}`}
            title={comparisonDateRange ? `vs ${formatDateRange(comparisonDateRange.start, comparisonDateRange.end)}` : 'vs previous period'}
          >
            {isPositive && (
              <>
                <TrendingUp className="h-4 w-4" data-testid="trend-up" />
                <span>+{formatPercentage(change, 1)}</span>
              </>
            )}
            {isNegative && (
              <>
                <TrendingDown className="h-4 w-4" data-testid="trend-down" />
                <span>{formatPercentage(change, 1)}</span>
              </>
            )}
            {!isPositive && !isNegative && <span>0.0%</span>}
          </div>
        )}
      </div>
      <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {subtext && <p className="text-sm text-gray-500 mt-1">{subtext}</p>}
    </div>
  )
}

export function MetricsCards({ data, comparisonData, dateRange, comparisonDateRange, isLoading, error }: MetricsCardsProps) {
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-800 font-medium">Error loading metrics</p>
        <p className="text-red-600 text-sm mt-1">{error.message}</p>
      </div>
    )
  }

  const metrics = [
    {
      title: 'Impressions',
      value: data ? formatNumber(data.totals.impressions) : '0',
      icon: <Eye className="h-6 w-6" />,
      change: comparisonData?.changes.impressions,
    },
    {
      title: 'Clicks',
      value: data ? formatNumber(data.totals.clicks) : '0',
      subtext: data ? `${formatPercentage(data.rates.clickThroughRate)} CTR` : '0.00% CTR',
      icon: <MousePointer className="h-6 w-6" />,
      change: comparisonData?.changes.clicks,
    },
    {
      title: 'Cart Adds',
      value: data ? formatNumber(data.totals.cartAdds) : '0',
      subtext: data ? `${formatPercentage(data.rates.cartAddRate)} of clicks` : '0.00% of clicks',
      icon: <ShoppingCart className="h-6 w-6" />,
      change: comparisonData ? 
        (comparisonData.metrics.totals.cartAdds > 0 ? 
          (data!.totals.cartAdds - comparisonData.metrics.totals.cartAdds) / comparisonData.metrics.totals.cartAdds : 
          0) : undefined,
    },
    {
      title: 'Purchases',
      value: data ? formatNumber(data.totals.purchases) : '0',
      subtext: data ? `${formatPercentage(data.rates.overallConversionRate)} CVR` : '0.00% CVR',
      icon: <Package className="h-6 w-6" />,
      change: comparisonData?.changes.purchases,
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-6">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.title}
          {...metric}
          isLoading={isLoading}
          comparisonDateRange={comparisonDateRange}
        />
      ))}
    </div>
  )
}