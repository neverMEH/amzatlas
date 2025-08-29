'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CalendarDays } from 'lucide-react'

interface PeriodComparisonDashboardProps {
  brandId: string | null
  dateRange?: {
    startDate: string
    endDate: string
  }
}

interface ComparisonData {
  period: string
  current: number
  previous: number
  change: number
  changePercent: number
}

interface MetricCard {
  title: string
  metric: string
  value: number
  change: number
  changePercent: number
  trend: 'up' | 'down' | 'stable'
  comparisonData: ComparisonData[]
}

interface PeriodSummary {
  period: 'week' | 'month' | 'quarter' | 'year'
  label: string
  hasData: boolean
  metrics?: {
    totalKeywords: number
    improvedCount: number
    declinedCount: number
    stableCount: number
    avgImpressionChange: number
    topGainer?: { keyword: string; change: number }
    topLoser?: { keyword: string; change: number }
  }
}

const PERIODS = [
  { value: 'week', label: 'Week over Week', short: 'WoW' },
  { value: 'month', label: 'Month over Month', short: 'MoM' },
  { value: 'quarter', label: 'Quarter over Quarter', short: 'QoQ' },
  { value: 'year', label: 'Year over Year', short: 'YoY' }
]

const METRICS = [
  { value: 'impressions', label: 'Impressions', color: '#3B82F6' },
  { value: 'clicks', label: 'Clicks', color: '#10B981' },
  { value: 'purchases', label: 'Purchases', color: '#F59E0B' },
  { value: 'revenue', label: 'Revenue', color: '#8B5CF6' },
  { value: 'cvr', label: 'Conversion Rate', color: '#EF4444' },
  { value: 'ctr', label: 'Click Through Rate', color: '#6366F1' }
]

export default function PeriodComparisonDashboard({ 
  brandId,
  dateRange 
}: PeriodComparisonDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('week')
  const [selectedMetric, setSelectedMetric] = useState('impressions')
  const [loading, setLoading] = useState(true)
  const [metricCards, setMetricCards] = useState<MetricCard[]>([])
  const [trendData, setTrendData] = useState<any[]>([])
  const [periodSummaries, setPeriodSummaries] = useState<PeriodSummary[]>([])
  const [overallSummary, setOverallSummary] = useState<any>(null)

  useEffect(() => {
    fetchComparisonData()
    fetchPeriodSummaries()
  }, [brandId, selectedPeriod, selectedMetric, dateRange])

  const fetchComparisonData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        comparisonType: selectedPeriod,
        metric: selectedMetric
      })
      
      if (brandId) params.append('brandId', brandId)
      if (dateRange?.startDate) params.append('startDate', dateRange.startDate)
      if (dateRange?.endDate) params.append('endDate', dateRange.endDate)

      // Fetch main comparison data
      const response = await fetch(`/api/period-comparison?${params}`)
      const data = await response.json()
      
      if (data.success && data.data) {
        processComparisonData(data.data)
      }

      // Fetch trend data
      const trendResponse = await fetch(`/api/period-comparison/trends?${params}`)
      const trendResult = await trendResponse.json()
      
      if (trendResult.success) {
        setTrendData(trendResult.data)
      }
    } catch (error) {
      console.error('Error fetching comparison data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPeriodSummaries = async () => {
    try {
      const params = new URLSearchParams()
      if (brandId) params.append('brandId', brandId)
      if (dateRange?.startDate) params.append('startDate', dateRange.startDate)
      if (dateRange?.endDate) params.append('endDate', dateRange.endDate)

      const response = await fetch(`/api/period-comparison/summary?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setPeriodSummaries(data.summaries)
        setOverallSummary(data.overall)
      }
    } catch (error) {
      console.error('Error fetching period summaries:', error)
    }
  }

  const processComparisonData = (data: any[]) => {
    // Process data into metric cards
    const cards: MetricCard[] = METRICS.map(metric => {
      const metricData = data.filter(d => d.metric === metric.value)
      const latestData = metricData[metricData.length - 1] || {}
      
      return {
        title: metric.label,
        metric: metric.value,
        value: latestData.current_value || 0,
        change: latestData.absolute_change || 0,
        changePercent: latestData.percent_change || 0,
        trend: latestData.percent_change > 0 ? 'up' : 
               latestData.percent_change < 0 ? 'down' : 'stable',
        comparisonData: metricData.map(d => ({
          period: d.period_label || d.period,
          current: d.current_value || 0,
          previous: d.previous_value || 0,
          change: d.absolute_change || 0,
          changePercent: d.percent_change || 0
        }))
      }
    })
    
    setMetricCards(cards)
  }

  const formatValue = (value: number, metric: string) => {
    if (metric === 'cvr' || metric === 'ctr') {
      return `${value.toFixed(2)}%`
    }
    if (metric === 'revenue') {
      return `$${(value / 1000).toFixed(1)}K`
    }
    return value.toLocaleString()
  }

  const formatChange = (change: number, metric: string) => {
    const prefix = change > 0 ? '+' : ''
    if (metric === 'cvr' || metric === 'ctr') {
      return `${prefix}${change.toFixed(2)}pp`
    }
    return `${prefix}${change.toLocaleString()}`
  }

  const renderMetricCard = (card: MetricCard) => {
    const metric = METRICS.find(m => m.value === card.metric)
    const Icon = card.trend === 'up' ? TrendingUp : 
                 card.trend === 'down' ? TrendingDown : Minus

    return (
      <div key={card.metric} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-600">{card.title}</h3>
          <div className={`
            flex items-center gap-1 text-sm font-medium
            ${card.trend === 'up' ? 'text-green-600' : 
              card.trend === 'down' ? 'text-red-600' : 'text-gray-600'}
          `}>
            <Icon className="w-4 h-4" />
            <span>{card.changePercent.toFixed(1)}%</span>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-2xl font-bold text-gray-900">
            {formatValue(card.value, card.metric)}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {formatChange(card.change, card.metric)} from previous {selectedPeriod}
          </div>
        </div>

        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={card.comparisonData.slice(-8)}>
              <Line
                type="monotone"
                dataKey="current"
                stroke={metric?.color}
                strokeWidth={2}
                dot={false}
              />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.[0]) return null
                  const data = payload[0].payload
                  return (
                    <div className="bg-white p-2 border rounded shadow-sm">
                      <p className="text-xs font-medium">{data.period}</p>
                      <p className="text-xs">
                        Current: {formatValue(data.current, card.metric)}
                      </p>
                      <p className="text-xs">
                        Change: {data.changePercent.toFixed(1)}%
                      </p>
                    </div>
                  )
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  const renderPeriodSummary = (summary: PeriodSummary) => {
    if (!summary.hasData || !summary.metrics) return null

    const improvementRate = (summary.metrics.improvedCount / summary.metrics.totalKeywords) * 100

    return (
      <div key={summary.period} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">{summary.label}</h4>
          <span className="text-sm text-gray-500">
            {summary.metrics.totalKeywords} keywords
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Improvement Rate</span>
            <span className={`text-sm font-medium ${
              improvementRate > 50 ? 'text-green-600' : 
              improvementRate < 30 ? 'text-red-600' : 'text-yellow-600'
            }`}>
              {improvementRate.toFixed(1)}%
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <div className="font-medium text-green-600">
                {summary.metrics.improvedCount}
              </div>
              <div className="text-gray-500">Improved</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-gray-600">
                {summary.metrics.stableCount}
              </div>
              <div className="text-gray-500">Stable</div>
            </div>
            <div className="text-center">
              <div className="font-medium text-red-600">
                {summary.metrics.declinedCount}
              </div>
              <div className="text-gray-500">Declined</div>
            </div>
          </div>

          {summary.metrics.topGainer && (
            <div className="mt-2 p-2 bg-green-50 rounded text-xs">
              <div className="font-medium text-green-700">Top Gainer</div>
              <div className="text-green-600 truncate">
                {summary.metrics.topGainer.keyword}
              </div>
              <div className="text-green-700 font-medium">
                +{summary.metrics.topGainer.change.toFixed(1)}%
              </div>
            </div>
          )}
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
      {/* Header Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Period-over-Period Comparison
          </h2>
          <CalendarDays className="w-5 h-5 text-gray-400" />
        </div>

        <div className="flex gap-4">
          <div className="flex gap-2">
            {PERIODS.map(period => (
              <button
                key={period.value}
                onClick={() => setSelectedPeriod(period.value)}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${selectedPeriod === period.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                {period.short}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overall Summary */}
      {overallSummary && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Performance Overview
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">Best Performing Period</div>
              <div className="text-xl font-bold text-green-600">
                {overallSummary.bestPerformingPeriod?.toUpperCase()}
              </div>
              <div className="text-sm text-gray-500">
                Avg Change: +{overallSummary.avgChangeByPeriod[overallSummary.bestPerformingPeriod]?.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Most Volatile Period</div>
              <div className="text-xl font-bold text-yellow-600">
                {overallSummary.mostVolatilePeriod?.toUpperCase()}
              </div>
              <div className="text-sm text-gray-500">
                High variability in metrics
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Worst Performing Period</div>
              <div className="text-xl font-bold text-red-600">
                {overallSummary.worstPerformingPeriod?.toUpperCase()}
              </div>
              <div className="text-sm text-gray-500">
                Avg Change: {overallSummary.avgChangeByPeriod[overallSummary.worstPerformingPeriod]?.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metricCards.map(card => renderMetricCard(card))}
      </div>

      {/* Period Summaries */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Keyword Performance by Period
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {periodSummaries.map(summary => renderPeriodSummary(summary))}
        </div>
      </div>

      {/* Trend Chart */}
      {trendData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {METRICS.find(m => m.value === selectedMetric)?.label} Trend
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="period" 
                  angle={-45} 
                  textAnchor="end" 
                  height={80}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={METRICS.find(m => m.value === selectedMetric)?.color}
                  strokeWidth={2}
                  name="Current Period"
                />
                <Line
                  type="monotone"
                  dataKey="change_percent"
                  stroke="#94A3B8"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="% Change"
                  yAxisId="right"
                />
                <YAxis yAxisId="right" orientation="right" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}