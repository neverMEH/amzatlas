'use client'

import { useState, useEffect } from 'react'
import BrandSelector from './brand-selector'
import PeriodComparisonDashboard from './period-comparison-dashboard'
import KeywordTrendsVisualization from './keyword-trends-visualization'
import AnomalyDetectionAlerts from './anomaly-detection-alerts'
import { 
  LayoutDashboard, TrendingUp, AlertTriangle, Calendar,
  Download, RefreshCw, Settings, ChevronDown
} from 'lucide-react'

interface ComprehensiveMetricsDashboardProps {
  initialBrandId?: string | null
}

type TabType = 'overview' | 'period-comparison' | 'keyword-trends' | 'anomalies'

export default function ComprehensiveMetricsDashboard({
  initialBrandId
}: ComprehensiveMetricsDashboardProps) {
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(initialBrandId || null)
  const [selectedBrandName, setSelectedBrandName] = useState<string>('')
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showBrandSelector, setShowBrandSelector] = useState(false)
  const [metrics, setMetrics] = useState<any>(null)

  useEffect(() => {
    if (selectedBrandId) {
      fetchBrandInfo()
      fetchMetrics()
    }
  }, [selectedBrandId, dateRange])

  const fetchBrandInfo = async () => {
    try {
      const response = await fetch(`/api/brands/${selectedBrandId}`)
      const data = await response.json()
      if (data.success) {
        setSelectedBrandName(data.brand.display_name)
      }
    } catch (error) {
      console.error('Error fetching brand info:', error)
    }
  }

  const fetchMetrics = async () => {
    try {
      const params = new URLSearchParams({
        brandId: selectedBrandId || '',
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      })
      
      const response = await fetch(`/api/dashboard/metrics?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setMetrics(data)
      }
    } catch (error) {
      console.error('Error fetching metrics:', error)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchMetrics()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        brandId: selectedBrandId || '',
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        format: 'csv'
      })
      
      const response = await fetch(`/api/reports/export?${params}`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sqp-report-${selectedBrandName || 'all'}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error exporting data:', error)
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'period-comparison', label: 'Period Comparison', icon: TrendingUp },
    { id: 'keyword-trends', label: 'Keyword Trends', icon: TrendingUp },
    { id: 'anomalies', label: 'Anomaly Detection', icon: AlertTriangle }
  ]

  const renderOverview = () => {
    if (!metrics) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Key Metrics Cards */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Key Performance Metrics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-sm text-gray-600">Total Impressions</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {(metrics.totalImpressions / 1000000).toFixed(1)}M
              </div>
              <div className={`text-sm mt-2 ${metrics.impressionsChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.impressionsChange >= 0 ? '+' : ''}{metrics.impressionsChange.toFixed(1)}% vs last period
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-sm text-gray-600">Total Revenue</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                ${(metrics.totalRevenue / 1000).toFixed(1)}K
              </div>
              <div className={`text-sm mt-2 ${metrics.revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.revenueChange >= 0 ? '+' : ''}{metrics.revenueChange.toFixed(1)}% vs last period
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-sm text-gray-600">Conversion Rate</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {metrics.conversionRate.toFixed(2)}%
              </div>
              <div className={`text-sm mt-2 ${metrics.cvrChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.cvrChange >= 0 ? '+' : ''}{metrics.cvrChange.toFixed(2)}pp vs last period
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="text-sm text-gray-600">Market Share</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">
                {metrics.marketShare.toFixed(1)}%
              </div>
              <div className={`text-sm mt-2 ${metrics.shareChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.shareChange >= 0 ? '+' : ''}{metrics.shareChange.toFixed(1)}pp vs last period
              </div>
            </div>
          </div>
        </div>

        {/* Recent Alerts */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3">
            {metrics.recentAlerts?.map((alert: any, index: number) => (
              <div key={index} className="flex items-start gap-3">
                <div className={`
                  p-2 rounded-lg
                  ${alert.type === 'anomaly' ? 'bg-red-50' : 
                    alert.type === 'trend' ? 'bg-green-50' : 'bg-blue-50'}
                `}>
                  <AlertTriangle className={`
                    w-4 h-4
                    ${alert.type === 'anomaly' ? 'text-red-600' : 
                      alert.type === 'trend' ? 'text-green-600' : 'text-blue-600'}
                  `} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                  <p className="text-xs text-gray-600 mt-1">{alert.description}</p>
                  <p className="text-xs text-gray-500 mt-1">{alert.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-semibold text-gray-900">
                SQP Intelligence Dashboard
              </h1>
              <div className="relative">
                <button
                  onClick={() => setShowBrandSelector(!showBrandSelector)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <span className="text-sm font-medium">
                    {selectedBrandName || 'All Brands'}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                
                {showBrandSelector && (
                  <div className="absolute top-12 left-0 w-80 z-50">
                    <BrandSelector
                      selectedBrandId={selectedBrandId}
                      onBrandSelect={(brandId) => {
                        setSelectedBrandId(brandId)
                        setShowBrandSelector(false)
                      }}
                      showStats={true}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Date Range Picker */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                <Calendar className="w-4 h-4 text-gray-500" />
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                  className="bg-transparent text-sm focus:outline-none"
                />
                <span className="text-gray-500">-</span>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                  className="bg-transparent text-sm focus:outline-none"
                />
              </div>

              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm font-medium">Export</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1">
            {tabs.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${activeTab === tab.id
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && renderOverview()}
        
        {activeTab === 'period-comparison' && (
          <PeriodComparisonDashboard
            brandId={selectedBrandId}
            dateRange={dateRange}
          />
        )}
        
        {activeTab === 'keyword-trends' && (
          <KeywordTrendsVisualization
            brandId={selectedBrandId}
            dateRange={dateRange}
          />
        )}
        
        {activeTab === 'anomalies' && (
          <AnomalyDetectionAlerts
            brandId={selectedBrandId}
            onAlertClick={(anomaly) => {
              // Handle alert click - could navigate to detailed view
              console.log('Alert clicked:', anomaly)
            }}
          />
        )}
      </div>
    </div>
  )
}