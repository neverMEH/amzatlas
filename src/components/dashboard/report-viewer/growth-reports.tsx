'use client'

import { useState } from 'react'
import { TrendingUp, BarChart3, Activity, Zap } from 'lucide-react'
import MetricsWidget from '@/components/dashboard/widgets/metrics-widget'
import ChartWidget from '@/components/dashboard/widgets/chart-widget'
import TableWidget from '@/components/dashboard/widgets/table-widget'
import { usePurchaseMetrics, useRisingKeywords } from '@/hooks/use-sqp-data'

const growthReports = [
  {
    id: 'market-share-progression',
    name: 'Market Share Progression',
    description: 'Track your share of voice in purchase data',
    icon: BarChart3,
  },
  {
    id: 'category-growth-analysis',
    name: 'Category Growth Analysis',
    description: 'Growth trends across product categories',
    icon: TrendingUp,
  },
  {
    id: 'keyword-velocity-tracking',
    name: 'Keyword Velocity Tracking',
    description: 'Fast-moving keywords and emerging trends',
    icon: Zap,
  },
  {
    id: 'competitive-growth-index',
    name: 'Competitive Growth Index',
    description: 'Growth rate vs market benchmarks',
    icon: Activity,
  },
]

export default function GrowthReports() {
  const [selectedReport, setSelectedReport] = useState('market-share-progression')
  const { data: metrics, isLoading } = usePurchaseMetrics()
  const { data: risingKeywords, isLoading: isLoadingRising } = useRisingKeywords(10)

  const renderReportContent = () => {
    switch (selectedReport) {
      case 'market-share-progression':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricsWidget
                title="Current Share"
                metric={metrics ? `${metrics.marketShare.toFixed(1)}%` : '—'}
                change={metrics ? `${metrics.marketShareChange > 0 ? '+' : ''}${metrics.marketShareChange.toFixed(1)}pp` : '—'}
                trend={metrics && metrics.marketShareChange > 0 ? 'up' : 'down'}
                description="of category purchases"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Share Growth Rate"
                metric="8.3%"
                change="+2.1pp"
                trend="up"
                description="Monthly growth"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Share Rank"
                metric="#4"
                change="↑1"
                trend="up"
                description="In category"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Gap to Leader"
                metric="12.4pp"
                change="-2.3pp"
                trend="up"
                description="Closing gap"
                isLoading={isLoading}
              />
            </div>
            
            <ChartWidget
              title="Market Share Trend (12 Weeks)"
              description="Your purchase share vs market average"
              type="line"
            />
            
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50 mb-4">
                Share by Keyword Segment
              </h3>
              <div className="space-y-3">
                {['Branded Keywords', 'Category Keywords', 'Long-tail Keywords', 'Competitor Keywords'].map((segment, idx) => (
                  <div key={segment} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{segment}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                        <div 
                          className="bg-primary-600 h-2 rounded-full"
                          style={{ width: `${25 + idx * 15}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 w-12 text-right">
                        {(25 + idx * 15).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      
      case 'category-growth-analysis':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartWidget
                title="Category Growth Rates"
                description="Purchase growth by product category"
                type="bar"
              />
              <ChartWidget
                title="Category Share Evolution"
                description="How category mix is changing over time"
                type="line"
              />
            </div>
            
            <TableWidget
              title="Category Performance Breakdown"
              description="Detailed metrics by product category"
            />
          </div>
        )
      
      case 'keyword-velocity-tracking':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricsWidget
                title="Rising Keywords"
                metric="47"
                change="+12"
                trend="up"
                description="New high-velocity terms"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Avg Velocity"
                metric="324%"
                change="+48%"
                trend="up"
                description="Growth rate of risers"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Declining Keywords"
                metric="23"
                change="-8"
                trend="up"
                description="Losing momentum"
                isLoading={isLoading}
              />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50 mb-4">
                  Fastest Rising Keywords
                </h3>
                <div className="space-y-3">
                  {[
                    { keyword: 'wireless earbuds noise cancelling', growth: '+523%' },
                    { keyword: 'bluetooth headphones gym', growth: '+412%' },
                    { keyword: 'sports earbuds waterproof', growth: '+387%' },
                    { keyword: 'gaming headset wireless', growth: '+342%' },
                    { keyword: 'earbuds with microphone', growth: '+298%' },
                  ].map((item) => (
                    <div key={item.keyword} className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{item.keyword}</span>
                      <span className="text-sm font-semibold text-success-600 dark:text-success-400">
                        {item.growth}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              <ChartWidget
                title="Velocity Distribution"
                description="Keywords grouped by growth rate"
                type="bar"
              />
            </div>
          </div>
        )
      
      case 'competitive-growth-index':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricsWidget
                title="Your Growth"
                metric="42.3%"
                change="+8.7pp"
                trend="up"
                description="YoY purchase growth"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Market Growth"
                metric="28.9%"
                change="+3.2pp"
                trend="up"
                description="Category average"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Growth Index"
                metric="1.46x"
                change="+0.23"
                trend="up"
                description="vs market rate"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Percentile Rank"
                metric="87th"
                change="↑5"
                trend="up"
                description="Among competitors"
                isLoading={isLoading}
              />
            </div>
            
            <ChartWidget
              title="Growth Index Trend"
              description="Your growth multiplier vs market over time"
              type="line"
            />
            
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50 mb-4">
                Competitive Growth Comparison
              </h3>
              <TableWidget
                title=""
                description=""
              />
            </div>
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Report Selector */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">
          Select Growth Report
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {growthReports.map((report) => {
            const Icon = report.icon
            const isSelected = selectedReport === report.id
            
            return (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report.id)}
                className={`p-3 rounded-lg border transition-all duration-200 text-left flex items-start gap-3 ${
                  isSelected
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                <Icon className={`w-5 h-5 mt-0.5 ${
                  isSelected 
                    ? 'text-primary-600 dark:text-primary-400' 
                    : 'text-gray-500 dark:text-gray-400'
                }`} />
                <div className="flex-1">
                  <h4 className={`font-medium mb-0.5 ${
                    isSelected
                      ? 'text-primary-700 dark:text-primary-400'
                      : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {report.name}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {report.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Report Content */}
      {renderReportContent()}
    </div>
  )
}