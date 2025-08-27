'use client'

import { useState } from 'react'
import { Target, Lightbulb, Shield, Compass } from 'lucide-react'
import MetricsWidget from '@/components/dashboard/widgets/metrics-widget'
import ChartWidget from '@/components/dashboard/widgets/chart-widget'
import TableWidget from '@/components/dashboard/widgets/table-widget'
import { usePurchaseMetrics, useTopKeywords } from '@/hooks/use-sqp-data'

const strategicReports = [
  {
    id: 'opportunity-identification',
    name: 'Opportunity Identification',
    description: 'Untapped keywords and market gaps',
    icon: Lightbulb,
  },
  {
    id: 'defensive-strategy',
    name: 'Defensive Strategy Report',
    description: 'Protect market share from competitors',
    icon: Shield,
  },
  {
    id: 'market-expansion',
    name: 'Market Expansion Analysis',
    description: 'New categories and segments to target',
    icon: Compass,
  },
  {
    id: 'optimization-priorities',
    name: 'Optimization Priority Matrix',
    description: 'Ranked actions for maximum impact',
    icon: Target,
  },
]

export default function StrategicReports() {
  const [selectedReport, setSelectedReport] = useState('opportunity-identification')
  const { data: metrics, isLoading } = usePurchaseMetrics()

  const renderReportContent = () => {
    switch (selectedReport) {
      case 'opportunity-identification':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricsWidget
                title="Untapped Keywords"
                metric="234"
                change="+48"
                trend="up"
                description="High-volume, low competition"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Market Gaps"
                metric="12"
                change="+3"
                trend="up"
                description="Underserved segments"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Revenue Potential"
                metric="$89,234"
                change="+$12,847"
                trend="up"
                description="From new opportunities"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Quick Wins"
                metric="47"
                change="+8"
                trend="up"
                description="Easy implementations"
                isLoading={isLoading}
              />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50 mb-4">
                  Top Opportunities by Impact
                </h3>
                <div className="space-y-3">
                  {[
                    { opportunity: 'Long-tail keyword expansion', impact: '$34,892', difficulty: 'Easy' },
                    { opportunity: 'Competitor keyword targeting', impact: '$28,234', difficulty: 'Medium' },
                    { opportunity: 'Category cross-selling', impact: '$18,923', difficulty: 'Easy' },
                    { opportunity: 'Seasonal trend capture', impact: '$12,384', difficulty: 'Hard' },
                    { opportunity: 'Bundle keyword strategy', impact: '$9,234', difficulty: 'Medium' },
                  ].map((item) => (
                    <div key={item.opportunity} className="flex items-center justify-between py-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.opportunity}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Difficulty: {item.difficulty}</p>
                      </div>
                      <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                        {item.impact}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              <ChartWidget
                title="Opportunity Score Distribution"
                description="Keywords ranked by opportunity score"
                type="bar"
              />
            </div>
            
            <TableWidget
              title="Keyword Opportunity Analysis"
              description="Detailed breakdown of untapped keywords"
            />
          </div>
        )
      
      case 'defensive-strategy':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricsWidget
                title="At-Risk Keywords"
                metric="89"
                change="+12"
                trend="down"
                description="Losing share"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Competitive Threats"
                metric="23"
                change="+5"
                trend="down"
                description="Active competitors"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Defense Budget"
                metric="$18,234"
                change="+$2,847"
                trend="up"
                description="Required investment"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Share at Risk"
                metric="8.3%"
                change="+1.2pp"
                trend="down"
                description="If no action taken"
                isLoading={isLoading}
              />
            </div>
            
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50 mb-4">
                Defensive Action Plan
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-error-50 dark:bg-error-900/20 rounded-lg border border-error-200 dark:border-error-800">
                  <h4 className="font-medium text-error-900 dark:text-error-100 mb-2">Critical Defense (23 keywords)</h4>
                  <p className="text-sm text-error-700 dark:text-error-300">
                    Core keywords under immediate threat. Increase bids by 20-30% to defend position.
                  </p>
                  <p className="text-sm font-semibold text-error-900 dark:text-error-100 mt-2">
                    Investment required: $8,234
                  </p>
                </div>
                <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-200 dark:border-warning-800">
                  <h4 className="font-medium text-warning-900 dark:text-warning-100 mb-2">Proactive Defense (66 keywords)</h4>
                  <p className="text-sm text-warning-700 dark:text-warning-300">
                    Keywords showing early signs of competition. Monitor closely and adjust as needed.
                  </p>
                  <p className="text-sm font-semibold text-warning-900 dark:text-warning-100 mt-2">
                    Budget allocation: $10,000
                  </p>
                </div>
              </div>
            </div>
            
            <ChartWidget
              title="Share Defense Trend"
              description="Impact of defensive strategies over time"
              type="line"
            />
          </div>
        )
      
      case 'market-expansion':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricsWidget
                title="New Categories"
                metric="7"
                change="+2"
                trend="up"
                description="Expansion opportunities"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Adjacent Markets"
                metric="18"
                change="+4"
                trend="up"
                description="Related segments"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Expansion Potential"
                metric="$234K"
                change="+$48K"
                trend="up"
                description="Annual revenue opportunity"
                isLoading={isLoading}
              />
            </div>
            
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50 mb-4">
                Market Expansion Roadmap
              </h3>
              <div className="space-y-4">
                {[
                  { 
                    phase: 'Phase 1: Adjacent Categories', 
                    timeline: 'Weeks 1-4', 
                    categories: ['Wireless Speakers', 'Gaming Accessories'],
                    investment: '$12,000',
                    expectedReturn: '$48,000'
                  },
                  { 
                    phase: 'Phase 2: Complementary Products', 
                    timeline: 'Weeks 5-8', 
                    categories: ['Phone Accessories', 'Audio Cables'],
                    investment: '$18,000',
                    expectedReturn: '$72,000'
                  },
                  { 
                    phase: 'Phase 3: New Segments', 
                    timeline: 'Weeks 9-12', 
                    categories: ['Professional Audio', 'Home Theater'],
                    investment: '$28,000',
                    expectedReturn: '$114,000'
                  },
                ].map((item) => (
                  <div key={item.phase} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">{item.phase}</h4>
                      <span className="text-sm text-gray-500 dark:text-gray-400">{item.timeline}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                      Target categories: {item.categories.join(', ')}
                    </p>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Investment: {item.investment}</span>
                      <span className="font-semibold text-success-600 dark:text-success-400">Expected: {item.expectedReturn}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <TableWidget
              title="Category Expansion Analysis"
              description="Detailed metrics for expansion opportunities"
            />
          </div>
        )
      
      case 'optimization-priorities':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricsWidget
                title="High Priority"
                metric="12"
                change="+3"
                trend="up"
                description="Immediate actions"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Total Impact"
                metric="$148K"
                change="+$23K"
                trend="up"
                description="If all implemented"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="Quick Wins"
                metric="28"
                change="+7"
                trend="up"
                description="< 1 week to implement"
                isLoading={isLoading}
              />
              <MetricsWidget
                title="ROI Multiplier"
                metric="3.8x"
                change="+0.6x"
                trend="up"
                description="Average return"
                isLoading={isLoading}
              />
            </div>
            
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50 mb-4">
                Priority Action Matrix
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                  <thead>
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Action
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Priority
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Effort
                      </th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Impact
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Timeline
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {[
                      { action: 'Pause zero-purchase keywords', priority: 'Critical', effort: 'Low', impact: '$8,234/mo', timeline: 'Immediate' },
                      { action: 'Implement dayparting strategy', priority: 'High', effort: 'Medium', impact: '$12,847/mo', timeline: '1 week' },
                      { action: 'Launch long-tail campaign', priority: 'High', effort: 'Medium', impact: '$18,923/mo', timeline: '2 weeks' },
                      { action: 'Optimize match type mix', priority: 'Medium', effort: 'Low', impact: '$6,234/mo', timeline: '3 days' },
                      { action: 'Expand to adjacent categories', priority: 'Medium', effort: 'High', impact: '$34,892/mo', timeline: '1 month' },
                    ].map((item) => (
                      <tr key={item.action} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                          {item.action}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.priority === 'Critical' ? 'bg-error-100 text-error-800 dark:bg-error-900/20 dark:text-error-400' :
                            item.priority === 'High' ? 'bg-warning-100 text-warning-800 dark:bg-warning-900/20 dark:text-warning-400' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                          }`}>
                            {item.priority}
                          </span>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">
                          {item.effort}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-right font-semibold text-success-600 dark:text-success-400">
                          {item.impact}
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">
                          {item.timeline}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <ChartWidget
              title="Cumulative Impact Timeline"
              description="Expected results from implementing priorities"
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
          Select Strategic Report
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {strategicReports.map((report) => {
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