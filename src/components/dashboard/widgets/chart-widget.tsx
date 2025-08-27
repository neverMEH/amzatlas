'use client'

import { useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { usePurchaseTrends } from '@/hooks/use-sqp-data'

interface ChartWidgetProps {
  title: string
  description?: string
  type?: 'line' | 'bar'
}

export default function ChartWidget({
  title,
  description,
  type = 'line',
}: ChartWidgetProps) {
  const [chartType, setChartType] = useState(type)
  const { data, isLoading } = usePurchaseTrends()

  return (
    <div className="h-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">{title}</h3>
          {description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
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
          <button
            onClick={() => setChartType('bar')}
            className={cn(
              'px-3 py-1 text-sm rounded-lg',
              chartType === 'bar'
                ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            Bar
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="85%">
          {chartType === 'line' ? (
            <LineChart data={data || []}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
            <XAxis 
              dataKey="week" 
              className="text-gray-600 dark:text-gray-400"
              stroke="currentColor"
            />
            <YAxis 
              className="text-gray-600 dark:text-gray-400"
              stroke="currentColor"
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgb(255, 255, 255)', 
                border: '1px solid rgb(229, 231, 235)',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'rgb(107, 114, 128)' }}
            />
            <Line
              type="monotone"
              dataKey="purchases"
              stroke="#2970FF"
              strokeWidth={2}
              name="Your Purchases"
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="market"
              stroke="#84ADFF"
              strokeWidth={2}
              name="Market Total"
              strokeDasharray="5 5"
              dot={{ r: 3 }}
            />
          </LineChart>
        ) : (
            <BarChart data={data || []}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-800" />
            <XAxis 
              dataKey="week" 
              className="text-gray-600 dark:text-gray-400"
              stroke="currentColor"
            />
            <YAxis 
              className="text-gray-600 dark:text-gray-400"
              stroke="currentColor"
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgb(255, 255, 255)', 
                border: '1px solid rgb(229, 231, 235)',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'rgb(107, 114, 128)' }}
            />
            <Bar dataKey="purchases" fill="#2970FF" name="Your Purchases" radius={[4, 4, 0, 0]} />
            <Bar dataKey="market" fill="#84ADFF" name="Market Total" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
      )}
    </div>
  )
}

// Import cn at the top of the file
import { cn } from '@/lib/utils'