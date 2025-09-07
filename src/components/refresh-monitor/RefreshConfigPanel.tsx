'use client'

import { useState, useEffect } from 'react'
import { Save, RefreshCw, Clock, Zap, Shield, Edit2, X, Check } from 'lucide-react'

export function RefreshConfigPanel() {
  const [configurations, setConfigurations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [triggerLoading, setTriggerLoading] = useState<number | null>(null)

  useEffect(() => {
    fetchConfigurations()
  }, [])

  const fetchConfigurations = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/refresh/config')
      const data = await response.json()
      setConfigurations(data.configurations || [])
    } catch (error) {
      console.error('Failed to fetch configurations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (config: any) => {
    setEditingId(config.id)
    setEditForm({
      enabled: config.enabled,
      frequency_hours: config.frequency_hours,
      priority: config.priority
    })
  }

  const handleSave = async (id: number) => {
    try {
      const response = await fetch('/api/refresh/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          is_enabled: editForm.enabled,
          refresh_frequency_hours: editForm.frequency_hours,
          priority: editForm.priority
        })
      })

      if (response.ok) {
        await fetchConfigurations()
        setEditingId(null)
        setEditForm({})
      } else {
        const error = await response.json()
        alert(`Failed to update: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to update configuration:', error)
      alert('Failed to update configuration')
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setEditForm({})
  }

  const handleTrigger = async (tableName: string, id: number) => {
    if (!confirm(`Trigger refresh for ${tableName}?`)) return
    
    setTriggerLoading(id)
    try {
      const response = await fetch('/api/refresh/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_name: tableName, force: true })
      })

      const result = await response.json()
      
      if (response.ok) {
        alert(`Refresh triggered successfully for ${tableName}`)
      } else {
        alert(`Failed to trigger refresh: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to trigger refresh:', error)
      alert('Failed to trigger refresh')
    } finally {
      setTriggerLoading(null)
    }
  }

  const triggerFullRefresh = async () => {
    if (!confirm('Trigger refresh for ALL enabled tables?')) return
    
    try {
      const response = await fetch('/api/refresh/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      const result = await response.json()
      
      if (response.ok) {
        alert('Full refresh triggered successfully')
      } else {
        alert(`Failed to trigger full refresh: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to trigger full refresh:', error)
      alert('Failed to trigger full refresh')
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading configurations...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Table Configuration</h2>
          <button
            onClick={triggerFullRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Trigger Full Refresh
          </button>
        </div>
      </div>

      {/* Configuration Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Table
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Frequency
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Refresh
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Next Refresh
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {configurations.map((config) => (
              <tr key={config.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Shield className="w-4 h-4 text-gray-400 mr-2" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{config.table_name}</div>
                      <div className="text-xs text-gray-500">{config.table_schema}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === config.id ? (
                    <select
                      value={editForm.enabled}
                      onChange={(e) => setEditForm({ ...editForm, enabled: e.target.value === 'true' })}
                      className="text-sm border border-gray-300 rounded px-2 py-1"
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  ) : (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      config.enabled 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {config.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === config.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editForm.frequency_hours}
                        onChange={(e) => setEditForm({ ...editForm, frequency_hours: parseInt(e.target.value) })}
                        className="text-sm border border-gray-300 rounded px-2 py-1 w-16"
                        min="1"
                        max="168"
                      />
                      <span className="text-sm text-gray-500">hours</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-sm text-gray-900">
                      <Clock className="w-4 h-4 text-gray-400 mr-1" />
                      {config.frequency_hours}h
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {editingId === config.id ? (
                    <input
                      type="number"
                      value={editForm.priority}
                      onChange={(e) => setEditForm({ ...editForm, priority: parseInt(e.target.value) })}
                      className="text-sm border border-gray-300 rounded px-2 py-1 w-20"
                      min="0"
                      max="1000"
                    />
                  ) : (
                    <div className="flex items-center text-sm text-gray-900">
                      <Zap className="w-4 h-4 text-gray-400 mr-1" />
                      {config.priority}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {config.last_refresh 
                    ? new Date(config.last_refresh).toLocaleString()
                    : 'Never'
                  }
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {config.next_refresh
                    ? new Date(config.next_refresh).toLocaleString()
                    : 'Not scheduled'
                  }
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {editingId === config.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleSave(config.id)}
                        className="text-green-600 hover:text-green-900"
                        title="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleCancel}
                        className="text-red-600 hover:text-red-900"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(config)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleTrigger(config.table_name, config.id)}
                        disabled={!config.enabled || triggerLoading === config.id}
                        className="text-blue-600 hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Trigger Refresh"
                      >
                        {triggerLoading === config.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}