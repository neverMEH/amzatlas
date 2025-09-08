'use client'

import React from 'react'

interface DataDebuggerProps {
  data: any
  isLoading: boolean
  error: any
  title: string
}

export function DataDebugger({ data, isLoading, error, title }: DataDebuggerProps) {
  return (
    <div className="bg-gray-100 p-4 rounded-lg mb-4">
      <h3 className="font-bold mb-2">{title} Debug Info:</h3>
      
      <div className="space-y-2 text-sm">
        <div>
          <span className="font-semibold">Loading:</span> {isLoading ? 'Yes' : 'No'}
        </div>
        
        <div>
          <span className="font-semibold">Error:</span> {error ? error.message || 'Unknown error' : 'None'}
        </div>
        
        <div>
          <span className="font-semibold">Data exists:</span> {data ? 'Yes' : 'No'}
        </div>
        
        {data && (
          <>
            <div>
              <span className="font-semibold">Data type:</span> {typeof data}
            </div>
            
            <div>
              <span className="font-semibold">Data keys:</span> {Object.keys(data).join(', ')}
            </div>
            
            {data.timeSeries && (
              <div>
                <span className="font-semibold">Time series length:</span> {data.timeSeries.length}
              </div>
            )}
            
            {data.metrics && (
              <div>
                <span className="font-semibold">Metrics totals:</span> 
                {JSON.stringify(data.metrics.totals)}
              </div>
            )}
            
            <details className="mt-2">
              <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                Full data (click to expand)
              </summary>
              <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto max-h-96">
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
          </>
        )}
      </div>
    </div>
  )
}