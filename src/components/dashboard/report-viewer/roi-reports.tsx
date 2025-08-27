'use client'

import { useState } from 'react'
import { DollarSign, PiggyBank, Calculator, TrendingDown } from 'lucide-react'
import MetricsWidget from '@/components/dashboard/widgets/metrics-widget'
import ChartWidget from '@/components/dashboard/widgets/chart-widget'
import ROITrendChart from '@/components/dashboard/widgets/roi-trend-chart'
import TableWidget from '@/components/dashboard/widgets/table-widget'
import { usePurchaseMetrics, useNegativeROIKeywords } from '@/hooks/use-sqp-data'

const roiReports = [
  {
    id: 'purchase-roi-summary',
    name: 'Purchase-Based ROI',
    description: 'True ROI using actual purchase data',
    icon: DollarSign,
  },
  {
    id: 'keyword-profitability',
    name: 'Keyword Profitability Analysis',
    description: 'Profit margins by keyword segment',
    icon: Calculator,
  },
  {
    id: 'budget-efficiency',
    name: 'Budget Efficiency Report',
    description: 'Ad spend optimization opportunities',
    icon: PiggyBank,
  },
  {
    id: 'negative-roi-keywords',
    name: 'Negative ROI Keywords',
    description: 'Keywords losing money on purchases',
    icon: TrendingDown,
  },
]

export default function ROIReports() {
  const [selectedReport, setSelectedReport] = useState('purchase-roi-summary')
  const { data: metrics, isLoading } = usePurchaseMetrics()
  const { data: negativeROIKeywords, isLoading: isLoadingNegativeROI } = useNegativeROIKeywords(15)

  const renderReportContent = () => {
    switch (selectedReport) {
      case 'purchase-roi-summary':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricsWidget
                title="Overall ROI"
                metric={metrics ? `${metrics.purchaseROI.toFixed(0)}%` : '—'}
                change={metrics ? `${metrics.roiChange > 0 ? '+' : ''}${metrics.roiChange.toFixed(0)}pp` : '—'}
                trend={metrics && metrics.roiChange > 0 ? 'up' : 'down'}
                description="Purchase-based ROAS"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Revenue"
                metric="$124,892"
                change="+$18,234"
                trend="up"
                description="From purchases"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Ad Spend"
                metric="$42,847"
                change="+$2,847"
                trend="down"
                description="Total investment"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Profit Margin"
                metric="65.7%"
                change="+4.2pp"
                trend="up"
                description="After ad costs"
                isLoading={isLoading}
              />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ROITrendChart weeks={12} />
              <ChartWidget
                title="ROI by Campaign Type"
                description="Performance across campaign strategies"
                type="bar"
              />
            </div>
            
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50 mb-4">
                ROI Breakdown by Match Type
              </h3>
              <div className="space-y-4">
                {[
                  { type: 'Exact Match', roi: '312%', spend: '$12,482', revenue: '$38,942' },
                  { type: 'Phrase Match', roi: '248%', spend: '$18,923', revenue: '$46,928' },
                  { type: 'Broad Match', roi: '187%', spend: '$11,442', revenue: '$21,394' },
                ].map((item) => (
                  <div key={item.type} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{item.type}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Spend: {item.spend} | Revenue: {item.revenue}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-success-600 dark:text-success-400">{item.roi}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">ROI</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      
      case 'keyword-profitability':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricsWidget
                title="Profitable Keywords"
                metric="847"
                change="+124"
                trend="up"
                description="Positive ROI keywords"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Break-even Keywords"
                metric="234"
                change="-23"
                trend="down"
                description="90-110% ROI"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Loss-making Keywords"
                metric="189"
                change="-48"
                trend="up"
                description="Negative ROI"
                isLoading={isLoading}
              />
            </div>
            
            <TableWidget
              title="Keyword Profitability Matrix"
              description="Detailed profitability metrics by keyword"
            />
            
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50 mb-4">
                Profitability Distribution
              </h3>
              <ChartWidget
                title=""
                description="Keywords grouped by ROI ranges"
                type="bar"
              />
            </div>
          </div>
        )
      
      case 'budget-efficiency':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricsWidget
                title="Wasted Spend"
                metric="$8,234"
                change="-$1,823"
                trend="up"
                description="On zero-purchase keywords"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Efficiency Score"
                metric="78.4%"
                change="+3.2pp"
                trend="up"
                description="Budget utilization"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Cost Per Purchase"
                metric="$16.82"
                change="-$2.34"
                trend="up"
                description="Average CPP"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Optimization Potential"
                metric="$12,847"
                change="+$2,384"
                trend="down"
                description="Reallocatable budget"
                isLoading={isLoading}
              />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50 mb-4">
                  Budget Allocation Recommendations
                </h3>
                <div className="space-y-3">
                  {[
                    { action: 'Pause zero-purchase keywords', savings: '$8,234', impact: 'No revenue loss' },
                    { action: 'Reduce broad match spend', savings: '$3,892', impact: 'Minimal impact' },
                    { action: 'Reallocate to top performers', savings: '$0', impact: '+$12,834 revenue' },
                    { action: 'Optimize bid adjustments', savings: '$2,384', impact: 'Maintain position' },
                  ].map((item) => (
                    <div key={item.action} className="flex items-center justify-between py-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.action}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.impact}</p>
                      </div>
                      <span className="text-sm font-semibold text-success-600 dark:text-success-400">
                        {item.savings}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              <ChartWidget
                title="Spend Efficiency by Hour"
                description="ROI performance throughout the day"
                type="line"
              />
            </div>
          </div>
        )
      
      case 'negative-roi-keywords':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricsWidget
                title="Negative ROI Keywords"
                metric="189"
                change="-48"
                trend="up"
                description="Keywords losing money"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Total Loss"
                metric="$14,823"
                change="-$3,234"
                trend="up"
                description="From negative ROI"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Avg Loss Per Keyword"
                metric="$78.43"
                change="-$12.34"
                trend="up"
                description="Average loss"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Recovery Potential"
                metric="$9,234"
                change="+$1,823"
                trend="up"
                description="If optimized"
                isLoading={isLoading}
              />
            </div>
            
            <TableWidget
              title="Negative ROI Keywords Detail"
              description="Keywords requiring immediate attention"
            />
            
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50 mb-4">
                Recommended Actions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-error-50 dark:bg-error-900/20 rounded-lg border border-error-200 dark:border-error-800">
                  <h4 className="font-medium text-error-900 dark:text-error-100 mb-2">Immediate Pause (47 keywords)</h4>
                  <p className="text-sm text-error-700 dark:text-error-300">
                    Keywords with -50% ROI or worse. Pause immediately to stop losses.
                  </p>
                  <p className="text-sm font-semibold text-error-900 dark:text-error-100 mt-2">
                    Potential savings: $8,234/month
                  </p>
                </div>
                <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-200 dark:border-warning-800">
                  <h4 className="font-medium text-warning-900 dark:text-warning-100 mb-2">Optimization Required (142 keywords)</h4>
                  <p className="text-sm text-warning-700 dark:text-warning-300">
                    Keywords with -10% to -50% ROI. Reduce bids or improve targeting.
                  </p>
                  <p className="text-sm font-semibold text-warning-900 dark:text-warning-100 mt-2">
                    Potential recovery: $6,589/month
                  </p>
                </div>
              </div>
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
          Select ROI Report
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {roiReports.map((report) => {
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