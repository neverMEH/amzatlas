'use client'

import { Clock, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react'

interface TableFreshness {
  table_name: string
  schema: string
  priority: number
  freshness_score: number
  last_refresh: string | null
  hours_since_refresh: number
  status: 'fresh' | 'stale' | 'critical'
  is_core: boolean
  freshness_trend?: 'improving' | 'declining' | 'stable'
}

interface DataFreshnessIndicatorProps {
  tables: TableFreshness[]
}

export function DataFreshnessIndicator({ tables }: DataFreshnessIndicatorProps) {
  if (!tables || tables.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <p className="text-center text-gray-500">No tables to monitor</p>
      </div>
    )
  }

  // Sort tables by priority
  const sortedTables = [...tables].sort((a, b) => b.priority - a.priority)
  
  // Calculate overall freshness
  const overallFreshness = Math.round(
    tables.reduce((sum, table) => sum + table.freshness_score, 0) / tables.length
  )
  
  // Count tables by status
  const statusCounts = {
    fresh: tables.filter(t => t.freshness_score >= 80).length,
    stale: tables.filter(t => t.freshness_score >= 30 && t.freshness_score < 80).length,
    critical: tables.filter(t => t.freshness_score < 30).length
  }
  
  const needsRefresh = tables.filter(t => t.freshness_score < 50).length

  const getFreshnessColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 50) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getProgressBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 50) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const formatTimeSince = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)} minutes ago`
    if (hours < 24) return `${hours.toFixed(1)} hours ago`
    const days = Math.floor(hours / 24)
    if (days === 1) return '1 day ago'
    return `${days} days ago`
  }

  const formatTimeForDisplay = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Freshness</h2>
      
      {/* Overall Summary */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Freshness</span>
          <span className={`text-2xl font-bold ${getFreshnessColor(overallFreshness)}`}>
            {overallFreshness}%
          </span>
        </div>
        
        {/* Status Breakdown */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>{statusCounts.fresh} fresh</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span>{statusCounts.stale} stale</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>{statusCounts.critical} critical</span>
          </div>
        </div>
        
        {/* Alert for tables needing refresh */}
        {needsRefresh > 0 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" />
            {needsRefresh === statusCounts.critical ? 
              `${needsRefresh} tables need immediate attention` :
              `${needsRefresh} tables need refresh`
            }
          </div>
        )}
      </div>

      {/* Table List */}
      <div className="space-y-3">
        {sortedTables.map((table) => (
          <div 
            key={`${table.schema}.${table.table_name}`}
            className="border rounded-lg p-3 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900" data-testid="table-name">
                  {table.table_name}
                </span>
                {table.is_core && (
                  <span 
                    className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full"
                    data-testid="core-badge"
                  >
                    CORE
                  </span>
                )}
                {table.freshness_trend && (
                  <span data-testid={`trend-${table.freshness_trend === 'improving' ? 'up' : 'down'}-${table.table_name}`}>
                    {table.freshness_trend === 'improving' ? 
                      <TrendingUp className="w-4 h-4 text-green-500" /> :
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    }
                  </span>
                )}
              </div>
              <div className={`text-lg font-semibold ${getFreshnessColor(table.freshness_score)}`}>
                {table.freshness_score}%
              </div>
            </div>
            
            <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
              <span>{formatTimeSince(table.hours_since_refresh)}</span>
              <span data-testid="last-sync-time">{formatTimeForDisplay(table.last_refresh)}</span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full ${getProgressBarColor(table.freshness_score)} transition-all duration-500`}
                style={{ width: `${table.freshness_score}%` }}
                role="progressbar"
                aria-valuenow={table.freshness_score}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}