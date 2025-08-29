'use client'

import React, { useState } from 'react'
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
import { TrendingUp } from 'lucide-react'

interface TimeSeriesData {
  date: string
  impressions: number
  clicks: number
  cartAdds: number
  purchases: number
}

interface PerformanceChartProps {
  data: TimeSeriesData[]
  comparisonData?: TimeSeriesData[]
  isLoading: boolean
  error: Error | null
}

type MetricType = 'impressions' | 'clicks' | 'cartAdds' | 'purchases' | 'all'

const metricConfig = {
  impressions: { label: 'Impressions', color: '#3B82F6', yAxisId: 'left' },
  clicks: { label: 'Clicks', color: '#10B981', yAxisId: 'right' },
  cartAdds: { label: 'Cart Adds', color: '#F59E0B', yAxisId: 'right' },
  purchases: { label: 'Purchases', color: '#EF4444', yAxisId: 'right' },
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

function formatDate(dateString: string): string {
  return format(new Date(dateString), 'MMM d, yyyy')
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-900 mb-2">{formatDate(label || '')}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between space-x-4 text-sm">
            <span className="flex items-center space-x-1">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600">{entry.name}:</span>
            </span>
            <span className="font-medium text-gray-900">
              {formatNumber(entry.value as number)}
            </span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function PerformanceChart({ data, comparisonData, isLoading, error }: PerformanceChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('impressions')
  const [showComparison, setShowComparison] = useState(!!comparisonData)

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse" data-testid="chart-skeleton">
        <div className="h-6 w-48 bg-gray-200 rounded mb-4"></div>
        <div className="flex space-x-2 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-20 bg-gray-200 rounded"></div>
          ))}
        </div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
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
            Select an ASIN and date range to view performance data
          </p>
        </div>
      </div>
    )
  }

  // Combine current and comparison data if showing comparison
  const chartData = data.map((item, index) => {
    const compItem = showComparison && comparisonData?.[index]
    return {
      date: item.date,
      impressions: item.impressions,
      clicks: item.clicks,
      cartAdds: item.cartAdds,
      purchases: item.purchases,
      ...(compItem && {
        impressionsComp: compItem.impressions,
        clicksComp: compItem.clicks,
        cartAddsComp: compItem.cartAdds,
        purchasesComp: compItem.purchases,
      }),
    }
  })

  const renderMetricButton = (metric: MetricType, label: string) => (
    <button
      key={metric}
      onClick={() => setSelectedMetric(metric)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        selectedMetric === metric
          ? 'bg-blue-100 text-blue-700'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  )

  const renderLines = () => {
    if (selectedMetric === 'all') {
      return (
        <>
          {Object.entries(metricConfig).map(([key, config]) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={config.label}
              stroke={config.color}
              strokeWidth={2}
              dot={false}
              yAxisId={config.yAxisId}
            />
          ))}
          {showComparison && comparisonData && (
            <>
              {Object.entries(metricConfig).map(([key, config]) => (
                <Line
                  key={`${key}Comp`}
                  type="monotone"
                  dataKey={`${key}Comp`}
                  name={`${config.label} (Previous)`}
                  stroke={config.color}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  yAxisId={config.yAxisId}
                  opacity={0.5}
                />
              ))}
            </>
          )}
        </>
      )
    }

    const config = metricConfig[selectedMetric as keyof typeof metricConfig]
    return (
      <>
        <Line
          type="monotone"
          dataKey={selectedMetric}
          name={config.label}
          stroke={config.color}
          strokeWidth={2}
          dot={false}
        />
        {showComparison && comparisonData && (
          <Line
            type="monotone"
            dataKey={`${selectedMetric}Comp`}
            name={`${config.label} (Previous)`}
            stroke={config.color}
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            opacity={0.5}
          />
        )}
      </>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Performance Trends</h3>
          <p className="text-sm text-gray-500">Weekly aggregated data</p>
        </div>
        {comparisonData && (
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={showComparison}
              onChange={(e) => setShowComparison(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              aria-label="Show comparison"
            />
            <span className="text-gray-600">Show comparison period</span>
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {renderMetricButton('impressions', 'Impressions')}
        {renderMetricButton('clicks', 'Clicks')}
        {renderMetricButton('cartAdds', 'Cart Adds')}
        {renderMetricButton('purchases', 'Purchases')}
        <div className="w-px bg-gray-300 mx-1" />
        {renderMetricButton('all', 'View All')}
      </div>

      <div data-testid="performance-chart" className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatDate}
              stroke="#6B7280"
              fontSize={12}
            />
            {selectedMetric === 'all' ? (
              <>
                <YAxis 
                  yAxisId="left"
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={(value) => formatNumber(value)}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={(value) => formatNumber(value)}
                />
              </>
            ) : (
              <YAxis 
                stroke="#6B7280"
                fontSize={12}
                tickFormatter={(value) => formatNumber(value)}
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '1rem' }}
              iconType="line"
            />
            {renderLines()}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}