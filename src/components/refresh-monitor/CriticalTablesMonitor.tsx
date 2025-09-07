'use client'

import { Database, AlertCircle, CheckCircle, XCircle, Clock, TrendingUp, TrendingDown } from 'lucide-react'

interface Table {
  table_name: string
  schema: string
  is_core: boolean
  priority: number
  freshness_score: number
  last_refresh: string | null
  next_refresh: string | null
  status: string
  enabled: boolean
  frequency_hours: number
  recent_error?: string | null
}

interface CriticalTablesMonitorProps {
  tables: Table[]
  criticalThreshold?: number
}

export function CriticalTablesMonitor({ tables, criticalThreshold = 80 }: CriticalTablesMonitorProps) {
  // Filter and sort critical tables
  const criticalTables = tables
    .filter(table => table.is_core || table.priority >= criticalThreshold)
    .sort((a, b) => b.priority - a.priority)

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'running':
        return <Clock className="w-4 h-4 text-blue-500 animate-pulse" />
      case 'overdue':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getFreshnessColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getFreshnessBackground = (score: number) => {
    if (score >= 80) return 'bg-green-100'
    if (score >= 50) return 'bg-yellow-100'
    return 'bg-red-100'
  }

  const formatLastRefresh = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  const getTableCategory = (table: Table) => {
    if (table.table_name.includes('sync_log')) return 'Pipeline Monitoring'
    if (table.table_name.includes('performance')) return 'Performance Data'
    if (table.table_name.includes('brand') || table.table_name.includes('product_type')) return 'Brand Management'
    if (table.table_name.includes('quality')) return 'Data Quality'
    return 'Other'
  }

  // Group tables by category
  const tablesByCategory = criticalTables.reduce((acc, table) => {
    const category = getTableCategory(table)
    if (!acc[category]) acc[category] = []
    acc[category].push(table)
    return acc
  }, {} as Record<string, Table[]>)

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Critical Tables Monitoring</h2>
        <div className="text-sm text-gray-500">
          {criticalTables.length} critical tables
        </div>
      </div>

      {Object.entries(tablesByCategory).map(([category, categoryTables]) => (
        <div key={category} className="mb-6 last:mb-0">
          <h3 className="text-sm font-medium text-gray-700 mb-3">{category}</h3>
          
          <div className="space-y-2">
            {categoryTables.map((table) => (
              <div 
                key={`${table.schema}.${table.table_name}`}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <Database className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{table.table_name}</p>
                        {table.is_core && (
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                            CORE
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          Priority: {table.priority}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {table.schema} schema • Refresh every {table.frequency_hours}h
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Freshness Score */}
                    <div className="text-center">
                      <div className={`text-sm font-medium ${getFreshnessColor(table.freshness_score)}`}>
                        {table.freshness_score}%
                      </div>
                      <div className="text-xs text-gray-500">Freshness</div>
                    </div>

                    {/* Last Refresh */}
                    <div className="text-center">
                      <div className="text-sm text-gray-900">
                        {formatLastRefresh(table.last_refresh)}
                      </div>
                      <div className="text-xs text-gray-500">Last refresh</div>
                    </div>

                    {/* Status */}
                    <div className="flex flex-col items-center">
                      {getStatusIcon(table.status)}
                      <div className="text-xs text-gray-500 mt-1 capitalize">
                        {table.status}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full ${getFreshnessBackground(table.freshness_score)} transition-all duration-500`}
                      style={{ width: `${table.freshness_score}%` }}
                    />
                  </div>
                </div>

                {/* Error Message */}
                {table.recent_error && (
                  <div className="mt-3 p-2 bg-red-50 rounded text-sm text-red-700">
                    <strong>Error:</strong> {table.recent_error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {criticalTables.length === 0 && (
        <p className="text-center text-gray-500 py-8">
          No critical tables found
        </p>
      )}
    </div>
  )
}