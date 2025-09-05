'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'

export function RefreshMetricsChart() {
  const [metrics, setMetrics] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDays, setSelectedDays] = useState(7)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMetrics()
  }, [selectedDays])

  const fetchMetrics = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/refresh/metrics?days=${selectedDays}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
      
      // Validate data structure
      if (data.error) {
        throw new Error(data.error)
      }
      
      setMetrics(data)
    } catch (error) {
      console.error('Failed to fetch metrics:', error)
      setError(error instanceof Error ? error.message : 'Failed to load metrics')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading metrics...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-red-500">Error: {error}</div>
        </div>
      </div>
    )
  }

  if (!metrics || !metrics.summary) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">No metrics data available</div>
        </div>
      </div>
    )
  }

  const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#6B7280']
  
  // Safe property access with defaults
  const summary = metrics.summary || {}
  const successful = summary.successful || 0
  const failed = summary.failed || 0
  const totalRefreshes = summary.total_refreshes || 0
  const successRate = summary.overall_success_rate || 0
  const avgTime = summary.average_refresh_time_minutes || 0
  const totalRows = summary.total_rows_processed || 0
  
  const statusBreakdown = [
    { name: 'Success', value: successful, color: '#10B981' },
    { name: 'Failed', value: failed, color: '#EF4444' },
    { name: 'Other', value: Math.max(0, totalRefreshes - successful - failed), color: '#6B7280' }
  ].filter(item => item.value > 0)

  const topTables = metrics.table_metrics?.slice(0, 5) || []
  const dailyMetrics = metrics.daily_metrics || []

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Success Rate</p>
              <p className="text-2xl font-semibold text-gray-900">
                {successRate.toFixed(1)}%
              </p>
            </div>
            <div className={`p-2 rounded-full ${successRate >= 95 ? 'bg-green-100' : 'bg-yellow-100'}`}>
              {successRate >= 95 ? 
                <TrendingUp className="w-5 h-5 text-green-600" /> : 
                <TrendingDown className="w-5 h-5 text-yellow-600" />
              }
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Refreshes</p>
              <p className="text-2xl font-semibold text-gray-900">
                {totalRefreshes}
              </p>
            </div>
            <div className="p-2 rounded-full bg-blue-100">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Avg Duration</p>
              <p className="text-2xl font-semibold text-gray-900">
                {avgTime.toFixed(1)}m
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Rows Processed</p>
              <p className="text-2xl font-semibold text-gray-900">
                {(totalRows / 1000000).toFixed(1)}M
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Trends */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Daily Refresh Trends</h3>
            <select
              value={selectedDays}
              onChange={(e) => setSelectedDays(Number(e.target.value))}
              className="text-sm border border-gray-300 rounded-md px-3 py-1"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyMetrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="successful" stroke="#10B981" name="Successful" strokeWidth={2} />
              <Line type="monotone" dataKey="failed" stroke="#EF4444" name="Failed" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Status Breakdown */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Tables by Volume */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Tables by Volume</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topTables} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="table_name" type="category" width={150} />
              <Tooltip />
              <Bar dataKey="total_rows_processed" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Success Rates by Table */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Success Rates by Table</h3>
          <div className="space-y-3">
            {topTables.map((table: any) => (
              <div key={table.table_name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">{table.table_name}</span>
                  <span className="text-sm font-medium text-gray-900">{table.success_rate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      table.success_rate >= 95 ? 'bg-green-500' : 
                      table.success_rate >= 80 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${table.success_rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}