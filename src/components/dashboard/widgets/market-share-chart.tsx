'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useQuery } from '@tanstack/react-query'

interface MarketShareData {
  period: string
  yourShare: number
  topCompetitor: number
  marketAverage: number
}

async function fetchMarketShareTrends(weeks: number): Promise<MarketShareData[]> {
  const params = new URLSearchParams({ weeks: weeks.toString() })
  const response = await fetch(`/api/dashboard/market-share-trends?${params}`)
  
  if (!response.ok) {
    throw new Error('Failed to fetch market share trends')
  }
  
  return response.json()
}

export default function MarketShareChart({ weeks = 12 }: { weeks?: number }) {
  const { data, isLoading } = useQuery<MarketShareData[]>({
    queryKey: ['market-share-trends', weeks],
    queryFn: () => fetchMarketShareTrends(weeks),
    staleTime: 5 * 60 * 1000,
  })

  const formatPercent = (value: number) => `${value.toFixed(1)}%`

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-900 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600 dark:text-gray-400">{entry.name}:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatPercent(entry.value)}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="h-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">Market Share Progression</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your share vs competitors over time</p>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="85%">
          <AreaChart data={data || []}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
            <XAxis 
              dataKey="period" 
              className="text-gray-600 dark:text-gray-400"
              stroke="currentColor"
            />
            <YAxis 
              className="text-gray-600 dark:text-gray-400"
              stroke="currentColor"
              tickFormatter={formatPercent}
              domain={[0, 'dataMax + 5']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area
              type="monotone"
              dataKey="yourShare"
              stackId="1"
              stroke="#2970FF"
              fill="#2970FF"
              fillOpacity={0.8}
              strokeWidth={2}
              name="Your Share"
            />
            <Area
              type="monotone"
              dataKey="topCompetitor"
              stackId="1"
              stroke="#DC2626"
              fill="#DC2626"
              fillOpacity={0.6}
              strokeWidth={2}
              name="Top Competitor"
            />
            <Area
              type="monotone"
              dataKey="marketAverage"
              stackId="1"
              stroke="#6B7280"
              fill="#6B7280"
              fillOpacity={0.4}
              strokeWidth={2}
              name="Others"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}