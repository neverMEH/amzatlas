'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useQuery } from '@tanstack/react-query'

interface HourlyData {
  hour: string
  purchases: number
  clicks: number
  cvr: number
}

async function fetchHourlyPerformance(date: string): Promise<HourlyData[]> {
  const params = new URLSearchParams({ date })
  const response = await fetch(`/api/dashboard/hourly-performance?${params}`)
  
  if (!response.ok) {
    throw new Error('Failed to fetch hourly performance')
  }
  
  return response.json()
}

export default function HourlyPerformanceChart({ date = new Date().toISOString().split('T')[0] }: { date?: string }) {
  const { data, isLoading } = useQuery<HourlyData[]>({
    queryKey: ['hourly-performance', date],
    queryFn: () => fetchHourlyPerformance(date),
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
                {entry.name === 'CVR' ? formatPercent(entry.value) : entry.value.toLocaleString()}
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
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">Hourly Performance Pattern</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Purchase activity throughout the day</p>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={data || []}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
            <XAxis 
              dataKey="hour" 
              className="text-gray-600 dark:text-gray-400"
              stroke="currentColor"
            />
            <YAxis 
              yAxisId="left"
              className="text-gray-600 dark:text-gray-400"
              stroke="currentColor"
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              className="text-gray-600 dark:text-gray-400"
              stroke="currentColor"
              tickFormatter={formatPercent}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="purchases"
              stroke="#2970FF"
              strokeWidth={2}
              name="Purchases"
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="clicks"
              stroke="#84ADFF"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Clicks"
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cvr"
              stroke="#16A34A"
              strokeWidth={2}
              name="CVR"
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}