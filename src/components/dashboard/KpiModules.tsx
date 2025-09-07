import React from 'react'

interface KpiData {
  kpis: {
    impressions: {
      value: number
      trend: number[]
      comparison?: number | null
    }
    clicks: {
      value: number
      trend: number[]
      comparison?: number | null
    }
    cartAdds: {
      value: number
      trend: number[]
      comparison?: number | null
    }
    purchases: {
      value: number
      trend: number[]
      comparison?: number | null
    }
  }
}

interface KpiCardProps {
  title: string
  value: number
  data: number[]
  comparison?: number | null
  positive?: boolean
  formatter?: (val: number) => string
}

// Function to generate sparkline path from data
const generateSparklinePath = (data: number[], width: number, height: number): string => {
  if (!data || data.length === 0) return ''
  
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1 // Avoid division by zero
  const xStep = width / (data.length - 1)
  
  return data
    .map((value, index) => {
      const x = index * xStep
      const y = height - ((value - min) / range) * height
      return `${index === 0 ? 'M' : 'L'} ${x},${y}`
    })
    .join(' ')
}

// KPI Card Component
export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  data,
  comparison,
  positive = true,
  formatter = (val) => val.toLocaleString(),
}) => {
  const sparklineWidth = 100
  const sparklineHeight = 30
  const path = generateSparklinePath(data, sparklineWidth, sparklineHeight)

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        {comparison !== null && comparison !== undefined && (
          <div
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              comparison > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
            }`}
          >
            {comparison > 0 ? '+' : ''}
            {comparison}%
          </div>
        )}
      </div>
      <div className="flex items-end justify-between">
        <div className="text-2xl font-semibold">{formatter(value)}</div>
        <div className="h-8">
          <svg
            width={sparklineWidth}
            height={sparklineHeight}
            className="overflow-visible"
            role="img"
            aria-hidden="true"
          >
            <path
              d={path}
              fill="none"
              stroke={positive ? '#3b82f6' : '#ef4444'}
              strokeWidth="1.5"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}

interface KpiModulesProps {
  data?: KpiData | null
  showComparison?: boolean
  loading?: boolean
  error?: string
}

export const KpiModules: React.FC<KpiModulesProps> = ({
  data,
  showComparison = false,
  loading = false,
  error,
}) => {
  // Loading state
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            data-testid="kpi-skeleton"
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
        {error}
      </div>
    )
  }

  // Default data structure if no data provided
  const defaultKpis = {
    impressions: { value: 0, trend: [], comparison: 0 },
    clicks: { value: 0, trend: [], comparison: 0 },
    cartAdds: { value: 0, trend: [], comparison: 0 },
    purchases: { value: 0, trend: [], comparison: 0 },
  }

  const kpisData = data?.kpis || defaultKpis

  // Define metrics with their properties
  const metrics = [
    {
      title: 'Impressions',
      value: kpisData.impressions.value,
      data: kpisData.impressions.trend,
      comparison: kpisData.impressions.comparison,
      positive: !kpisData.impressions.comparison || kpisData.impressions.comparison >= 0,
    },
    {
      title: 'Clicks',
      value: kpisData.clicks.value,
      data: kpisData.clicks.trend,
      comparison: kpisData.clicks.comparison,
      positive: !kpisData.clicks.comparison || kpisData.clicks.comparison >= 0,
    },
    {
      title: 'Cart Adds',
      value: kpisData.cartAdds.value,
      data: kpisData.cartAdds.trend,
      comparison: kpisData.cartAdds.comparison,
      positive: !kpisData.cartAdds.comparison || kpisData.cartAdds.comparison >= 0,
    },
    {
      title: 'Purchases',
      value: kpisData.purchases.value,
      data: kpisData.purchases.trend,
      comparison: kpisData.purchases.comparison,
      positive: !kpisData.purchases.comparison || kpisData.purchases.comparison >= 0,
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {metrics.map((metric, index) => (
        <KpiCard
          key={index}
          title={metric.title}
          value={metric.value}
          data={metric.data}
          comparison={showComparison ? metric.comparison : null}
          positive={metric.positive}
        />
      ))}
    </div>
  )
}