'use client'

import { useState } from 'react'
import { ASINSelector } from '@/components/asin-performance/ASINSelector'
import { DateRangePickerV2 } from '@/components/asin-performance/DateRangePickerV2'
import { MetricsCards } from '@/components/asin-performance/MetricsCards'
import { PerformanceChart } from '@/components/asin-performance/PerformanceChart'
import { FunnelChart } from '@/components/asin-performance/FunnelChart'
import { SearchQueryTable } from '@/components/asin-performance/SearchQueryTable'
import { useASINPerformance } from '@/lib/api/asin-performance'

export default function Dashboard() {
  const [selectedASIN, setSelectedASIN] = useState<string>('')
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  })
  const [compareRange, setCompareRange] = useState({
    startDate: '',
    endDate: '',
    enabled: false,
  })

  // Fetch performance data
  const { data, isLoading, error } = useASINPerformance(
    selectedASIN,
    dateRange.startDate,
    dateRange.endDate,
    compareRange.enabled ? compareRange.startDate : undefined,
    compareRange.enabled ? compareRange.endDate : undefined
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">ASIN Performance Dashboard</h1>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                {selectedASIN ? `Selected: ${selectedASIN}` : 'No ASIN selected'}
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="max-w-xl">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select ASIN
              </label>
              <ASINSelector value={selectedASIN} onChange={setSelectedASIN} />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <DateRangePickerV2
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
                onChange={setDateRange}
                showComparison={true}
                compareStartDate={compareRange.startDate}
                compareEndDate={compareRange.endDate}
                onCompareChange={setCompareRange}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1920px] mx-auto px-6 py-8">
        {!selectedASIN ? (
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <div className="text-center">
              <svg
                className="mx-auto h-24 w-24 text-gray-400 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No ASIN Selected</h3>
              <p className="text-gray-500 mb-6">
                Select an ASIN from the dropdown above to view performance metrics
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Metrics cards */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Performance Indicators</h2>
              <MetricsCards
                data={data?.metrics}
                comparisonData={data?.comparison}
                isLoading={isLoading}
                error={error as Error | null}
              />
            </section>

            {/* Performance charts */}
            <section>
              <PerformanceChart
                data={data?.timeSeries || []}
                comparisonData={compareRange.enabled ? data?.comparisonTimeSeries : undefined}
                isLoading={isLoading}
                error={error as Error | null}
              />
            </section>

            {/* Conversion funnel */}
            <section>
              <FunnelChart
                data={data?.metrics?.totals || null}
                comparisonData={compareRange.enabled && data?.comparison ? data.comparison.metrics.totals : null}
                isLoading={isLoading}
                error={error as Error | null}
              />
            </section>

            {/* Search query table */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Search Query Performance</h2>
              <SearchQueryTable
                data={data?.topQueries || []}
                comparisonData={compareRange.enabled && data?.topQueriesComparison ? data.topQueriesComparison : undefined}
                isLoading={isLoading}
                error={error as Error | null}
              />
            </section>
          </div>
        )}
      </main>
    </div>
  )
}