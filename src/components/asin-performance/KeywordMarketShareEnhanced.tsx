'use client'

import React, { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { TrendingUp, TrendingDown, AlertCircle, PieChartIcon, ExternalLink } from 'lucide-react'

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

interface KeywordMarketShareProps {
  data: MarketShareData | null
  comparisonData?: MarketShareData | null
  keyword: string
  asin: string
  isLoading: boolean
  error: Error | null
}

type ShareMetric = 'impressionShare' | 'clickShare' | 'purchaseShare'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#a855f7']

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

function formatPercentage(num: number, decimals: number = 1): string {
  return `${(num * 100).toFixed(decimals)}%`
}

function getShareChange(current: number, previous: number): number {
  return (current - previous) * 100 // Convert to percentage points
}

// Utility function to generate dashboard URL
function getDashboardUrl(asin: string, params?: URLSearchParams): string {
  const baseUrl = '/'
  const urlParams = new URLSearchParams()
  
  // Add ASIN
  urlParams.set('asin', asin)
  
  // Add source for tracking
  urlParams.set('source', 'keyword-analysis')
  
  // Add date range if available from current URL
  if (params) {
    const startDate = params.get('startDate')
    const endDate = params.get('endDate')
    if (startDate) urlParams.set('startDate', startDate)
    if (endDate) urlParams.set('endDate', endDate)
  } else if (typeof window !== 'undefined') {
    // Try to get from current URL
    const currentParams = new URLSearchParams(window.location.search)
    const startDate = currentParams.get('startDate')
    const endDate = currentParams.get('endDate')
    if (startDate) urlParams.set('startDate', startDate)
    if (endDate) urlParams.set('endDate', endDate)
  }
  
  return `${baseUrl}?${urlParams.toString()}`
}

export function KeywordMarketShare({
  data,
  comparisonData,
  keyword,
  asin,
  isLoading,
  error,
}: KeywordMarketShareProps) {
  const [selectedMetric, setSelectedMetric] = useState<ShareMetric>('impressionShare')

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

  // Sort by conversion rate (primary) and then by selected metric (secondary)
  const sortedCompetitors = useMemo(() => {
    return [...enhancedCompetitors].sort((a, b) => {
      // Primary sort by conversion rate
      const cvrDiff = b.conversionRate - a.conversionRate
      if (Math.abs(cvrDiff) > 0.001) return cvrDiff
      
      // Secondary sort by selected metric
      return b[selectedMetric] - a[selectedMetric]
    })
  }, [enhancedCompetitors, selectedMetric])

  // Get top 5 converters, but ensure current ASIN is included if not in top 5
  const topCompetitors = useMemo(() => {
    const top5 = sortedCompetitors.slice(0, 5)
    const currentAsinInTop5 = top5.some(c => c.asin === asin)
    
    if (!currentAsinInTop5) {
      const currentCompetitor = sortedCompetitors.find(c => c.asin === asin)
      if (currentCompetitor) {
        // Replace the 5th item with current ASIN if it exists
        return [...top5.slice(0, 4), currentCompetitor]
      }
    }
    
    return top5
  }, [sortedCompetitors, asin])

  const pieData = useMemo(() => {
    return topCompetitors.map((competitor, index) => ({
      name: competitor.brand,
      value: competitor[selectedMetric] * 100,
      isCurrentAsin: competitor.asin === asin,
    }))
  }, [topCompetitors, selectedMetric, asin])

  const getComparisonShare = (competitorAsin: string): number | null => {
    if (!comparisonData) return null
    const competitor = comparisonData.competitors.find(c => c.asin === competitorAsin)
    return competitor ? competitor[selectedMetric] : null
  }

  const getCurrentPosition = () => {
    return sortedCompetitors.findIndex(c => c.asin === asin) + 1
  }

  const handleAsinClick = (clickedAsin: string) => {
    if (clickedAsin === asin) return // Don't navigate to current ASIN
    
    const dashboardUrl = getDashboardUrl(clickedAsin)
    window.open(dashboardUrl, '_blank', 'noopener,noreferrer')
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse" data-testid="market-share-skeleton">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-200 rounded"></div>
              ))}
            </div>
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
          <PieChartIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-900 font-medium">No market share data available</p>
          <p className="text-gray-500 text-sm mt-1">
            Select a keyword to view market share analysis
          </p>
        </div>
      </div>
    )
  }

  const metricLabels = {
    impressionShare: 'Impression Share',
    clickShare: 'Click Share',
    purchaseShare: 'Purchase Share',
  }

  const totalMarketMetric = selectedMetric === 'impressionShare' ? 'impressions' : 
                           selectedMetric === 'clickShare' ? 'clicks' : 'purchases'
  const totalMarketValue = data.totalMarket[totalMarketMetric]

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Market Share: {keyword}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Total Market: {formatNumber(totalMarketValue)} {totalMarketMetric}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Top 5 ASINs by Conversion Rate
        </p>
      </div>

      {/* Metric selector */}
      <div className="flex space-x-2 mb-4">
        {Object.entries(metricLabels).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSelectedMetric(key as ShareMetric)}
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

      <div className="grid grid-cols-2 gap-6">
        {/* Pie chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ value }) => value !== undefined ? `${value.toFixed(1)}%` : ''}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.isCurrentAsin ? '#3b82f6' : COLORS[index % COLORS.length]} 
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Enhanced Table */}
        <div className="overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Brand
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CVR
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CTR
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Purchases
                </th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {topCompetitors.map((competitor, index) => {
                const isCurrentAsin = competitor.asin === asin
                const previousShare = getComparisonShare(competitor.asin)
                const shareChange = previousShare !== null ? getShareChange(competitor[selectedMetric], previousShare) : null
                const isPositive = shareChange !== null && shareChange > 0

                return (
                  <tr 
                    key={competitor.asin}
                    className={`${
                      isCurrentAsin 
                        ? 'bg-blue-50' 
                        : 'hover:bg-gray-50 cursor-pointer'
                    } transition-colors`}
                    onClick={() => !isCurrentAsin && handleAsinClick(competitor.asin)}
                    title={competitor.title}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          {isCurrentAsin && (
                            <span className="text-xs text-gray-500 mr-2">#{getCurrentPosition()}</span>
                          )}
                          <span className="font-medium text-gray-900">
                            {competitor.brand}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-right">
                      <span className="font-medium text-gray-900">
                        {formatPercentage(competitor.conversionRate, 2)}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-600">
                      {formatPercentage(competitor.clickThroughRate, 2)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-600">
                      {formatNumber(competitor.totalPurchases)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!isCurrentAsin && (
                        <ExternalLink className="h-3 w-3 text-gray-400" />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Export the utility function for use in other components
export { getDashboardUrl }