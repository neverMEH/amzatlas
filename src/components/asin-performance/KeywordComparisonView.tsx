'use client'

import React, { useState, useMemo } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp, BarChart2, PieChartIcon, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

interface KeywordPerformanceData {
  impressions: number
  clicks: number
  purchases: number
}

interface ComparisonData {
  timeSeries: Array<{
    date: string
    [keyword: string]: KeywordPerformanceData | string
  }>
  marketShare: {
    [keyword: string]: number
  }
  funnels: {
    [keyword: string]: {
      impressions: number
      clicks: number
      cartAdds: number
      purchases: number
    }
  }
}

interface KeywordComparisonViewProps {
  keywords: string[]
  data: ComparisonData | null
  dateRange: { start: string; end: string }
  isLoading: boolean
  error: Error | null
}

type TabType = 'trends' | 'funnels' | 'market-share'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#a855f7']

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

function formatPercentage(num: number, decimals: number = 1): string {
  return `${(num * 100).toFixed(decimals)}%`
}

function formatDateRange(start: string, end: string): string {
  return `${format(new Date(start), 'MMM d')} - ${format(new Date(end), 'MMM d, yyyy')}`
}

export function KeywordComparisonView({
  keywords,
  data,
  dateRange,
  isLoading,
  error,
}: KeywordComparisonViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('trends')
  const displayKeywords = keywords.slice(0, 10)
  const remainingCount = keywords.length - 10

  const totalStats = useMemo(() => {
    if (!data?.funnels) return null
    
    let totalImpressions = 0
    let totalClicks = 0
    let totalPurchases = 0

    displayKeywords.forEach(keyword => {
      const funnel = data.funnels[keyword]
      if (funnel) {
        totalImpressions += funnel.impressions
        totalClicks += funnel.clicks
        totalPurchases += funnel.purchases
      }
    })

    return { totalImpressions, totalClicks, totalPurchases }
  }, [data, displayKeywords])

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse" data-testid="comparison-skeleton">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="flex space-x-2 mb-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-10 bg-gray-200 rounded w-32"></div>
            ))}
          </div>
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
          <p className="text-red-800 font-medium">Error loading comparison</p>
          <p className="text-red-600 text-sm mt-1">{error.message}</p>
        </div>
      </div>
    )
  }

  if (keywords.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <BarChart2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-900 font-medium">No keywords selected</p>
          <p className="text-gray-500 text-sm mt-1">
            Select keywords to compare their performance
          </p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'trends' as TabType, label: 'Performance Trends', icon: TrendingUp },
    { id: 'funnels' as TabType, label: 'Conversion Funnels', icon: BarChart2 },
    { id: 'market-share' as TabType, label: 'Market Share', icon: PieChartIcon },
  ]

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Keyword Comparison</h3>
        <p className="text-sm text-gray-500">
          {formatDateRange(dateRange.start, dateRange.end)}
        </p>
        
        {/* Keyword pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          {displayKeywords.map((keyword, index) => (
            <span
              key={keyword}
              className="px-3 py-1 text-sm font-medium rounded-full"
              style={{
                backgroundColor: `${COLORS[index % COLORS.length]}20`,
                color: COLORS[index % COLORS.length],
              }}
            >
              {keyword}
            </span>
          ))}
          {remainingCount > 0 && (
            <span className="px-3 py-1 text-sm font-medium text-gray-500">
              and {remainingCount} more...
            </span>
          )}
        </div>

        {/* Summary stats */}
        {totalStats && (
          <div className="flex space-x-6 mt-4 text-sm text-gray-600">
            <span>Total Impressions: <strong>{formatNumber(totalStats.totalImpressions)}</strong></span>
            <span>Total Clicks: <strong>{formatNumber(totalStats.totalClicks)}</strong></span>
            <span>Total Purchases: <strong>{formatNumber(totalStats.totalPurchases)}</strong></span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  group inline-flex items-center py-2 px-1 border-b-2 font-medium text-sm
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className={`
                  -ml-0.5 mr-2 h-5 w-5
                  ${activeTab === tab.id ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}
                `} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'trends' && (
        <div data-testid="performance-trends-content">
          <div data-testid="comparison-performance-chart" className="h-96">
            {data?.timeSeries && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.timeSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(date) => format(new Date(date), 'MMM d')}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(date) => format(new Date(date as string), 'MMM d, yyyy')}
                    formatter={(value: number) => formatNumber(value)}
                  />
                  <Legend />
                  {displayKeywords.map((keyword, index) => (
                    <Line
                      key={keyword}
                      type="monotone"
                      dataKey={(dataPoint) => {
                        const keywordData = dataPoint[keyword] as KeywordPerformanceData | undefined
                        return keywordData?.impressions || 0
                      }}
                      name={keyword}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {activeTab === 'funnels' && (
        <div data-testid="conversion-funnels-content">
          <div className="grid grid-cols-2 gap-4">
            {displayKeywords.slice(0, 4).map((keyword, index) => {
              const funnelData = data?.funnels[keyword]
              if (!funnelData) return null

              return (
                <div key={keyword} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">
                    Conversion Funnel: {keyword}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Impressions</span>
                      <span className="font-medium">{formatNumber(funnelData.impressions)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Clicks</span>
                      <span className="font-medium">{formatNumber(funnelData.clicks)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Cart Adds</span>
                      <span className="font-medium">{formatNumber(funnelData.cartAdds)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Purchases</span>
                      <span className="font-medium">{formatNumber(funnelData.purchases)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'market-share' && (
        <div data-testid="market-share-content">
          <div data-testid="market-share-comparison" className="space-y-4">
            {displayKeywords.map((keyword, index) => {
              const share = data?.marketShare[keyword] || 0
              return (
                <div key={keyword} className="flex items-center space-x-4">
                  <div className="w-40 text-sm font-medium text-gray-900">{keyword}</div>
                  <div className="flex-1">
                    <div className="relative bg-gray-200 rounded-full h-8">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full flex items-center justify-end pr-3"
                        style={{
                          width: `${share * 100}%`,
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      >
                        <span className="text-xs font-medium text-white">
                          {formatPercentage(share)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}