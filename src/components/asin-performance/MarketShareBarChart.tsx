'use client'

import React, { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'
import { TrendingUp, TrendingDown, AlertCircle, BarChartIcon, ExternalLink, Filter } from 'lucide-react'

interface MarketShareData {
  totalMarket: {
    impressions: number
    clicks: number
    purchases: number
  }
  competitors: Array<{
    asin: string
    brand: string
    title: string
    impressionShare: number
    clickShare: number
    purchaseShare: number
  }>
}

interface EnhancedCompetitor {
  asin: string
  brand: string
  title: string
  impressionShare: number
  clickShare: number
  purchaseShare: number
  conversionRate: number
  clickThroughRate: number
  totalPurchases: number
  totalClicks: number
  totalImpressions: number
}

interface MarketShareBarChartProps {
  data: MarketShareData | null
  comparisonData?: MarketShareData | null
  keyword: string
  asin: string
  isLoading: boolean
  error: Error | null
}

type MetricType = 'impressions' | 'clicks' | 'purchases' | 'ctr' | 'cvr'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#a855f7']

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toLocaleString()
}

function formatPercentage(num: number, decimals: number = 1): string {
  return `${(num * 100).toFixed(decimals)}%`
}

function truncateProductName(title: string, maxLength: number = 20): string {
  if (!title) return '[No product name]'
  if (title.length <= maxLength) return title
  return title.substring(0, maxLength) + '...'
}

export function MarketShareBarChart({
  data,
  comparisonData,
  keyword,
  asin,
  isLoading,
  error,
}: MarketShareBarChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('impressions')
  const [showTopN, setShowTopN] = useState<number>(10)
  const [sortByConversion, setSortByConversion] = useState(true)

  // Calculate enhanced metrics for each competitor
  const enhancedCompetitors = useMemo(() => {
    if (!data) return []
    
    return data.competitors.map(competitor => {
      const totalImpressions = competitor.impressionShare * data.totalMarket.impressions
      const totalClicks = competitor.clickShare * data.totalMarket.clicks
      const totalPurchases = competitor.purchaseShare * data.totalMarket.purchases
      
      const conversionRate = totalClicks > 0 ? totalPurchases / totalClicks : 0
      const clickThroughRate = totalImpressions > 0 ? totalClicks / totalImpressions : 0
      
      return {
        ...competitor,
        conversionRate,
        clickThroughRate,
        totalPurchases: Math.round(totalPurchases),
        totalClicks: Math.round(totalClicks),
        totalImpressions: Math.round(totalImpressions),
      } as EnhancedCompetitor
    })
  }, [data])

  // Sort competitors based on selected criteria
  const sortedCompetitors = useMemo(() => {
    const sorted = [...enhancedCompetitors].sort((a, b) => {
      if (sortByConversion) {
        // Primary sort by conversion rate
        const cvrDiff = b.conversionRate - a.conversionRate
        if (Math.abs(cvrDiff) > 0.001) return cvrDiff
      }
      
      // Sort by selected metric
      switch (selectedMetric) {
        case 'impressions':
          return b.totalImpressions - a.totalImpressions
        case 'clicks':
          return b.totalClicks - a.totalClicks
        case 'purchases':
          return b.totalPurchases - a.totalPurchases
        case 'ctr':
          return b.clickThroughRate - a.clickThroughRate
        case 'cvr':
          return b.conversionRate - a.conversionRate
        default:
          return 0
      }
    })
    
    return sorted.slice(0, showTopN)
  }, [enhancedCompetitors, selectedMetric, showTopN, sortByConversion])

  // Prepare data for bar chart
  const chartData = useMemo(() => {
    return sortedCompetitors.map(competitor => {
      let value = 0
      switch (selectedMetric) {
        case 'impressions':
          value = competitor.totalImpressions
          break
        case 'clicks':
          value = competitor.totalClicks
          break
        case 'purchases':
          value = competitor.totalPurchases
          break
        case 'ctr':
          value = competitor.clickThroughRate * 100
          break
        case 'cvr':
          value = competitor.conversionRate * 100
          break
      }
      
      return {
        asin: competitor.asin,
        title: truncateProductName(competitor.title),
        value,
        fullTitle: competitor.title,
        isCurrentAsin: competitor.asin === asin,
      }
    })
  }, [sortedCompetitors, selectedMetric, asin])

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse" data-testid="bar-chart-skeleton">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <p className="text-red-800 font-medium">Error loading market share</p>
          <p className="text-red-600 text-sm mt-1">{error.message}</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <BarChartIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-900 font-medium">No market share data available</p>
          <p className="text-gray-500 text-sm mt-1">
            Select a keyword to view market share analysis
          </p>
        </div>
      </div>
    )
  }

  const metricLabels = {
    impressions: 'Impressions',
    clicks: 'Clicks',
    purchases: 'Purchases',
    ctr: 'Click-Through Rate (%)',
    cvr: 'Conversion Rate (%)',
  }

  const getYAxisLabel = () => {
    switch (selectedMetric) {
      case 'ctr':
      case 'cvr':
        return 'Percentage (%)'
      default:
        return 'Count'
    }
  }

  const formatYAxis = (value: number) => {
    if (selectedMetric === 'ctr' || selectedMetric === 'cvr') {
      return `${value.toFixed(1)}%`
    }
    return formatNumber(value)
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{data.asin}</p>
          <p className="text-xs text-gray-500 mb-2">{data.fullTitle}</p>
          <p className="text-sm">
            <span className="font-medium">{metricLabels[selectedMetric]}:</span>{' '}
            {selectedMetric === 'ctr' || selectedMetric === 'cvr'
              ? formatPercentage(data.value / 100)
              : formatNumber(data.value)}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Market Share Analysis: {keyword}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Competitive landscape by {metricLabels[selectedMetric].toLowerCase()}
        </p>
      </div>

      {/* Filters and controls */}
      <div className="mb-6 space-y-4">
        {/* Metric selector */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(metricLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSelectedMetric(key as MetricType)}
              className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                selectedMetric === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Additional filters */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <label className="text-sm text-gray-700">Show top:</label>
            <select
              value={showTopN}
              onChange={(e) => setShowTopN(Number(e.target.value))}
              className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={20}>20</option>
            </select>
          </div>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={sortByConversion}
              onChange={(e) => setSortByConversion(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Sort by conversion rate</span>
          </label>
        </div>
      </div>

      {/* Bar chart */}
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 60, bottom: 80 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="asin"
              angle={-45}
              textAnchor="end"
              height={100}
              tick={{ fontSize: 12 }}
              interval={0}
            />
            <YAxis
              label={{ value: getYAxisLabel(), angle: -90, position: 'insideLeft' }}
              tickFormatter={formatYAxis}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isCurrentAsin ? '#3b82f6' : COLORS[index % COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center space-x-4 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-600 rounded"></div>
          <span className="text-gray-700">Current ASIN ({asin})</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-orange-500 rounded"></div>
          <span className="text-gray-700">Competitors</span>
        </div>
      </div>
    </div>
  )
}