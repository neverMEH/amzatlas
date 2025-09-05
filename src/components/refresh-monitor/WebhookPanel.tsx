'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Check, X, AlertCircle, Send, Eye, RefreshCw, CheckCircle, XCircle } from 'lucide-react'

interface Webhook {
  id: number
  name: string
  url: string
  events: string[]
  enabled: boolean
  headers: Record<string, string>
  statistics: {
    total_deliveries_24h: number
    successful_24h: number
    failed_24h: number
    pending_24h: number
    last_delivery: string | null
    last_status: string | null
  }
}

export function WebhookPanel() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    secret: '',
    events: ['refresh.failed'],
    headers: {}
  })
  const [testResults, setTestResults] = useState<Record<number, any>>({})

  useEffect(() => {
    fetchWebhooks()
  }, [])

  const fetchWebhooks = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/refresh/webhooks')
      const data = await response.json()
      setWebhooks(data.webhooks || [])
    } catch (error) {
      console.error('Failed to fetch webhooks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdd = async () => {
    try {
      const response = await fetch('/api/refresh/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        await fetchWebhooks()
        setShowAddForm(false)
        setFormData({
          name: '',
          url: '',
          secret: '',
          events: ['refresh.failed'],
          headers: {}
        })
      } else {
        const error = await response.json()
        alert(`Failed to create webhook: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to create webhook:', error)
      alert('Failed to create webhook')
    }
  }

  const handleUpdate = async (webhook: Webhook) => {
    try {
      const response = await fetch('/api/refresh/webhooks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: webhook.id,
          is_enabled: !webhook.enabled
        })
      })

      if (response.ok) {
        await fetchWebhooks()
      } else {
        const error = await response.json()
        alert(`Failed to update webhook: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to update webhook:', error)
      alert('Failed to update webhook')
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete webhook "${name}"?`)) return

    try {
      const response = await fetch(`/api/refresh/webhooks?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchWebhooks()
      } else {
        const error = await response.json()
        alert(`Failed to delete webhook: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to delete webhook:', error)
      alert('Failed to delete webhook')
    }
  }

  const handleTest = async (webhookId: number) => {
    try {
      const response = await fetch('/api/refresh/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhook_id: webhookId,
          event_type: 'refresh.completed'
        })
      })

      const result = await response.json()
      setTestResults({ ...testResults, [webhookId]: result })

      if (result.success) {
        alert('Webhook test successful!')
      } else {
        alert(`Webhook test failed: ${result.error?.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to test webhook:', error)
      alert('Failed to test webhook')
    }
  }

  const eventTypes = [
    { value: 'refresh.completed', label: 'Refresh Completed', color: 'bg-green-100 text-green-800' },
    { value: 'refresh.failed', label: 'Refresh Failed', color: 'bg-red-100 text-red-800' },
    { value: 'refresh.warning', label: 'Refresh Warning', color: 'bg-yellow-100 text-yellow-800' }
  ]

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading webhooks...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Webhook Notifications</h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Webhook
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Webhook</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Slack Notifications"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://hooks.slack.com/services/..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Secret (optional)</label>
              <input
                type="password"
                value={formData.secret}
                onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Webhook signature secret"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Events</label>
              <div className="space-y-2">
                {eventTypes.map(event => (
                  <label key={event.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.events.includes(event.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, events: [...formData.events, event.value] })
                        } else {
                          setFormData({ ...formData, events: formData.events.filter(ev => ev !== event.value) })
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${event.color}`}>
                      {event.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!formData.name || !formData.url || formData.events.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Webhook
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false)
                  setFormData({
                    name: '',
                    url: '',
                    secret: '',
                    events: ['refresh.failed'],
                    headers: {}
                  })
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Webhooks List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {webhooks.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No webhooks configured. Add one to receive notifications.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Webhook
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Events
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  24h Activity
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {webhooks.map((webhook) => (
                <tr key={webhook.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{webhook.name}</div>
                      <div className="text-xs text-gray-500 truncate max-w-xs">{webhook.url}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {webhook.events.map(event => {
                        const eventType = eventTypes.find(e => e.value === event)
                        return (
                          <span key={event} className={`px-2 py-1 rounded-full text-xs font-medium ${eventType?.color || 'bg-gray-100 text-gray-800'}`}>
                            {eventType?.label || event}
                          </span>
                        )
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleUpdate(webhook)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        webhook.enabled 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {webhook.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        {webhook.statistics.successful_24h}
                        <XCircle className="w-4 h-4 text-red-500 ml-2" />
                        {webhook.statistics.failed_24h}
                        {webhook.statistics.pending_24h > 0 && (
                          <>
                            <RefreshCw className="w-4 h-4 text-blue-500 ml-2" />
                            {webhook.statistics.pending_24h}
                          </>
                        )}
                      </div>
                      {webhook.statistics.last_delivery && (
                        <div className="text-xs text-gray-500 mt-1">
                          Last: {new Date(webhook.statistics.last_delivery).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleTest(webhook.id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Test webhook"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(webhook.id, webhook.name)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete webhook"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Test Results */}
      {Object.keys(testResults).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Results</h3>
          <div className="space-y-4">
            {Object.entries(testResults).map(([webhookId, result]) => (
              <div key={webhookId} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start gap-2">
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{result.webhook_name}</p>
                    <p className="text-sm text-gray-500">{result.webhook_url}</p>
                    {result.response && (
                      <div className="mt-2">
                        <p className="text-sm">
                          Response: {result.response.status} {result.response.statusText} ({result.response.time_ms}ms)
                        </p>
                        {result.response.body && (
                          <pre className="mt-1 text-xs bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                            {result.response.body}
                          </pre>
                        )}
                      </div>
                    )}
                    {result.error && (
                      <p className="mt-2 text-sm text-red-600">
                        Error: {result.error.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}