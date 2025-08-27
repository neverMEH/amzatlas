'use client'

import { useState } from 'react'
import { BarChart2, TrendingUp, ShoppingCart, Target } from 'lucide-react'
import MetricsWidget from '@/components/dashboard/widgets/metrics-widget'
import TableWidget from '@/components/dashboard/widgets/table-widget'
import ChartWidget from '@/components/dashboard/widgets/chart-widget'
import { usePurchaseMetrics, useZeroPurchaseKeywords } from '@/hooks/use-sqp-data'

const performanceReports = [
  {
    id: 'daily-purchase-summary',
    name: 'Daily Purchase Summary',
    description: 'Daily purchase counts, share, and conversion rates',
    icon: BarChart2,
  },
  {
    id: 'keyword-purchase-performance',
    name: 'Keyword Purchase Performance',
    description: 'Top keywords by purchase volume and ROI',
    icon: TrendingUp,
  },
  {
    id: 'zero-purchase-keywords',
    name: 'Zero Purchase Keywords',
    description: 'Keywords with clicks but no purchases',
    icon: Target,
  },
  {
    id: 'purchase-velocity',
    name: 'Purchase Velocity Report',
    description: 'Week-over-week purchase growth rates',
    icon: ShoppingCart,
  },
]

export default function PerformanceReports() {
  const [selectedReport, setSelectedReport] = useState('daily-purchase-summary')
  const { data: metrics, isLoading } = usePurchaseMetrics()
  const { data: zeroPurchaseKeywords, isLoading: isLoadingZero } = useZeroPurchaseKeywords(10)

  const renderReportContent = () => {
    switch (selectedReport) {
      case 'daily-purchase-summary':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="lg:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <MetricsWidget
                  title="Today's Purchases"
                  metric={metrics?.totalPurchases.toLocaleString() || '—'}
                  change={metrics ? `${metrics.weekOverWeekChange > 0 ? '+' : ''}${metrics.weekOverWeekChange.toFixed(1)}%` : '—'}
                  trend={metrics && metrics.weekOverWeekChange > 0 ? 'up' : 'down'}
                  description="vs last week"
                  isLoading={isLoading}
                />
                <MetricsWidget
                  title="Purchase Share"
                  metric={metrics ? `${metrics.marketShare.toFixed(1)}%` : '—'}
                  change={metrics ? `${metrics.marketShareChange > 0 ? '+' : ''}${metrics.marketShareChange.toFixed(1)}pp` : '—'}
                  trend={metrics && metrics.marketShareChange > 0 ? 'up' : 'down'}
                  description="of market total"
                  isLoading={isLoading}
                />
                <MetricsWidget
                  title="Purchase CVR"
                  metric={metrics ? `${metrics.purchaseCVR.toFixed(2)}%` : '—'}
                  change={metrics ? `${metrics.cvrChange > 0 ? '+' : ''}${metrics.cvrChange.toFixed(2)}pp` : '—'}
                  trend={metrics && metrics.cvrChange > 0 ? 'up' : 'down'}
                  description="clicks to purchases"
                  isLoading={isLoading}
                />
              </div>
            </div>
            <ChartWidget
              title="Purchase Trend (Last 12 Weeks)"
              description="Weekly purchase volume comparison"
              type="line"
            />
            <TableWidget
              title="Top Performing Keywords Today"
              description="Keywords with highest purchase counts"
            />
          </div>
        )
      
      case 'keyword-purchase-performance':
        return (
          <div className="space-y-6">
            <TableWidget
              title="Keyword Purchase Performance"
              description="Detailed keyword metrics sorted by purchase volume"
            />
            <ChartWidget
              title="Keyword Performance Distribution"
              description="Purchase distribution across top keywords"
              type="bar"
            />
          </div>
        )
      
      case 'zero-purchase-keywords':
        const totalWastedSpend = zeroPurchaseKeywords?.reduce((sum, kw) => sum + kw.spend, 0) || 0
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetricsWidget
                title="Zero Purchase Keywords"
                metric={metrics?.zeroPurchaseKeywords.toString() || '—'}
                change={metrics ? `${metrics.zeroPurchaseChange > 0 ? '+' : ''}${metrics.zeroPurchaseChange}` : '—'}
                trend={metrics && metrics.zeroPurchaseChange < 0 ? 'up' : 'down'}
                description="Keywords with wasted spend"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Wasted Ad Spend"
                metric={`$${totalWastedSpend.toLocaleString()}`}
                change={totalWastedSpend > 0 ? 'Critical issue' : 'No waste detected'}
                trend={totalWastedSpend > 0 ? 'down' : 'up'}
                description="On zero purchase keywords"
                isLoading={isLoadingZero}
              />
            </div>
            
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">Zero Purchase Keywords Detail</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Keywords with clicks but no purchases - opportunity for optimization</p>
              </div>

              {isLoadingZero ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                    <thead>
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Keyword</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ad Spend</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Market Purchases</th>
                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {(zeroPurchaseKeywords || []).map((keyword) => (
                        <tr key={keyword.keyword} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                            {keyword.keyword}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-right text-error-600 dark:text-error-400">
                            ${keyword.spend.toLocaleString()}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                            {keyword.marketPurchases.toLocaleString()}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-center">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-error-100 text-error-800 dark:bg-error-900/20 dark:text-error-400">
                              Pause recommended
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      
      case 'purchase-velocity':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricsWidget
                title="Weekly Growth"
                metric={metrics ? `${metrics.weekOverWeekChange.toFixed(1)}%` : '—'}
                change="Accelerating"
                trend={metrics && metrics.weekOverWeekChange > 0 ? 'up' : 'down'}
                description="Week over week"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Monthly Growth"
                metric="34.2%"
                change="+5.3pp"
                trend="up"
                description="Month over month"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Growth Rank"
                metric="#3"
                change="↑2"
                trend="up"
                description="In your category"
                isLoading={isLoading}
              />
            </div>
            <ChartWidget
              title="Purchase Velocity Trend"
              description="12-week rolling purchase growth rate"
              type="line"
            />
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
          Select Performance Report
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {performanceReports.map((report) => {
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