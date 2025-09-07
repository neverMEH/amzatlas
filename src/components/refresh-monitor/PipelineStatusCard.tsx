'use client'

import { ArrowRight, Database, Cloud, CheckCircle, XCircle, AlertCircle, Activity, Clock } from 'lucide-react'

interface PipelineData {
  source: {
    name: string
    status: 'connected' | 'disconnected' | 'error'
    lastCheck: string
    details?: {
      dataset?: string
      project?: string
      location?: string
    }
  }
  destination: {
    name: string
    status: 'healthy' | 'degraded' | 'error'
    lastCheck: string
    details?: {
      url?: string
      schema?: string
    }
  }
  pipeline: {
    status: 'active' | 'inactive' | 'error'
    lastSync: string | null
    nextSync: string | null
    recentSyncs: Array<{
      id: string
      table: string
      status: 'success' | 'failed' | 'running'
      startedAt: string
      completedAt?: string
      recordsProcessed?: number
      duration?: number
      error?: string
    }>
  }
  flow: {
    stages: Array<{
      name: string
      status: 'active' | 'warning' | 'error' | 'idle'
      message?: string
      progress?: number
    }>
  }
}

interface PipelineStatusCardProps {
  pipelineData: PipelineData | null
}

export function PipelineStatusCard({ pipelineData }: PipelineStatusCardProps) {
  if (!pipelineData) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <p className="text-center text-gray-500">No pipeline data available</p>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'healthy':
      case 'active':
      case 'success':
        return 'text-green-600'
      case 'degraded':
      case 'warning':
        return 'text-yellow-600'
      case 'disconnected':
      case 'error':
      case 'failed':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'healthy':
      case 'active':
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'degraded':
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
      case 'disconnected':
      case 'error':
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'running':
        return <Activity className="w-5 h-5 text-blue-500 animate-pulse" />
      default:
        return <Clock className="w-5 h-5 text-gray-500" />
    }
  }

  const formatDuration = (minutes?: number) => {
    if (!minutes) return ''
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const calculateTimeUntil = (dateStr: string | null) => {
    if (!dateStr) return null
    const target = new Date(dateStr)
    const now = new Date()
    const diffMs = target.getTime() - now.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    
    if (diffMinutes < 0) return 'overdue'
    if (diffMinutes < 60) return `in ${diffMinutes} minutes`
    
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `in ${diffHours} hours`
    
    const diffDays = Math.floor(diffHours / 24)
    return `in ${diffDays} days`
  }

  return (
    <div className="space-y-6">
      {/* Pipeline Flow Visualization */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Pipeline Flow</h3>
        
        <div className="flex items-center justify-between">
          {/* Source */}
          <div className="flex-1">
            <div className={`border rounded-lg p-4 ${
              pipelineData.source.status === 'connected' ? 'border-green-300' :
              pipelineData.source.status === 'error' ? 'border-red-300' :
              'border-gray-300'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Cloud className="w-5 h-5 text-gray-400" />
                <h4 className="font-medium text-gray-900">{pipelineData.source.name}</h4>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(pipelineData.source.status)}
                <span className={`text-sm capitalize ${getStatusColor(pipelineData.source.status)}`}>
                  {pipelineData.source.status === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {pipelineData.source.details?.dataset && (
                <p className="text-xs text-gray-500 mt-2">{pipelineData.source.details.dataset}</p>
              )}
            </div>
          </div>

          {/* Arrow */}
          <div className="px-4" data-testid="flow-arrow">
            <ArrowRight className="w-6 h-6 text-gray-400" />
          </div>

          {/* Destination */}
          <div className="flex-1">
            <div className={`border rounded-lg p-4 ${
              pipelineData.destination.status === 'healthy' ? 'border-green-300' :
              pipelineData.destination.status === 'error' ? 'border-red-300' :
              'border-yellow-300'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-5 h-5 text-gray-400" />
                <h4 className="font-medium text-gray-900">{pipelineData.destination.name}</h4>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(pipelineData.destination.status)}
                <span className={`text-sm capitalize ${getStatusColor(pipelineData.destination.status)}`}>
                  {pipelineData.destination.status === 'healthy' ? 'Healthy' : 
                   pipelineData.destination.status === 'degraded' ? 'Degraded' : 'Error'}
                </span>
              </div>
              {pipelineData.destination.details?.schema && (
                <p className="text-xs text-gray-500 mt-2">Schema: {pipelineData.destination.details.schema}</p>
              )}
            </div>
          </div>
        </div>

        {/* Pipeline Stages */}
        <div className="mt-6 space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Pipeline Stages</h4>
          {pipelineData.flow.stages.map((stage, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">{stage.name}</span>
                  <span className={`text-xs ${
                    stage.status === 'active' ? 'text-green-600' :
                    stage.status === 'warning' ? 'text-yellow-600' :
                    stage.status === 'error' ? 'text-red-600' :
                    'text-gray-500'
                  }`}>
                    {stage.message || stage.status}
                  </span>
                </div>
                {stage.progress !== undefined && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        stage.status === 'active' ? 'bg-green-500' :
                        stage.status === 'warning' ? 'bg-yellow-500' :
                        stage.status === 'error' ? 'bg-red-500' :
                        'bg-gray-400'
                      }`}
                      style={{ width: `${stage.progress}%` }}
                      role="progressbar"
                      aria-valuenow={stage.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Next Sync */}
        {pipelineData.pipeline.nextSync && (
          <div className="mt-4 p-3 bg-blue-50 rounded-md">
            <p className="text-sm text-blue-800">
              <Clock className="inline w-4 h-4 mr-1" />
              Next sync {calculateTimeUntil(pipelineData.pipeline.nextSync)}
            </p>
          </div>
        )}

        {/* Pipeline Status */}
        {pipelineData.pipeline.status !== 'active' && (
          <div className={`mt-4 p-3 rounded-md ${
            pipelineData.pipeline.status === 'inactive' ? 'bg-gray-50' : 'bg-red-50'
          }`}>
            <p className={`text-sm ${
              pipelineData.pipeline.status === 'inactive' ? 'text-gray-800' : 'text-red-800'
            }`}>
              Pipeline {pipelineData.pipeline.status === 'inactive' ? 'Inactive' : 'Error'}
            </p>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        
        {pipelineData.pipeline.recentSyncs.length > 0 ? (
          <div className="space-y-2">
            {pipelineData.pipeline.recentSyncs.map(sync => (
              <div 
                key={sync.id} 
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
              >
                <div className="flex items-center gap-3 flex-1">
                  <Activity className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{sync.table}</p>
                    <p className="text-xs text-gray-500">
                      Started at {new Date(sync.startedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {sync.recordsProcessed && sync.recordsProcessed > 0 && (
                    <span className="text-sm text-gray-600">
                      {sync.recordsProcessed.toLocaleString()} records
                    </span>
                  )}
                  {sync.duration && (
                    <span className="text-sm text-gray-500">
                      {formatDuration(sync.duration)}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    {getStatusIcon(sync.status)}
                    <span className={`text-sm capitalize ${getStatusColor(sync.status)}`}>
                      {sync.status === 'success' ? 'Success' :
                       sync.status === 'failed' ? 'Failed' :
                       'Running'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">
            No recent sync activity
          </p>
        )}
      </div>
    </div>
  )
}