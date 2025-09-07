'use client'

import { CheckCircle, XCircle, AlertCircle, Clock, Database, Activity, TrendingUp, Heart, AlertTriangle, Info, ArrowRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface StatusCardProps {
  statusData: any
}

export function RefreshStatusCard({ statusData }: StatusCardProps) {
  if (!statusData) return null

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-6 h-6 text-green-500" />
      case 'warning':
        return <AlertCircle className="w-6 h-6 text-yellow-500" />
      case 'error':
        return <XCircle className="w-6 h-6 text-red-500" />
      default:
        return <Clock className="w-6 h-6 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />
    }
  }

  const stats = statusData.statistics || {}
  const alerts = statusData.alerts || []
  const alertSummary = statusData.alert_summary || { critical: 0, warning: 0, info: 0 }
  const pipelineActivity = statusData.pipeline_activity || []
  
  // Calculate core table statistics
  const coreTables = statusData.tables?.filter((t: any) => t.is_core) || []
  const coreTableCount = coreTables.length
  const totalTableCount = statusData.tables?.length || 0
  
  // Calculate success rate
  const successRate = stats.successful_today + stats.failed_today > 0
    ? ((stats.successful_today / (stats.successful_today + stats.failed_today)) * 100).toFixed(1)
    : '0.0'
  
  // Calculate average freshness score for core tables
  const avgFreshnessScore = coreTables.length > 0
    ? Math.round(coreTables.reduce((sum: number, table: any) => sum + table.freshness_score, 0) / coreTables.length)
    : 0

  const formatTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true })
    } catch {
      return 'unknown'
    }
  }

  return (
    <div className="space-y-6">
      {/* System Health Overview */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">System Health</h2>
          {getStatusIcon(statusData.overall_status)}
        </div>
        
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(statusData.overall_status)}`}>
          {statusData.overall_status?.toUpperCase()}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div>
            <p className="text-sm text-gray-500">Core Tables</p>
            <p className="text-2xl font-semibold text-gray-900">
              {coreTableCount} <span className="text-base text-gray-500">of {totalTableCount}</span>
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Success Rate</p>
            <p className="text-2xl font-semibold text-green-600">{successRate}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Health Score</p>
            <p className="text-2xl font-semibold text-blue-600">
              <Heart className="inline w-5 h-5 mr-1" />
              {avgFreshnessScore}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Data Freshness</p>
            <p className="text-sm font-medium text-gray-900 mt-1">
              Last Update<br />
              {statusData.last_updated ? formatTimeAgo(statusData.last_updated) : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Alerts</h2>
          
          {/* Alert Summary */}
          <div className="flex gap-4 mb-4">
            {alertSummary.critical > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                <XCircle className="w-4 h-4" />
                {alertSummary.critical} Critical
              </div>
            )}
            {alertSummary.warning > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                <AlertTriangle className="w-4 h-4" />
                {alertSummary.warning} Warning
              </div>
            )}
            {alertSummary.info > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                <Info className="w-4 h-4" />
                {alertSummary.info} Info
              </div>
            )}
          </div>

          {/* Alert List */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {alerts.slice(0, 5).map((alert: any) => (
              <div 
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-md ${
                  alert.severity === 'critical' ? 'bg-red-50' : 
                  alert.severity === 'warning' ? 'bg-yellow-50' : 
                  'bg-blue-50'
                }`}
              >
                {getAlertIcon(alert.severity)}
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                  {alert.table_name && (
                    <p className="text-xs text-gray-500 mt-1">Table: {alert.table_name}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Core Table Status */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Core Table Status</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {coreTables.map((table: any) => (
              <div 
                key={table.table_name}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{table.table_name}</p>
                    <p className="text-xs text-gray-500">
                      Priority {table.priority} • {table.schema} schema
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Freshness Score */}
                  <div className={`text-sm font-medium ${
                    table.freshness_score >= 80 ? 'text-green-600' :
                    table.freshness_score >= 50 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {table.freshness_score}%
                  </div>
                  {/* Status Icon */}
                  {table.status === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {table.status === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
                  {table.status === 'running' && <Activity className="w-4 h-4 text-blue-500 animate-pulse" />}
                  {table.status === 'overdue' && <AlertCircle className="w-4 h-4 text-yellow-500" />}
                  {table.status === 'pending' && <Clock className="w-4 h-4 text-gray-400" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Pipeline Activity */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Pipeline Activity</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {pipelineActivity.length > 0 ? (
              pipelineActivity.slice(0, 5).map((activity: any) => (
                <div 
                  key={activity.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                >
                  <div className="flex items-center gap-3">
                    <Activity className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{activity.table_name}</p>
                      <p className="text-xs text-gray-500">
                        {activity.operation_type} • {formatTimeAgo(activity.started_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {activity.status === 'success' && (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-xs text-gray-500">
                          {activity.records_processed?.toLocaleString()} records
                        </span>
                      </>
                    )}
                    {activity.status === 'failed' && (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    {activity.status === 'running' && (
                      <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">No recent pipeline activity</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}