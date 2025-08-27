'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricsWidgetProps {
  title: string
  metric: string
  change?: string
  trend?: 'up' | 'down'
  description?: string
}

export default function MetricsWidget({
  title,
  metric,
  change,
  trend,
  description,
}: MetricsWidgetProps) {
  return (
    <div className="h-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</h3>
      
      <div className="mt-2 flex items-baseline gap-x-2">
        <p className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
          {metric}
        </p>
        {change && (
          <p
            className={cn(
              'text-sm font-medium flex items-center gap-1',
              trend === 'up' ? 'text-success-600' : 'text-error-600'
            )}
          >
            {trend === 'up' ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {change}
          </p>
        )}
      </div>
      
      {description && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      )}
    </div>
  )
}