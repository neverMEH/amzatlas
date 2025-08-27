'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { useRisingKeywords } from '@/hooks/use-sqp-data'

const COLORS = {
  high: '#16A34A', // green
  medium: '#2970FF', // blue
  low: '#F59E0B', // amber
}

export default function KeywordVelocityChart({ limit = 10 }: { limit?: number }) {
  const { data: risingKeywords, isLoading } = useRisingKeywords(limit)

  // Transform data for the chart
  const chartData = risingKeywords?.map(kw => ({
    keyword: kw.keyword.length > 20 ? kw.keyword.substring(0, 20) + '...' : kw.keyword,
    fullKeyword: kw.keyword,
    velocity: ((kw.purchases / (kw.marketPurchases || 1)) * 1000) || 0, // velocity score
    purchases: kw.purchases,
    roi: kw.roi,
    color: kw.roi > 300 ? COLORS.high : kw.roi > 200 ? COLORS.medium : COLORS.low,
  })).sort((a, b) => b.velocity - a.velocity)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white dark:bg-gray-900 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-800">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{data.fullKeyword}</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-600 dark:text-gray-400">Velocity Score:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{data.velocity.toFixed(1)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600 dark:text-gray-400">Purchases:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{data.purchases}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-600 dark:text-gray-400">ROI:</span>
              <span className="font-medium text-success-600 dark:text-success-400">{data.roi.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="h-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">Keyword Velocity Analysis</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Fastest growing keywords by velocity score</p>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="85%">
          <BarChart 
            data={chartData || []} 
            layout="horizontal"
            margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
            <XAxis 
              type="number"
              className="text-gray-600 dark:text-gray-400"
              stroke="currentColor"
            />
            <YAxis 
              dataKey="keyword" 
              type="category"
              className="text-gray-600 dark:text-gray-400"
              stroke="currentColor"
              width={90}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="velocity" radius={[0, 4, 4, 0]}>
              {chartData?.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}