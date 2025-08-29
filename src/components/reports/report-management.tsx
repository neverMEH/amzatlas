'use client'

import React, { useState, useEffect } from 'react'
import {
  Calendar, Clock, Download, Mail, Plus, Settings, Trash2,
  FileText, CheckCircle, XCircle, AlertTriangle, Play, Pause, Eye
} from 'lucide-react'

interface ReportConfiguration {
  id: string
  name: string
  description?: string
  report_type: string
  frequency: string
  config: Record<string, any>
  filters: Record<string, any>
  schedule_day_of_week?: number
  schedule_time?: string
  schedule_day_of_month?: number
  export_formats: string[]
  include_charts: boolean
  include_raw_data: boolean
  is_active: boolean
  last_run_at?: string
  next_run_at?: string
  report_recipients?: ReportRecipient[]
  latest_execution?: ReportExecution
}

interface ReportRecipient {
  id: string
  email: string
  name?: string
  delivery_method: string
  is_active: boolean
}

interface ReportExecution {
  id: string
  started_at: string
  completed_at?: string
  status: string
  execution_time_ms?: number
}

interface ReportFormData {
  name: string
  description: string
  report_type: string
  frequency: string
  schedule_time: string
  schedule_day_of_week?: number
  schedule_day_of_month?: number
  export_formats: string[]
  include_charts: boolean
  include_raw_data: boolean
  recipients: Array<{ email: string; name: string }>
  filters: {
    brand_id?: string
  }
}

const REPORT_TYPES = [
  { value: 'period_comparison', label: 'Period Comparison' },
  { value: 'keyword_trends', label: 'Keyword Trends' },
  { value: 'market_share_analysis', label: 'Market Share Analysis' },
  { value: 'anomaly_detection', label: 'Anomaly Detection' },
  { value: 'comprehensive_dashboard', label: 'Comprehensive Dashboard' },
  { value: 'custom', label: 'Custom Report' }
]

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'bi_weekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'on_demand', label: 'On Demand' }
]

const DAYS_OF_WEEK = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
]

export default function ReportManagement() {
  const [reports, setReports] = useState<ReportConfiguration[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingReport, setEditingReport] = useState<ReportConfiguration | null>(null)
  const [formData, setFormData] = useState<ReportFormData>({
    name: '',
    description: '',
    report_type: 'comprehensive_dashboard',
    frequency: 'weekly',
    schedule_time: '09:00',
    export_formats: ['pdf'],
    include_charts: true,
    include_raw_data: false,
    recipients: [],
    filters: {}
  })
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    fetchReports()
    fetchBrands()
  }, [])

  const fetchReports = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/reports/configurations')
      const data = await response.json()
      if (data.configurations) {
        setReports(data.configurations)
      }
    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBrands = async () => {
    try {
      const response = await fetch('/api/brands')
      const data = await response.json()
      if (data.brands) {
        setBrands(data.brands)
      }
    } catch (error) {
      console.error('Error fetching brands:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = editingReport 
        ? `/api/reports/configurations/${editingReport.id}`
        : '/api/reports/configurations'
      
      const method = editingReport ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        await fetchReports()
        handleCloseForm()
      } else {
        console.error('Failed to save report')
      }
    } catch (error) {
      console.error('Error saving report:', error)
    }
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingReport(null)
    setFormData({
      name: '',
      description: '',
      report_type: 'comprehensive_dashboard',
      frequency: 'weekly',
      schedule_time: '09:00',
      export_formats: ['pdf'],
      include_charts: true,
      include_raw_data: false,
      recipients: [],
      filters: {}
    })
  }

  const handleEdit = (report: ReportConfiguration) => {
    setEditingReport(report)
    setFormData({
      name: report.name,
      description: report.description || '',
      report_type: report.report_type,
      frequency: report.frequency,
      schedule_time: report.schedule_time || '09:00',
      schedule_day_of_week: report.schedule_day_of_week,
      schedule_day_of_month: report.schedule_day_of_month,
      export_formats: report.export_formats,
      include_charts: report.include_charts,
      include_raw_data: report.include_raw_data,
      recipients: report.report_recipients?.map(r => ({ 
        email: r.email, 
        name: r.name || '' 
      })) || [],
      filters: report.filters || {}
    })
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return

    try {
      const response = await fetch(`/api/reports/configurations/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchReports()
      }
    } catch (error) {
      console.error('Error deleting report:', error)
    }
  }

  const handleToggleActive = async (report: ReportConfiguration) => {
    try {
      const response = await fetch(`/api/reports/configurations/${report.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...report,
          is_active: !report.is_active
        })
      })

      if (response.ok) {
        await fetchReports()
      }
    } catch (error) {
      console.error('Error toggling report status:', error)
    }
  }

  const handleRunNow = async (report: ReportConfiguration) => {
    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          configurationId: report.id
        })
      })

      if (response.ok) {
        alert('Report generation started')
        await fetchReports()
      }
    } catch (error) {
      console.error('Error running report:', error)
    }
  }

  const handleExport = async (report: ReportConfiguration, format: string) => {
    try {
      const response = await fetch(`/api/reports/export/${format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          configurationId: report.id
        })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${report.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.${format}`
        a.click()
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Error exporting report:', error)
    }
  }

  const handleEmailReport = async (report: ReportConfiguration) => {
    try {
      const response = await fetch('/api/reports/delivery/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          configurationId: report.id
        })
      })

      const data = await response.json()
      alert(data.message || 'Email sent')
    } catch (error) {
      console.error('Error emailing report:', error)
    }
  }

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'running':
        return <AlertTriangle className="w-4 h-4 text-yellow-500 animate-pulse" />
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Report Management</h2>
          <p className="text-gray-600 mt-1">Configure and manage automated reports</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Report
        </button>
      </div>

      {/* Report List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Report</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Schedule</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Last Run</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-medium text-gray-900">{report.name}</p>
                      {report.description && (
                        <p className="text-sm text-gray-500">{report.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {report.export_formats.map(format => (
                          <span key={format} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                            {format.toUpperCase()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-sm text-gray-900">
                      {REPORT_TYPES.find(t => t.value === report.report_type)?.label}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-sm">
                      <p className="text-gray-900">{report.frequency}</p>
                      {report.schedule_day_of_week !== undefined && (
                        <p className="text-gray-500">{DAYS_OF_WEEK[report.schedule_day_of_week]}</p>
                      )}
                      {report.schedule_time && (
                        <p className="text-gray-500">{report.schedule_time}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-sm">
                      {report.last_run_at ? (
                        <>
                          <p className="text-gray-900">
                            {new Date(report.last_run_at).toLocaleDateString()}
                          </p>
                          <p className="text-gray-500">
                            {new Date(report.last_run_at).toLocaleTimeString()}
                          </p>
                        </>
                      ) : (
                        <p className="text-gray-500">Never</p>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      {report.latest_execution && renderStatusIcon(report.latest_execution.status)}
                      <span className={`text-sm ${
                        report.is_active ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {report.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(report)}
                        className="p-1 text-gray-500 hover:text-gray-700"
                        title={report.is_active ? 'Pause' : 'Activate'}
                      >
                        {report.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleRunNow(report)}
                        className="p-1 text-gray-500 hover:text-gray-700"
                        title="Run Now"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleExport(report, 'pdf')}
                        className="p-1 text-gray-500 hover:text-gray-700"
                        title="Export PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEmailReport(report)}
                        className="p-1 text-gray-500 hover:text-gray-700"
                        title="Email Report"
                        disabled={!report.report_recipients?.length}
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(report)}
                        className="p-1 text-gray-500 hover:text-gray-700"
                        title="Edit"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(report.id)}
                        className="p-1 text-red-500 hover:text-red-700"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">
                {editingReport ? 'Edit Report' : 'Create New Report'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Report Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Report Type
                    </label>
                    <select
                      value={formData.report_type}
                      onChange={(e) => setFormData({ ...formData, report_type: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {REPORT_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Schedule */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Schedule</h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Frequency
                    </label>
                    <select
                      value={formData.frequency}
                      onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {FREQUENCIES.map(freq => (
                        <option key={freq.value} value={freq.value}>
                          {freq.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formData.frequency === 'weekly' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Day of Week
                      </label>
                      <select
                        value={formData.schedule_day_of_week || 1}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          schedule_day_of_week: parseInt(e.target.value) 
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {DAYS_OF_WEEK.map((day, index) => (
                          <option key={index} value={index}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.frequency !== 'on_demand' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Time
                      </label>
                      <input
                        type="time"
                        value={formData.schedule_time}
                        onChange={(e) => setFormData({ ...formData, schedule_time: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>

                {/* Export Options */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Export Options</h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Export Formats
                    </label>
                    <div className="space-y-2">
                      {['pdf', 'csv', 'xlsx'].map(format => (
                        <label key={format} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.export_formats.includes(format)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  export_formats: [...formData.export_formats, format]
                                })
                              } else {
                                setFormData({
                                  ...formData,
                                  export_formats: formData.export_formats.filter(f => f !== format)
                                })
                              }
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm">{format.toUpperCase()}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.include_charts}
                      onChange={(e) => setFormData({ ...formData, include_charts: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm">Include Charts</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.include_raw_data}
                      onChange={(e) => setFormData({ ...formData, include_raw_data: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm">Include Raw Data</span>
                  </label>
                </div>

                {/* Filters */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Filters</h4>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Brand
                    </label>
                    <select
                      value={formData.filters.brand_id || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        filters: { ...formData.filters, brand_id: e.target.value || undefined }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Brands</option>
                      {brands.map(brand => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Recipients */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Email Recipients</h4>
                  
                  {formData.recipients.map((recipient, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="email"
                        placeholder="Email"
                        value={recipient.email}
                        onChange={(e) => {
                          const newRecipients = [...formData.recipients]
                          newRecipients[index].email = e.target.value
                          setFormData({ ...formData, recipients: newRecipients })
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Name (optional)"
                        value={recipient.name}
                        onChange={(e) => {
                          const newRecipients = [...formData.recipients]
                          newRecipients[index].name = e.target.value
                          setFormData({ ...formData, recipients: newRecipients })
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newRecipients = formData.recipients.filter((_, i) => i !== index)
                          setFormData({ ...formData, recipients: newRecipients })
                        }}
                        className="p-2 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        recipients: [...formData.recipients, { email: '', name: '' }]
                      })
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Add Recipient
                  </button>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-6 border-t">
                  <button
                    type="button"
                    onClick={handleCloseForm}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {editingReport ? 'Update' : 'Create'} Report
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}