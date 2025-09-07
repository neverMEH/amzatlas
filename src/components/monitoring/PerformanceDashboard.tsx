'use client'

import React, { useState, useEffect } from 'react'
import { performanceTracker } from '@/lib/monitoring/performance-tracker'
import { Activity, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PerformanceStats {
  avg: number
  min: number
  max: number
  count: number
}

export function PerformanceDashboard({ className }: { className?: string }) {
  const [stats, setStats] = useState<Record<string, PerformanceStats>>({})
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  useEffect(() => {
    const updateStats = () => {
      const summary = performanceTracker.getSummary()
      setStats(summary)
      setLastUpdate(new Date())
    }

    // Initial update
    updateStats()

    // Update every 5 seconds
    const interval = setInterval(updateStats, 5000)

    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (avgTime: number) => {
    if (avgTime < 50) return 'text-green-600'
    if (avgTime < 200) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getStatusIcon = (avgTime: number) => {
    if (avgTime < 50) return <CheckCircle className="h-4 w-4" />
    if (avgTime < 200) return <Clock className="h-4 w-4" />
    return <AlertTriangle className="h-4 w-4" />
  }

  const formatTime = (ms: number) => {
    if (ms < 1) return '<1ms'
    if (ms < 1000) return `${ms.toFixed(0)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  if (Object.keys(stats).length === 0) {
    return (
      <div className={cn('p-4 bg-gray-50 rounded-lg', className)}>
        <div className="text-center text-gray-500">
          <Activity className="h-8 w-8 mx-auto mb-2 animate-pulse" />
          <p>No performance data available yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('p-4 bg-white rounded-lg border', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Performance Monitor
        </h3>
        <p className="text-sm text-gray-500">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </p>
      </div>

      <div className="space-y-3">
        {Object.entries(stats)
          .sort((a, b) => b[1].avg - a[1].avg)
          .map(([operation, stat]) => (
            <div
              key={operation}
              className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('flex items-center gap-1', getStatusColor(stat.avg))}>
                      {getStatusIcon(stat.avg)}
                    </span>
                    <h4 className="font-medium text-sm">{operation}</h4>
                    <span className="text-xs text-gray-500">({stat.count} calls)</span>
                  </div>
                  
                  <div className="mt-2 grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-gray-500">Avg:</span>
                      <span className={cn('ml-1 font-mono', getStatusColor(stat.avg))}>
                        {formatTime(stat.avg)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Min:</span>
                      <span className="ml-1 font-mono text-gray-700">
                        {formatTime(stat.min)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Max:</span>
                      <span className={cn(
                        'ml-1 font-mono',
                        stat.max > 500 ? 'text-red-600' : 'text-gray-700'
                      )}>
                        {formatTime(stat.max)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {stat.avg > 200 && (
                <div className="mt-2 text-xs text-yellow-600 bg-yellow-50 p-2 rounded">
                  ⚠️ This operation is running slower than expected
                </div>
              )}
            </div>
          ))}
      </div>

      <div className="mt-4 pt-4 border-t">
        <button
          onClick={() => {
            performanceTracker.clear()
            setStats({})
          }}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Clear performance data
        </button>
      </div>
    </div>
  )
}