'use client'

import React, { useState, useEffect } from 'react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts'
import { TrendingUp, TrendingDown, Activity, AlertTriangle, BarChart3, Eye } from 'lucide-react'

interface KeywordTrendsVisualizationProps {
  brandId: string | null
  dateRange?: {
    startDate: string
    endDate: string
  }
}

interface KeywordTrend {
  keyword: string
  trend_classification: 'emerging' | 'declining' | 'stable' | 'volatile'
  trend_strength: number
  volatility_score: number
  avg_impressions: number
  recent_impressions: number
  growth_rate: number
  consistency_score: number
  weeks_of_data: number
}

interface RollingAverage {
  keyword: string
  week: string
  impressions: number
  rolling_avg: number
  deviation_percent: number
  z_score: number
}

interface TrendDistribution {
  classification: string
  count: number
  percentage: number
  avg_growth_rate: number
  total_impressions: number
}

const TREND_COLORS = {
  emerging: '#10B981',
  declining: '#EF4444',
  stable: '#6B7280',
  volatile: '#F59E0B'
}

const TREND_LABELS = {
  emerging: 'Emerging',
  declining: 'Declining',
  stable: 'Stable',
  volatile: 'Volatile'
}

export default function KeywordTrendsVisualization({
  brandId,
  dateRange
}: KeywordTrendsVisualizationProps) {
  const [loading, setLoading] = useState(true)
  const [topTrending, setTopTrending] = useState<KeywordTrend[]>([])
  const [rollingAverages, setRollingAverages] = useState<RollingAverage[]>([])
  const [distribution, setDistribution] = useState<TrendDistribution[]>([])
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [windowSize, setWindowSize] = useState(6)
  const [selectedTrend, setSelectedTrend] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'overview' | 'detailed'>('overview')

  useEffect(() => {
    fetchTrendData()
  }, [brandId, dateRange, windowSize])

  const fetchTrendData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        window_size: windowSize.toString()
      })
      
      if (brandId) params.append('brandId', brandId)
      if (dateRange?.startDate) params.append('startDate', dateRange.startDate)
      if (dateRange?.endDate) params.append('endDate', dateRange.endDate)

      // Fetch top trending keywords
      const trendingResponse = await fetch(`/api/keyword-trends/top-trending?${params}`)
      const trendingData = await trendingResponse.json()
      
      if (trendingData.success) {
        setTopTrending(trendingData.trends)
      }

      // Fetch distribution
      const distResponse = await fetch(`/api/keyword-trends/distribution?${params}`)
      const distData = await distResponse.json()
      
      if (distData.success) {
        setDistribution(distData.distribution)
      }

      // If keywords are selected, fetch their rolling averages
      if (selectedKeywords.length > 0) {
        const avgParams = new URLSearchParams(params)
        avgParams.append('keywords', selectedKeywords.join(','))
        
        const avgResponse = await fetch(`/api/keyword-trends/rolling-averages?${avgParams}`)
        const avgData = await avgResponse.json()
        
        if (avgData.success) {
          setRollingAverages(avgData.data)
        }
      }
    } catch (error) {
      console.error('Error fetching trend data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleKeywordSelect = (keyword: string) => {
    const newSelection = selectedKeywords.includes(keyword)
      ? selectedKeywords.filter(k => k !== keyword)
      : [...selectedKeywords, keyword].slice(0, 5) // Max 5 keywords
    
    setSelectedKeywords(newSelection)
  }

  const renderTrendCard = (trend: KeywordTrend, index: number) => {
    const Icon = trend.trend_classification === 'emerging' ? TrendingUp :
                 trend.trend_classification === 'declining' ? TrendingDown :
                 trend.trend_classification === 'volatile' ? Activity : BarChart3

    return (
      <div
        key={trend.keyword}
        className={`
          bg-white rounded-lg shadow-sm border p-4 cursor-pointer transition-all
          ${selectedKeywords.includes(trend.keyword) 
            ? 'border-blue-500 shadow-md' 
            : 'border-gray-200 hover:shadow-md'
          }
        `}
        onClick={() => handleKeywordSelect(trend.keyword)}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`
              p-2 rounded-lg
              bg-${trend.trend_classification === 'emerging' ? 'green' : 
                   trend.trend_classification === 'declining' ? 'red' :
                   trend.trend_classification === 'volatile' ? 'yellow' : 'gray'}-50
            `}>
              <Icon className={`w-4 h-4 text-${
                trend.trend_classification === 'emerging' ? 'green' : 
                trend.trend_classification === 'declining' ? 'red' :
                trend.trend_classification === 'volatile' ? 'yellow' : 'gray'
              }-600`} />
            </div>
            <span className={`
              text-xs font-medium px-2 py-1 rounded-full
              ${trend.trend_classification === 'emerging' ? 'bg-green-100 text-green-700' : 
                trend.trend_classification === 'declining' ? 'bg-red-100 text-red-700' :
                trend.trend_classification === 'volatile' ? 'bg-yellow-100 text-yellow-700' : 
                'bg-gray-100 text-gray-700'}
            `}>
              {TREND_LABELS[trend.trend_classification]}
            </span>
          </div>
          <span className="text-sm text-gray-500">#{index + 1}</span>
        </div>

        <h4 className="font-medium text-gray-900 mb-2 truncate" title={trend.keyword}>
          {trend.keyword}
        </h4>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-500">Growth Rate</span>
            <div className={`font-medium ${
              trend.growth_rate > 0 ? 'text-green-600' : 
              trend.growth_rate < 0 ? 'text-red-600' : 'text-gray-600'
            }`}>
              {trend.growth_rate > 0 ? '+' : ''}{trend.growth_rate.toFixed(1)}%
            </div>
          </div>
          <div>
            <span className="text-gray-500">Avg Impressions</span>
            <div className="font-medium text-gray-900">
              {(trend.avg_impressions / 1000).toFixed(1)}K
            </div>
          </div>
          <div>
            <span className="text-gray-500">Trend Strength</span>
            <div className="font-medium text-gray-900">
              {(trend.trend_strength * 100).toFixed(0)}%
            </div>
          </div>
          <div>
            <span className="text-gray-500">Volatility</span>
            <div className={`font-medium ${
              trend.volatility_score > 0.3 ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {trend.volatility_score > 0.3 ? 'High' : 'Low'}
            </div>
          </div>
        </div>

        {selectedKeywords.includes(trend.keyword) && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <span className="text-xs text-blue-600 font-medium">
              Selected for detailed analysis
            </span>
          </div>
        )}
      </div>
    )
  }

  const renderDistributionChart = () => {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Trend Distribution
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="classification" />
              <YAxis />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.[0]) return null
                  const data = payload[0].payload
                  return (
                    <div className="bg-white p-3 border rounded shadow-sm">
                      <p className="font-medium text-gray-900">
                        {data.classification}
                      </p>
                      <p className="text-sm text-gray-600">
                        Keywords: {data.count} ({data.percentage.toFixed(1)}%)
                      </p>
                      <p className="text-sm text-gray-600">
                        Avg Growth: {data.avg_growth_rate.toFixed(1)}%
                      </p>
                      <p className="text-sm text-gray-600">
                        Impressions: {(data.total_impressions / 1000).toFixed(0)}K
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="count" name="Keyword Count">
                {distribution.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={TREND_COLORS[entry.classification as keyof typeof TREND_COLORS] || '#6B7280'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          {distribution.map(dist => (
            <div
              key={dist.classification}
              className={`
                p-3 rounded-lg cursor-pointer transition-colors
                ${selectedTrend === dist.classification 
                  ? 'bg-gray-100' 
                  : 'hover:bg-gray-50'
                }
              `}
              onClick={() => setSelectedTrend(
                selectedTrend === dist.classification ? null : dist.classification
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">
                  {dist.classification}
                </span>
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ 
                    backgroundColor: TREND_COLORS[dist.classification as keyof typeof TREND_COLORS] || '#6B7280'
                  }}
                />
              </div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {dist.count}
              </div>
              <div className="text-xs text-gray-500">
                {dist.percentage.toFixed(1)}% of keywords
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderRollingAverageChart = () => {
    if (selectedKeywords.length === 0) {
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            6-Week Rolling Average Analysis
          </h3>
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Eye className="w-12 h-12 mb-2" />
            <p>Select keywords above to view their rolling average trends</p>
          </div>
        </div>
      )
    }

    // Group data by keyword
    const keywordData = selectedKeywords.map(keyword => ({
      keyword,
      data: rollingAverages.filter(ra => ra.keyword === keyword)
    }))

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          6-Week Rolling Average Analysis
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="week" 
                type="category"
                allowDuplicatedCategory={false}
                domain={['dataMin', 'dataMax']}
              />
              <YAxis />
              <Tooltip
                content={({ payload, label }) => {
                  if (!payload?.length) return null
                  return (
                    <div className="bg-white p-3 border rounded shadow-sm">
                      <p className="font-medium text-gray-900 mb-2">{label}</p>
                      {payload.map((entry: any, index: number) => (
                        <div key={index} className="text-sm">
                          <p style={{ color: entry.color }}>
                            {entry.name}: {(entry.value / 1000).toFixed(1)}K
                          </p>
                        </div>
                      ))}
                    </div>
                  )
                }}
              />
              <Legend />
              
              {keywordData.map((kw, index) => {
                const color = [
                  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'
                ][index % 5]
                
                return (
                  <React.Fragment key={kw.keyword}>
                    <Line
                      data={kw.data}
                      type="monotone"
                      dataKey="impressions"
                      stroke={color}
                      strokeWidth={1}
                      dot={false}
                      name={`${kw.keyword} (Actual)`}
                      strokeDasharray="3 3"
                      opacity={0.6}
                    />
                    <Line
                      data={kw.data}
                      type="monotone"
                      dataKey="rolling_avg"
                      stroke={color}
                      strokeWidth={2}
                      dot={false}
                      name={`${kw.keyword} (6W Avg)`}
                    />
                  </React.Fragment>
                )
              })}
              
              <ReferenceLine y={0} stroke="#000" strokeDasharray="3 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Z-Score Anomalies */}
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">
            Statistical Anomalies (|Z-Score| &gt; 2)
          </h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {rollingAverages
              .filter(ra => Math.abs(ra.z_score) > 2 && selectedKeywords.includes(ra.keyword))
              .sort((a, b) => Math.abs(b.z_score) - Math.abs(a.z_score))
              .map(anomaly => (
                <div key={`${anomaly.keyword}-${anomaly.week}`} className="flex items-center justify-between text-xs p-2 bg-yellow-50 rounded">
                  <span className="font-medium text-gray-900 truncate flex-1">
                    {anomaly.keyword}
                  </span>
                  <span className="text-gray-600 mx-2">{anomaly.week}</span>
                  <span className={`font-medium ${
                    anomaly.z_score > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    Z: {anomaly.z_score.toFixed(2)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Keyword Trend Analysis
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Window Size:</span>
              <select
                value={windowSize}
                onChange={(e) => setWindowSize(Number(e.target.value))}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={4}>4 weeks</option>
                <option value={6}>6 weeks</option>
                <option value={8}>8 weeks</option>
                <option value={12}>12 weeks</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('overview')}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${viewMode === 'overview'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                Overview
              </button>
              <button
                onClick={() => setViewMode('detailed')}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${viewMode === 'detailed'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                Detailed
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 text-center">
          {Object.entries(TREND_LABELS).map(([key, label]) => {
            const count = distribution.find(d => d.classification === label)?.count || 0
            return (
              <div key={key} className="flex items-center justify-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: TREND_COLORS[key as keyof typeof TREND_COLORS] }}
                />
                <span className="text-sm text-gray-600">{label}</span>
                <span className="text-sm font-medium text-gray-900">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {viewMode === 'overview' ? (
        <>
          {/* Distribution Chart */}
          {renderDistributionChart()}

          {/* Top Trending Keywords */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Top Trending Keywords
              {selectedTrend && (
                <span className="ml-2 text-sm font-normal text-gray-600">
                  (Filtered: {selectedTrend})
                </span>
              )}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {topTrending
                .filter(trend => !selectedTrend || trend.trend_classification === selectedTrend.toLowerCase())
                .slice(0, 12)
                .map((trend, index) => renderTrendCard(trend, index))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Rolling Average Chart */}
          {renderRollingAverageChart()}

          {/* Keyword Selection */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Select Keywords for Analysis
              <span className="ml-2 text-sm font-normal text-gray-600">
                ({selectedKeywords.length}/5 selected)
              </span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {topTrending
                .slice(0, 20)
                .map((trend, index) => renderTrendCard(trend, index))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}