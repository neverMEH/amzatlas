'use client'

import { useState, useEffect } from 'react'
import { RefreshStatusCard } from '@/components/refresh-monitor/RefreshStatusCard'
import { RefreshHistoryTable } from '@/components/refresh-monitor/RefreshHistoryTable'
import { RefreshMetricsChart } from '@/components/refresh-monitor/RefreshMetricsChart'
import { RefreshConfigPanel } from '@/components/refresh-monitor/RefreshConfigPanel'
import { WebhookPanel } from '@/components/refresh-monitor/WebhookPanel'
import { RefreshCw, Settings, History, BarChart3, Bell } from 'lucide-react'

export default function RefreshMonitorPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(true)
  const [statusData, setStatusData] = useState<any>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // Auto-refresh status every 30 seconds
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/refresh/status')
        const data = await response.json()
        setStatusData(data)
        setLastUpdate(new Date())
        setIsLoading(false)
      } catch (error) {
        console.error('Failed to fetch status:', error)
        setIsLoading(false)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    setIsLoading(true)
    window.location.reload()
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'history', label: 'History', icon: History },
    { id: 'config', label: 'Configuration', icon: Settings },
    { id: 'webhooks', label: 'Webhooks', icon: Bell }
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                BigQuery Refresh Monitor
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Monitor and manage automated data refresh operations
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </div>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 bg-white rounded-lg shadow-sm">
          <nav className="flex space-x-1 p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors
                    ${activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <>
                  <RefreshStatusCard statusData={statusData} />
                  <RefreshMetricsChart />
                </>
              )}
              {activeTab === 'history' && (
                <RefreshHistoryTable />
              )}
              {activeTab === 'config' && (
                <RefreshConfigPanel />
              )}
              {activeTab === 'webhooks' && (
                <WebhookPanel />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}