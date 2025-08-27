'use client'

import { useState } from 'react'
import { FileText, TrendingUp, DollarSign, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import PerformanceReports from './performance-reports'
import GrowthReports from './growth-reports'
import ROIReports from './roi-reports'
import StrategicReports from './strategic-reports'

export type ReportCategory = 'performance' | 'growth' | 'roi' | 'strategic'

const reportCategories = [
  {
    id: 'performance' as const,
    name: 'Core Performance',
    description: 'Real-time purchase metrics and keyword performance',
    icon: FileText,
  },
  {
    id: 'growth' as const,
    name: 'Growth & Trends',
    description: 'Market share progression and velocity tracking',
    icon: TrendingUp,
  },
  {
    id: 'roi' as const,
    name: 'ROI & Investment',
    description: 'Purchase-based ROI and attribution analysis',
    icon: DollarSign,
  },
  {
    id: 'strategic' as const,
    name: 'Strategic Action',
    description: 'Optimization opportunities and market gaps',
    icon: Target,
  },
]

export default function ReportViewer() {
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('performance')

  const renderReport = () => {
    switch (selectedCategory) {
      case 'performance':
        return <PerformanceReports />
      case 'growth':
        return <GrowthReports />
      case 'roi':
        return <ROIReports />
      case 'strategic':
        return <StrategicReports />
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Category Selector */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <h2 className="text-display-xs font-semibold text-gray-900 dark:text-gray-50 mb-6">
          SQP Purchase Reports
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {reportCategories.map((category) => {
            const Icon = category.icon
            const isSelected = selectedCategory === category.id
            
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={cn(
                  'p-4 rounded-lg border transition-all duration-200 text-left',
                  isSelected
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-500'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'p-2 rounded-lg',
                    isSelected
                      ? 'bg-primary-100 dark:bg-primary-800/30 text-primary-700 dark:text-primary-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className={cn(
                      'font-semibold mb-1',
                      isSelected
                        ? 'text-primary-700 dark:text-primary-400'
                        : 'text-gray-900 dark:text-gray-100'
                    )}>
                      {category.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {category.description}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Report Content */}
      <div className="flex-1">
        {renderReport()}
      </div>
    </div>
  )
}