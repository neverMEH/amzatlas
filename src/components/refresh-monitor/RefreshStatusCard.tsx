'use client'

import { CheckCircle, XCircle, AlertCircle, Clock, Database, Activity } from 'lucide-react'

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

  const stats = statusData.statistics || {}

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Overall Status */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">System Status</h2>
          {getStatusIcon(statusData.overall_status)}
        </div>
        
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(statusData.overall_status)}`}>
          {statusData.overall_status?.toUpperCase()}
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Total Tables</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total_tables || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Enabled</p>
              <p className="text-2xl font-semibold text-green-600">{stats.enabled_tables || 0}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Successful Today</p>
              <p className="text-2xl font-semibold text-green-600">{stats.successful_today || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Failed Today</p>
              <p className="text-2xl font-semibold text-red-600">{stats.failed_today || 0}</p>
            </div>
          </div>
        </div>

        {stats.stale_tables > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              {stats.stale_tables} table{stats.stale_tables !== 1 ? 's' : ''} may be stale
            </p>
          </div>
        )}

        {stats.overdue_tables > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">
              {stats.overdue_tables} table{stats.overdue_tables !== 1 ? 's' : ''} overdue for refresh
            </p>
          </div>
        )}
      </div>

      {/* Table Status List */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Table Status</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {statusData.tables?.map((table: any) => (
            <div 
              key={table.table_name}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Database className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{table.table_name}</p>
                  <p className="text-xs text-gray-500">
                    {table.enabled ? 'Enabled' : 'Disabled'} • Priority {table.priority}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {table.status === 'success' && <CheckCircle className="w-4 h-4 text-green-500" />}
                {table.status === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
                {table.status === 'running' && <Activity className="w-4 h-4 text-blue-500 animate-pulse" />}
                {table.status === 'overdue' && <AlertCircle className="w-4 h-4 text-yellow-500" />}
                {table.status === 'pending' && <Clock className="w-4 h-4 text-gray-400" />}
                <span className="text-xs text-gray-500">
                  {table.hours_until_refresh !== null && table.hours_until_refresh > 0
                    ? `in ${Math.round(table.hours_until_refresh)}h`
                    : table.status === 'overdue'
                    ? 'overdue'
                    : 'ready'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}