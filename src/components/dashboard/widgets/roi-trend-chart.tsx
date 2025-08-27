'use client'

import { useState } from 'react'
import {
  LineChart,
  Line,
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
import { cn } from '@/lib/utils'

interface ROITrendData {
  period: string
  roi: number
  spend: number
  revenue: number
}

async function fetchROITrends(weeks: number): Promise<ROITrendData[]> {
  const params = new URLSearchParams({ weeks: weeks.toString() })
  const response = await fetch(`/api/dashboard/roi-trends?${params}`)
  
  if (!response.ok) {
    throw new Error('Failed to fetch ROI trends')
  }
  
  return response.json()
}

export default function ROITrendChart({ weeks = 12 }: { weeks?: number }) {
  const [chartType, setChartType] = useState<'line' | 'area'>('area')
  const { data, isLoading } = useQuery<ROITrendData[]>({
    queryKey: ['roi-trends', weeks],
    queryFn: () => fetchROITrends(weeks),
    staleTime: 5 * 60 * 1000,
  })

  const formatCurrency = (value: number) => `$${value.toLocaleString()}`
  const formatPercent = (value: number) => `${value.toFixed(0)}%`

  return (
    <div className="h-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">ROI Trend Analysis</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Return on ad spend over time</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChartType('area')}
            className={cn(
              'px-3 py-1 text-sm rounded-lg',
              chartType === 'area'
                ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            Area
          </button>
          <button
            onClick={() => setChartType('line')}
            className={cn(
              'px-3 py-1 text-sm rounded-lg',
              chartType === 'line'
                ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            Line
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="85%">
          {chartType === 'area' ? (
            <AreaChart data={data || []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
              <XAxis 
                dataKey="period" 
                className="text-gray-600 dark:text-gray-400"
                stroke="currentColor"
              />
              <YAxis 
                yAxisId="left"
                className="text-gray-600 dark:text-gray-400"
                stroke="currentColor"
                tickFormatter={formatPercent}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                className="text-gray-600 dark:text-gray-400"
                stroke="currentColor"
                tickFormatter={formatCurrency}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgb(255, 255, 255)', 
                  border: '1px solid rgb(229, 231, 235)',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'rgb(107, 114, 128)' }}
                formatter={(value: any, name: string) => {
                  if (name === 'ROI') return formatPercent(value)
                  return formatCurrency(value)
                }}
              />
              <Legend />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="roi"
                stroke="#2970FF"
                fill="#84ADFF"
                fillOpacity={0.6}
                strokeWidth={2}
                name="ROI"
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                stroke="#16A34A"
                fill="#86EFAC"
                fillOpacity={0.4}
                strokeWidth={2}
                name="Revenue"
              />
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="spend"
                stroke="#DC2626"
                fill="#FCA5A5"
                fillOpacity={0.4}
                strokeWidth={2}
                name="Ad Spend"
              />
            </AreaChart>
          ) : (
            <LineChart data={data || []}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
              <XAxis 
                dataKey="period" 
                className="text-gray-600 dark:text-gray-400"
                stroke="currentColor"
              />
              <YAxis 
                yAxisId="left"
                className="text-gray-600 dark:text-gray-400"
                stroke="currentColor"
                tickFormatter={formatPercent}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                className="text-gray-600 dark:text-gray-400"
                stroke="currentColor"
                tickFormatter={formatCurrency}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgb(255, 255, 255)', 
                  border: '1px solid rgb(229, 231, 235)',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'rgb(107, 114, 128)' }}
                formatter={(value: any, name: string) => {
                  if (name === 'ROI') return formatPercent(value)
                  return formatCurrency(value)
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="roi"
                stroke="#2970FF"
                strokeWidth={3}
                name="ROI"
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                stroke="#16A34A"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Revenue"
                dot={{ r: 3 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="spend"
                stroke="#DC2626"
                strokeWidth={2}
                strokeDasharray="3 3"
                name="Ad Spend"
                dot={{ r: 3 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  )
}