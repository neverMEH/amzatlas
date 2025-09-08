'use client'

import { useState } from 'react'

export default function TestAPIPage() {
  const [asin, setAsin] = useState('')
  const [startDate, setStartDate] = useState('2025-08-25')
  const [endDate, setEndDate] = useState('2025-08-31')
  const [response, setResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const testAPI = async () => {
    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const params = new URLSearchParams({
        asin,
        startDate,
        endDate,
        includeQueries: 'true',
      })

      const res = await fetch(`/api/dashboard/v2/asin-overview?${params.toString()}`)
      const data = await res.json()

      if (!res.ok) {
        setError(`API Error: ${data.error || 'Unknown error'}`)
      } else {
        setResponse(data)
      }
    } catch (err) {
      setError(`Network Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Test ASIN Overview API</h1>
      
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">ASIN</label>
          <input
            type="text"
            value={asin}
            onChange={(e) => setAsin(e.target.value)}
            placeholder="Enter ASIN (e.g., B00XBC3KQ8)"
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>
        
        <button
          onClick={testAPI}
          disabled={!asin || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test API'}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <h3 className="font-semibold text-red-800">Error</h3>
          <p className="text-red-600">{error}</p>
        </div>
      )}
      
      {response && (
        <div className="bg-gray-50 rounded-md p-4">
          <h3 className="font-semibold mb-2">API Response</h3>
          
          <div className="space-y-2 text-sm mb-4">
            <div><strong>ASIN:</strong> {response.asin}</div>
            <div><strong>Product:</strong> {response.productTitle}</div>
            <div><strong>Date Range:</strong> {response.dateRange?.start} to {response.dateRange?.end}</div>
            <div><strong>Time Series Records:</strong> {response.timeSeries?.length || 0}</div>
            <div><strong>Top Queries:</strong> {response.topQueries?.length || 0}</div>
            
            {response.metrics && (
              <div>
                <strong>Metrics Totals:</strong>
                <ul className="ml-4">
                  <li>Impressions: {response.metrics.totals.impressions}</li>
                  <li>Clicks: {response.metrics.totals.clicks}</li>
                  <li>Purchases: {response.metrics.totals.purchases}</li>
                </ul>
              </div>
            )}
          </div>
          
          <details>
            <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
              View Full Response
            </summary>
            <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto max-h-96">
              {JSON.stringify(response, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}