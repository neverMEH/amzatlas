'use client'

import { useState, useEffect } from 'react'
import { 
  AlertTriangle, TrendingUp, TrendingDown, Activity, 
  Info, X, ChevronRight, Filter, Bell, BellOff 
} from 'lucide-react'

interface AnomalyDetectionAlertsProps {
  brandId: string | null
  onAlertClick?: (anomaly: Anomaly) => void
}

interface Anomaly {
  id: string
  asin: string
  keyword: string
  brand_name?: string
  product_title?: string
  metric: string
  anomaly_type: 'spike' | 'drop' | 'unusual_pattern'
  severity: 'high' | 'medium' | 'low'
  detected_at: string
  week_date: string
  current_value: number
  expected_value: number
  deviation_percent: number
  z_score: number
  is_resolved: boolean
  notes?: string
}

interface AnomalySummary {
  total_anomalies: number
  high_severity: number
  medium_severity: number
  low_severity: number
  spike_count: number
  drop_count: number
  pattern_count: number
  most_affected_brand?: string
  most_affected_metric?: string
}

interface AlertSettings {
  showResolved: boolean
  severityFilter: string[]
  typeFilter: string[]
  metricFilter: string[]
}

const SEVERITY_COLORS = {
  high: 'red',
  medium: 'yellow',
  low: 'blue'
}

const ANOMALY_TYPE_ICONS = {
  spike: TrendingUp,
  drop: TrendingDown,
  unusual_pattern: Activity
}

const METRIC_LABELS: Record<string, string> = {
  impressions: 'Impressions',
  clicks: 'Clicks',
  purchases: 'Purchases',
  cvr: 'Conversion Rate',
  ctr: 'Click-Through Rate',
  revenue: 'Revenue'
}

export default function AnomalyDetectionAlerts({
  brandId,
  onAlertClick
}: AnomalyDetectionAlertsProps) {
  const [loading, setLoading] = useState(true)
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [summary, setSummary] = useState<AnomalySummary | null>(null)
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null)
  const [settings, setSettings] = useState<AlertSettings>({
    showResolved: false,
    severityFilter: ['high', 'medium'],
    typeFilter: ['spike', 'drop', 'unusual_pattern'],
    metricFilter: Object.keys(METRIC_LABELS)
  })
  const [showSettings, setShowSettings] = useState(false)
  const [mutedAlerts, setMutedAlerts] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchAnomalies()
  }, [brandId])

  const fetchAnomalies = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (brandId) params.append('brandId', brandId)

      // Fetch anomalies
      const response = await fetch(`/api/anomalies?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setAnomalies(data.anomalies)
      }

      // Fetch summary
      const summaryResponse = await fetch(`/api/anomalies/summary?${params}`)
      const summaryData = await summaryResponse.json()
      
      if (summaryData.success) {
        setSummary(summaryData.summary)
      }
    } catch (error) {
      console.error('Error fetching anomalies:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResolve = async (anomalyId: string) => {
    try {
      const response = await fetch(`/api/anomalies/${anomalyId}/resolve`, {
        method: 'PUT'
      })
      
      if (response.ok) {
        setAnomalies(prev => 
          prev.map(a => a.id === anomalyId ? { ...a, is_resolved: true } : a)
        )
      }
    } catch (error) {
      console.error('Error resolving anomaly:', error)
    }
  }

  const toggleMute = (anomalyId: string) => {
    const newMuted = new Set(mutedAlerts)
    if (newMuted.has(anomalyId)) {
      newMuted.delete(anomalyId)
    } else {
      newMuted.add(anomalyId)
    }
    setMutedAlerts(newMuted)
  }

  const filteredAnomalies = anomalies.filter(anomaly => {
    if (!settings.showResolved && anomaly.is_resolved) return false
    if (!settings.severityFilter.includes(anomaly.severity)) return false
    if (!settings.typeFilter.includes(anomaly.anomaly_type)) return false
    if (!settings.metricFilter.includes(anomaly.metric)) return false
    return true
  })

  const formatMetricValue = (value: number, metric: string) => {
    if (metric === 'cvr' || metric === 'ctr') {
      return `${value.toFixed(2)}%`
    }
    if (metric === 'revenue') {
      return `$${(value / 1000).toFixed(1)}K`
    }
    return value.toLocaleString()
  }

  const renderSummaryCard = () => {
    if (!summary) return null

    return (
      <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Anomaly Detection Summary
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {summary.total_anomalies} anomalies detected across all metrics
            </p>
          </div>
          <AlertTriangle className="w-6 h-6 text-orange-500" />
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-white rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">High Severity</span>
              <span className="text-2xl font-bold text-red-600">
                {summary.high_severity}
              </span>
            </div>
          </div>
          <div className="bg-white rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Medium</span>
              <span className="text-2xl font-bold text-yellow-600">
                {summary.medium_severity}
              </span>
            </div>
          </div>
          <div className="bg-white rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Low</span>
              <span className="text-2xl font-bold text-blue-600">
                {summary.low_severity}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Most Affected Brand:</span>
            <span className="ml-2 font-medium text-gray-900">
              {summary.most_affected_brand || 'N/A'}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Most Affected Metric:</span>
            <span className="ml-2 font-medium text-gray-900">
              {summary.most_affected_metric ? 
                METRIC_LABELS[summary.most_affected_metric] : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    )
  }

  const renderAlert = (anomaly: Anomaly) => {
    const Icon = ANOMALY_TYPE_ICONS[anomaly.anomaly_type]
    const severityColor = SEVERITY_COLORS[anomaly.severity]
    const isExpanded = expandedAlert === anomaly.id
    const isMuted = mutedAlerts.has(anomaly.id)

    return (
      <div
        key={anomaly.id}
        className={`
          bg-white rounded-lg shadow-sm border p-4 transition-all
          ${anomaly.is_resolved ? 'opacity-60' : ''}
          ${isMuted ? 'opacity-40' : ''}
          ${isExpanded ? 'border-gray-300' : 'border-gray-200'}
        `}
      >
        <div 
          className="flex items-start justify-between cursor-pointer"
          onClick={() => setExpandedAlert(isExpanded ? null : anomaly.id)}
        >
          <div className="flex items-start gap-3">
            <div className={`
              p-2 rounded-lg
              bg-${severityColor}-50
            `}>
              <Icon className={`w-4 h-4 text-${severityColor}-600`} />
            </div>
            
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`
                  text-xs font-medium px-2 py-1 rounded-full
                  bg-${severityColor}-100 text-${severityColor}-700
                `}>
                  {anomaly.severity.toUpperCase()}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(anomaly.detected_at).toLocaleString()}
                </span>
                {anomaly.is_resolved && (
                  <span className="text-xs font-medium text-green-600">
                    RESOLVED
                  </span>
                )}
              </div>
              
              <h4 className="font-medium text-gray-900">
                {METRIC_LABELS[anomaly.metric]} {
                  anomaly.anomaly_type === 'spike' ? 'Spike' :
                  anomaly.anomaly_type === 'drop' ? 'Drop' :
                  'Unusual Pattern'
                }
              </h4>
              
              <p className="text-sm text-gray-600 mt-1">
                {anomaly.keyword} - {anomaly.product_title || anomaly.asin}
              </p>
              
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="text-gray-600">
                  Current: <span className="font-medium text-gray-900">
                    {formatMetricValue(anomaly.current_value, anomaly.metric)}
                  </span>
                </span>
                <span className="text-gray-600">
                  Expected: <span className="font-medium text-gray-900">
                    {formatMetricValue(anomaly.expected_value, anomaly.metric)}
                  </span>
                </span>
                <span className={`font-medium ${
                  anomaly.deviation_percent > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {anomaly.deviation_percent > 0 ? '+' : ''}
                  {anomaly.deviation_percent.toFixed(1)}% deviation
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleMute(anomaly.id)
              }}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title={isMuted ? 'Unmute alert' : 'Mute alert'}
            >
              {isMuted ? (
                <BellOff className="w-4 h-4 text-gray-400" />
              ) : (
                <Bell className="w-4 h-4 text-gray-400" />
              )}
            </button>
            <ChevronRight className={`
              w-4 h-4 text-gray-400 transition-transform
              ${isExpanded ? 'rotate-90' : ''}
            `} />
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <span className="text-gray-600">Z-Score:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {anomaly.z_score.toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Week:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {anomaly.week_date}
                </span>
              </div>
              {anomaly.brand_name && (
                <div>
                  <span className="text-gray-600">Brand:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {anomaly.brand_name}
                  </span>
                </div>
              )}
            </div>

            {anomaly.notes && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">{anomaly.notes}</p>
              </div>
            )}

            <div className="flex gap-2">
              {!anomaly.is_resolved && (
                <button
                  onClick={() => handleResolve(anomaly.id)}
                  className="px-3 py-1 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  Mark Resolved
                </button>
              )}
              {onAlertClick && (
                <button
                  onClick={() => onAlertClick(anomaly)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View Details
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderSettings = () => {
    return (
      <div className="absolute right-0 top-12 w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">Alert Settings</h3>
          <button
            onClick={() => setShowSettings(false)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.showResolved}
                onChange={(e) => setSettings({
                  ...settings,
                  showResolved: e.target.checked
                })}
                className="rounded text-blue-600"
              />
              <span className="text-sm text-gray-700">Show resolved alerts</span>
            </label>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Severity</h4>
            <div className="space-y-1">
              {['high', 'medium', 'low'].map(severity => (
                <label key={severity} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.severityFilter.includes(severity)}
                    onChange={(e) => {
                      const newFilter = e.target.checked
                        ? [...settings.severityFilter, severity]
                        : settings.severityFilter.filter(s => s !== severity)
                      setSettings({ ...settings, severityFilter: newFilter })
                    }}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm text-gray-700 capitalize">{severity}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Type</h4>
            <div className="space-y-1">
              {['spike', 'drop', 'unusual_pattern'].map(type => (
                <label key={type} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.typeFilter.includes(type)}
                    onChange={(e) => {
                      const newFilter = e.target.checked
                        ? [...settings.typeFilter, type]
                        : settings.typeFilter.filter(t => t !== type)
                      setSettings({ ...settings, typeFilter: newFilter })
                    }}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm text-gray-700">
                    {type === 'spike' ? 'Spikes' :
                     type === 'drop' ? 'Drops' : 'Unusual Patterns'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Metrics</h4>
            <div className="space-y-1">
              {Object.entries(METRIC_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.metricFilter.includes(key)}
                    onChange={(e) => {
                      const newFilter = e.target.checked
                        ? [...settings.metricFilter, key]
                        : settings.metricFilter.filter(m => m !== key)
                      setSettings({ ...settings, metricFilter: newFilter })
                    }}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div>
      {renderSummaryCard()}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Anomaly Alerts
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {filteredAnomalies.length} active alerts
              </p>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium">Filter</span>
              </button>
              {showSettings && renderSettings()}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
          {filteredAnomalies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <Info className="w-12 h-12 mb-2" />
              <p>No anomalies match your filter criteria</p>
            </div>
          ) : (
            filteredAnomalies.map(anomaly => renderAlert(anomaly))
          )}
        </div>
      </div>
    </div>
  )
}