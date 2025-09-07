'use client'

import React, { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, Legend } from 'recharts'
import { TrendingUp, TrendingDown, Minus, Eye, EyeOff, ChevronDown, ChevronUp, Download } from 'lucide-react'

export interface WaterfallDataPoint {
  keyword: string
  current: number
  previous: number
  change: number
  changePercent: number
}

export interface WaterfallChartProps {
  data: WaterfallDataPoint[]
  metric?: 'impressions' | 'clicks' | 'cartAdds' | 'purchases'
  title?: string
  isLoading?: boolean
  error?: Error | null
  className?: string
  onMetricChange?: (metric: 'impressions' | 'clicks' | 'cartAdds' | 'purchases') => void
  metrics?: {
    impressions: WaterfallDataPoint[]
    clicks: WaterfallDataPoint[]
    cartAdds: WaterfallDataPoint[]
    purchases: WaterfallDataPoint[]
  }
}

type SortOption = 'impact' | 'percentage' | 'alphabetical' | 'current' | 'previous'
type ViewMode = 'waterfall' | 'comparison' | 'absolute'

const METRIC_LABELS = {
  impressions: 'Impressions',
  clicks: 'Clicks',
  cartAdds: 'Cart Adds',
  purchases: 'Purchases'
}

const METRIC_COLORS = {
  positive: '#10B981', // Green
  negative: '#EF4444', // Red
  neutral: '#6B7280',  // Gray
  total: '#3B82F6',    // Blue
  current: '#8B5CF6',  // Purple
  previous: '#F59E0B'  // Amber
}

function formatNumber(num: number, compact: boolean = true): string {
  if (!compact) {
    return num.toLocaleString()
  }
  if (Math.abs(num) >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (Math.abs(num) >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toLocaleString()
}

function formatPercentage(num: number): string {
  return `${num > 0 ? '+' : ''}${num.toFixed(1)}%`
}

function truncateKeyword(keyword: string, maxLength: number = 30): string {
  if (keyword.length <= maxLength) return keyword
  return `${keyword.substring(0, maxLength - 3)}...`
}

export function WaterfallChartEnhanced({ 
  data, 
  metric = 'impressions',
  title = 'Keyword Performance Waterfall',
  isLoading = false,
  error = null,
  className = '',
  onMetricChange,
  metrics
}: WaterfallChartProps) {
  const [sortBy, setSortBy] = useState<SortOption>('impact')
  const [showTop, setShowTop] = useState(10)
  const [viewMode, setViewMode] = useState<ViewMode>('waterfall')
  const [selectedMetric, setSelectedMetric] = useState(metric)
  const [showDetails, setShowDetails] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Use provided metrics data or fallback to single metric data
  const currentData = metrics ? metrics[selectedMetric] : data

  // Sort and slice data
  const sortedData = useMemo(() => {
    if (!currentData || currentData.length === 0) return []

    let sorted = [...currentData]

    switch (sortBy) {
      case 'impact':
        // Sort by absolute impact (change * current value weight)
        sorted = sorted.sort((a, b) => {
          const impactA = Math.abs(a.change) * Math.log(a.current + 1)
          const impactB = Math.abs(b.change) * Math.log(b.current + 1)
          return impactB - impactA
        })
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
  }, [currentData, sortBy, showTop])

  // Transform data for waterfall view
  const waterfallData = useMemo(() => {
    if (!sortedData.length) return []

    let cumulative = 0
    const totalPrevious = sortedData.reduce((sum, item) => sum + item.previous, 0)
    
    // Start with total previous period
    const result: Array<{
      keyword: string
      value: number
      cumulative: number
      type: 'total' | 'positive' | 'negative' | 'neutral'
      displayName: string
      color: string
      isTotal: boolean
      originalData: WaterfallDataPoint | null
    }> = [{
      keyword: 'Previous Total',
      value: totalPrevious,
      cumulative: 0,
      type: 'total' as const,
      displayName: 'Previous Total',
      color: METRIC_COLORS.total,
      isTotal: true,
      originalData: null as WaterfallDataPoint | null
    }]
    
    cumulative = totalPrevious

    // Add changes
    sortedData.forEach((item, index) => {
      result.push({
        keyword: item.keyword,
        value: item.change,
        cumulative: cumulative,
        type: item.change > 0 ? 'positive' : 
              item.change < 0 ? 'negative' : 
              'neutral',
        displayName: truncateKeyword(item.keyword),
        color: item.change > 0 ? METRIC_COLORS.positive : 
               item.change < 0 ? METRIC_COLORS.negative : 
               METRIC_COLORS.neutral,
        isTotal: false,
        originalData: item
      })
      cumulative += item.change
    })

    // Add current total
    result.push({
      keyword: 'Current Total',
      value: cumulative,
      cumulative: 0,
      type: 'total' as const,
      displayName: 'Current Total',
      color: METRIC_COLORS.total,
      isTotal: true,
      originalData: null
    })

    return result
  }, [sortedData])

  // Transform data for comparison view
  const comparisonData = useMemo(() => {
    return sortedData.map((item, index) => ({
      keyword: truncateKeyword(item.keyword),
      fullKeyword: item.keyword,
      previous: item.previous,
      current: item.current,
      change: item.change,
      changePercent: item.changePercent,
      index
    }))
  }, [sortedData])

  // Handle metric change
  const handleMetricChange = (newMetric: typeof selectedMetric) => {
    setSelectedMetric(newMetric)
    if (onMetricChange) {
      onMetricChange(newMetric)
    }
  }

  // Custom tooltip for waterfall
  const WaterfallTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null

    const data = payload[0].payload
    
    if (data.isTotal) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4">
          <div className="font-semibold text-gray-900">{data.keyword}</div>
          <div className="text-sm mt-1">
            <span className="text-gray-600">Total: </span>
            <span className="font-medium">{formatNumber(data.value, false)}</span>
          </div>
        </div>
      )
    }

    const original = data.originalData
    const changeIcon = original.change > 0 ? <TrendingUp className="h-4 w-4 text-green-600" /> :
                      original.change < 0 ? <TrendingDown className="h-4 w-4 text-red-600" /> :
                      <Minus className="h-4 w-4 text-gray-600" />

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[250px]">
        <div className="font-semibold text-gray-900 mb-2">{original.keyword}</div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Previous:</span>
            <span className="font-medium">{formatNumber(original.previous, false)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Current:</span>
            <span className="font-medium">{formatNumber(original.current, false)}</span>
          </div>
          <div className="border-t border-gray-100 pt-1 flex items-center justify-between">
            <span className="text-gray-600">Change:</span>
            <div className="flex items-center space-x-1">
              {changeIcon}
              <span className={`font-medium ${
                original.change > 0 ? 'text-green-600' : 
                original.change < 0 ? 'text-red-600' : 
                'text-gray-600'
              }`}>
                {formatNumber(Math.abs(original.change), false)} ({formatPercentage(original.changePercent)})
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Custom bar shape for waterfall effect
  const WaterfallBar = (props: any) => {
    const { fill, x, y, width, height, payload } = props
    const isNegative = payload.type === 'negative'
    
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={fill}
          fillOpacity={hoveredIndex !== null && payload.index !== hoveredIndex ? 0.3 : 1}
          stroke={fill}
          strokeWidth={1}
          rx={2}
        />
        {!payload.isTotal && (
          <line
            x1={x + width}
            y1={y + (isNegative ? height : 0)}
            x2={x + width + 20}
            y2={y + (isNegative ? height : 0)}
            stroke="#e5e7eb"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
      </g>
    )
  }

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
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

  if (!currentData || currentData.length === 0) {
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        
        <div className="flex items-center space-x-4">
          {/* Metric selector */}
          {metrics && (
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">Metric:</label>
              <select
                value={selectedMetric}
                onChange={(e) => handleMetricChange(e.target.value as typeof selectedMetric)}
                className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(METRIC_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          )}

          {/* View mode toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('waterfall')}
              className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                viewMode === 'waterfall'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Waterfall
            </button>
            <button
              onClick={() => setViewMode('comparison')}
              className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                viewMode === 'comparison'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Side-by-Side
            </button>
          </div>

          {/* Sort controls */}
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="impact">Impact</option>
              <option value="percentage">Change %</option>
              <option value="current">Current</option>
              <option value="previous">Previous</option>
              <option value="alphabetical">A-Z</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">Show:</label>
            <select
              value={showTop}
              onChange={(e) => setShowTop(parseInt(e.target.value))}
              className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={15}>Top 15</option>
              <option value={20}>Top 20</option>
              <option value={999}>All</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {METRIC_LABELS[selectedMetric]} - showing {sortedData.length} of {currentData.length} keywords
        </p>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center space-x-1"
        >
          {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          <span>{showDetails ? 'Hide' : 'Show'} Details</span>
        </button>
      </div>

      {/* Chart */}
      {viewMode === 'waterfall' ? (
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={waterfallData}
              margin={{ top: 20, right: 30, left: 60, bottom: 80 }}
              onMouseMove={(e) => {
                if (e && e.activeTooltipIndex !== undefined && typeof e.activeTooltipIndex === 'number') {
                  setHoveredIndex(e.activeTooltipIndex)
                }
              }}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="displayName" 
                angle={-45}
                textAnchor="end"
                height={100}
                interval={0}
                tick={{ fontSize: 11 }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => formatNumber(value)}
              />
              <Tooltip content={<WaterfallTooltip />} />
              <ReferenceLine y={0} stroke="#666" />
              <Bar 
                dataKey="value" 
                shape={<WaterfallBar />}
                isAnimationActive={false}
              >
                {waterfallData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-96 overflow-auto">
          {/* Comparison view as a table */}
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Keyword
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Previous
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Change
                </th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {comparisonData.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900" title={item.fullKeyword}>
                    {item.keyword}
                  </td>
                  <td className="px-4 py-2 text-sm text-right text-gray-600">
                    {formatNumber(item.previous, false)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
                    {formatNumber(item.current, false)}
                  </td>
                  <td className={`px-4 py-2 text-sm text-right font-medium ${
                    item.change > 0 ? 'text-green-600' : 
                    item.change < 0 ? 'text-red-600' : 
                    'text-gray-600'
                  }`}>
                    {formatNumber(item.change, false)} ({formatPercentage(item.changePercent)})
                  </td>
                  <td className="px-4 py-2 text-center">
                    {item.change > 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600 inline" />
                    ) : item.change < 0 ? (
                      <TrendingDown className="h-4 w-4 text-red-600 inline" />
                    ) : (
                      <Minus className="h-4 w-4 text-gray-600 inline" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Details section */}
      {showDetails && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Summary Statistics</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 uppercase">Total Previous</div>
              <div className="text-lg font-semibold text-gray-900">
                {formatNumber(sortedData.reduce((sum, item) => sum + item.previous, 0), false)}
              </div>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 uppercase">Total Current</div>
              <div className="text-lg font-semibold text-gray-900">
                {formatNumber(sortedData.reduce((sum, item) => sum + item.current, 0), false)}
              </div>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 uppercase">Net Change</div>
              <div className={`text-lg font-semibold ${
                sortedData.reduce((sum, item) => sum + item.change, 0) > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatNumber(sortedData.reduce((sum, item) => sum + item.change, 0), false)}
              </div>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 uppercase">Avg Change %</div>
              <div className="text-lg font-semibold text-gray-900">
                {formatPercentage(
                  sortedData.reduce((sum, item) => sum + item.changePercent, 0) / sortedData.length
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}