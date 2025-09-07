'use client'

import React, { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export interface WaterfallDataPoint {
  keyword: string
  current: number
  previous: number
  change: number
  changePercent: number
}

export interface WaterfallChartProps {
  data: WaterfallDataPoint[]
  metric: 'impressions' | 'clicks' | 'cartAdds' | 'purchases'
  title?: string
  isLoading?: boolean
  error?: Error | null
  className?: string
}

type SortOption = 'absolute' | 'percentage' | 'alphabetical' | 'current' | 'previous'

const METRIC_LABELS = {
  impressions: 'Impressions',
  clicks: 'Clicks',
  cartAdds: 'Cart Adds',
  purchases: 'Purchases'
}

const METRIC_COLORS = {
  positive: '#10B981', // Green
  negative: '#EF4444', // Red
  neutral: '#6B7280'   // Gray
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toLocaleString()
}

function formatPercentage(num: number): string {
  return `${num > 0 ? '+' : ''}${num.toFixed(1)}%`
}

export function WaterfallChart({ 
  data, 
  metric, 
  title = 'Keyword Performance Changes',
  isLoading = false,
  error = null,
  className = ''
}: WaterfallChartProps) {
  const [sortBy, setSortBy] = useState<SortOption>('absolute')
  const [showTop, setShowTop] = useState(10)

  // Sort and slice data
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return []

    let sorted = [...data]

    switch (sortBy) {
      case 'absolute':
        sorted = sorted.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        break
      case 'percentage':
        sorted = sorted.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
        break
      case 'alphabetical':
        sorted = sorted.sort((a, b) => a.keyword.localeCompare(b.keyword))
        break
      case 'current':
        sorted = sorted.sort((a, b) => b.current - a.current)
        break
      case 'previous':
        sorted = sorted.sort((a, b) => b.previous - a.previous)
        break
    }

    return sorted.slice(0, showTop)
  }, [data, sortBy, showTop])

  // Transform data for recharts
  const chartData = useMemo(() => {
    return sortedData.map((item, index) => ({
      ...item,
      index,
      displayName: item.keyword.length > 20 ? `${item.keyword.substring(0, 17)}...` : item.keyword,
      color: item.change > 0 ? METRIC_COLORS.positive : 
             item.change < 0 ? METRIC_COLORS.negative : 
             METRIC_COLORS.neutral
    }))
  }, [sortedData])

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null

    const data = payload[0].payload
    const changeIcon = data.change > 0 ? <TrendingUp className="h-4 w-4 text-green-600" /> :
                      data.change < 0 ? <TrendingDown className="h-4 w-4 text-red-600" /> :
                      <Minus className="h-4 w-4 text-gray-600" />

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[200px]">
        <div className="font-semibold text-gray-900 mb-2">{data.keyword}</div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Previous:</span>
            <span className="font-medium">{formatNumber(data.previous)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Current:</span>
            <span className="font-medium">{formatNumber(data.current)}</span>
          </div>
          <div className="border-t border-gray-100 pt-1 flex items-center justify-between">
            <span className="text-gray-600">Change:</span>
            <div className="flex items-center space-x-1">
              {changeIcon}
              <span className={`font-medium ${
                data.change > 0 ? 'text-green-600' : 
                data.change < 0 ? 'text-red-600' : 
                'text-gray-600'
              }`}>
                {formatNumber(Math.abs(data.change))} ({formatPercentage(data.changePercent)})
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="text-center text-red-600">
          <p className="text-sm">Error loading waterfall chart: {error.message}</p>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="text-center text-gray-500 py-12">
          <p>No comparison data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label htmlFor="sort-select" className="text-sm text-gray-600">Sort by:</label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="absolute">Change (Absolute)</option>
              <option value="percentage">Change (%)</option>
              <option value="current">Current Value</option>
              <option value="previous">Previous Value</option>
              <option value="alphabetical">Keyword A-Z</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <label htmlFor="show-select" className="text-sm text-gray-600">Show:</label>
            <select
              id="show-select"
              value={showTop}
              onChange={(e) => setShowTop(parseInt(e.target.value))}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={15}>Top 15</option>
              <option value={20}>Top 20</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-600">
          {METRIC_LABELS[metric]} comparison - showing {sortedData.length} of {data.length} keywords
        </p>
      </div>

      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="displayName" 
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickFormatter={formatNumber}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="change" name="Change">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 mt-4 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: METRIC_COLORS.positive }}></div>
          <span className="text-gray-600">Increase</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: METRIC_COLORS.negative }}></div>
          <span className="text-gray-600">Decrease</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: METRIC_COLORS.neutral }}></div>
          <span className="text-gray-600">No Change</span>
        </div>
      </div>
    </div>
  )
}