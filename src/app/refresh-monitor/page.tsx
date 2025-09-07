'use client'

import { useState, useEffect } from 'react'
import { RefreshStatusCard } from '@/components/refresh-monitor/RefreshStatusCard'
import { CriticalTablesMonitor } from '@/components/refresh-monitor/CriticalTablesMonitor'
import { PipelineStatusCard } from '@/components/refresh-monitor/PipelineStatusCard'
import { DataFreshnessIndicator } from '@/components/refresh-monitor/DataFreshnessIndicator'
import { TableCategoryFilter } from '@/components/refresh-monitor/TableCategoryFilter'
import { RefreshHistoryTable } from '@/components/refresh-monitor/RefreshHistoryTable'
import { RefreshConfigPanel } from '@/components/refresh-monitor/RefreshConfigPanel'
import { RefreshCw, Settings, History, BarChart3, Activity, Clock, AlertCircle } from 'lucide-react'

export default function RefreshMonitorPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [isLoading, setIsLoading] = useState(true)
  const [statusData, setStatusData] = useState<any>(null)
  const [healthData, setHealthData] = useState<any>(null)
  const [pipelineData, setPipelineData] = useState<any>(null)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // Auto-refresh status every 30 seconds
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch status data
        const statusResponse = await fetch('/api/refresh/status')
        const statusData = await statusResponse.json()
        setStatusData(statusData)

        // Fetch health data
        const healthResponse = await fetch('/api/refresh/health')
        const healthData = await healthResponse.json()
        setHealthData(healthData)

        // Transform status data into pipeline format
        const pipeline = {
          source: {
            name: 'BigQuery',
            status: healthData?.checks?.find((c: any) => c.name === 'database_connectivity')?.status === 'pass' ? 'connected' : 'error',
            lastCheck: new Date().toISOString(),
            details: {
              dataset: 'dataclient_amzatlas_agency_85',
              project: process.env.NEXT_PUBLIC_BIGQUERY_PROJECT_ID || 'your-project-id',
              location: 'US'
            }
          },
          destination: {
            name: 'Supabase',
            status: statusData?.overall_status === 'healthy' ? 'healthy' : statusData?.overall_status === 'warning' ? 'degraded' : 'error',
            lastCheck: new Date().toISOString(),
            details: {
              url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co',
              schema: 'sqp'
            }
          },
          pipeline: {
            status: statusData?.pipeline_activity?.length > 0 ? 'active' : 'inactive',
            lastSync: statusData?.pipeline_activity?.[0]?.started_at || null,
            nextSync: null,
            recentSyncs: statusData?.pipeline_activity?.slice(0, 5).map((activity: any) => ({
              id: activity.id,
              table: activity.table_name,
              status: activity.status,
              startedAt: activity.started_at,
              completedAt: activity.completed_at,
              recordsProcessed: activity.records_processed,
              duration: activity.duration_minutes,
              error: activity.error
            })) || []
          },
          flow: {
            stages: [
              {
                name: 'Extract',
                status: 'active',
                message: 'Reading from BigQuery',
                progress: 100
              },
              {
                name: 'Transform',
                status: 'active',
                message: 'Processing data',
                progress: 100
              },
              {
                name: 'Load',
                status: statusData?.alert_summary?.critical > 0 ? 'error' : 'active',
                message: statusData?.alert_summary?.critical > 0 ? 'Errors detected' : 'Writing to Supabase',
                progress: statusData?.alert_summary?.critical > 0 ? 85 : 100
              }
            ]
          }
        }
        setPipelineData(pipeline)

        setLastUpdate(new Date())
        setIsLoading(false)
      } catch (error) {
        console.error('Failed to fetch data:', error)
        setIsLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    setIsLoading(true)
    window.location.reload()
  }

  // Calculate table categories
  const categories = [
    { 
      id: 'all', 
      label: 'All Tables', 
      count: statusData?.tables?.length || 0,
      description: 'Show all monitored tables'
    },
    { 
      id: 'core', 
      label: 'Core Pipeline', 
      count: statusData?.tables?.filter((t: any) => t.is_core).length || 0,
      description: 'Essential data pipeline tables',
      health: statusData?.critical_tables?.length > 0 ? 'error' as const : 'healthy' as const
    },
    { 
      id: 'brand', 
      label: 'Brand Management', 
      count: statusData?.tables?.filter((t: any) => 
        t.table_name.includes('brand') || t.table_name.includes('product_type')
      ).length || 0,
      description: 'Brand and product mapping tables'
    },
    { 
      id: 'reporting', 
      label: 'Reporting', 
      count: statusData?.tables?.filter((t: any) => 
        t.table_name.includes('report')
      ).length || 0,
      description: 'Report generation and configuration'
    },
    { 
      id: 'legacy', 
      label: 'Legacy', 
      count: statusData?.tables?.filter((t: any) => 
        t.table_name.includes('webhook') || !t.is_core && t.priority < 50
      ).length || 0,
      description: 'Legacy tables (consider removing)',
      health: 'warning' as const
    }
  ]

  // Filter tables based on selected category
  const getFilteredTables = () => {
    if (!statusData?.tables) return []
    
    switch (selectedCategory) {
      case 'core':
        return statusData.tables.filter((t: any) => t.is_core)
      case 'brand':
        return statusData.tables.filter((t: any) => 
          t.table_name.includes('brand') || t.table_name.includes('product_type')
        )
      case 'reporting':
        return statusData.tables.filter((t: any) => t.table_name.includes('report'))
      case 'legacy':
        return statusData.tables.filter((t: any) => 
          t.table_name.includes('webhook') || (!t.is_core && t.priority < 50)
        )
      default:
        return statusData.tables
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'pipeline', label: 'Pipeline', icon: Activity },
    { id: 'history', label: 'History', icon: History },
    { id: 'config', label: 'Configuration', icon: Settings }
  ]

  // Show alert indicator if there are critical alerts
  const hasCriticalAlerts = statusData?.alert_summary?.critical > 0

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Data Pipeline Monitor
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Monitor and manage data synchronization pipeline
              </p>
            </div>
            <div className="flex items-center gap-4">
              {hasCriticalAlerts && (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {statusData.alert_summary.critical}
                  </span>
                </div>
              )}
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
                  {tab.id === 'overview' && hasCriticalAlerts && (
                    <span className="ml-1 w-2 h-2 bg-red-500 rounded-full" />
                  )}
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
                  
                  {/* Table Category Filter */}
                  <div className="bg-white rounded-lg shadow-sm p-4">
                    <TableCategoryFilter
                      categories={categories}
                      selectedCategory={selectedCategory}
                      onCategoryChange={setSelectedCategory}
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Critical Tables */}
                    <CriticalTablesMonitor 
                      tables={getFilteredTables()}
                      criticalThreshold={70}
                    />
                    
                    {/* Data Freshness */}
                    <DataFreshnessIndicator 
                      tables={getFilteredTables().map((t: any) => ({
                        ...t,
                        hours_since_refresh: t.last_refresh ? 
                          (new Date().getTime() - new Date(t.last_refresh).getTime()) / (1000 * 60 * 60) : 
                          999,
                        status: t.freshness_score >= 80 ? 'fresh' : 
                                t.freshness_score >= 30 ? 'stale' : 'critical'
                      }))}
                    />
                  </div>
                </>
              )}
              
              {activeTab === 'pipeline' && (
                <div data-testid="pipeline-status">
                  <PipelineStatusCard pipelineData={pipelineData} />
                </div>
              )}
              
              {activeTab === 'history' && (
                <RefreshHistoryTable />
              )}
              
              {activeTab === 'config' && (
                <RefreshConfigPanel />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}