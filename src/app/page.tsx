'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ASINSelector } from '@/components/asin-performance/ASINSelector'
import { DateRangePickerV2 } from '@/components/asin-performance/DateRangePickerV2'
import { MetricsCards } from '@/components/asin-performance/MetricsCards'
import { PerformanceChart } from '@/components/asin-performance/PerformanceChart'
import { FunnelChart } from '@/components/asin-performance/FunnelChart'
import { SearchQueryTable, SearchQueryData } from '@/components/asin-performance/SearchQueryTable'
import { KeywordAnalysisModal } from '@/components/asin-performance/KeywordAnalysisModal'
import { useASINPerformance } from '@/lib/api/asin-performance'
import { DataDebugger } from '@/components/debug/DataDebugger'

export default function Dashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedASIN, setSelectedASIN] = useState<string>('')
  
  // Check for ASIN in URL params on mount
  useEffect(() => {
    const asinParam = searchParams.get('asin')
    if (asinParam && !selectedASIN) {
      setSelectedASIN(asinParam)
    }
  }, [searchParams, selectedASIN])
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  })
  
  // Initialize date range after component mounts to avoid hydration issues
  useEffect(() => {
    if (!dateRange.startDate && !dateRange.endDate) {
      const today = new Date()
      const dayOfWeek = today.getDay()
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - dayOfWeek) // Sunday
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6) // Saturday
      
      setDateRange({
        startDate: startOfWeek.toISOString().split('T')[0],
        endDate: endOfWeek.toISOString().split('T')[0],
      })
    }
  }, [])
  const [compareRange, setCompareRange] = useState({
    startDate: '',
    endDate: '',
    enabled: false,
  })
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null)
  const [keywordModalOpen, setKeywordModalOpen] = useState(false)
  const [hasManualDateSelection, setHasManualDateSelection] = useState(false)

  // Fetch performance data
  const { data, isLoading, error } = useASINPerformance(
    selectedASIN,
    dateRange.startDate,
    dateRange.endDate,
    compareRange.enabled ? compareRange.startDate : undefined,
    compareRange.enabled ? compareRange.endDate : undefined
  )

  const handleKeywordClick = (keyword: string, rowData?: SearchQueryData) => {
    setSelectedKeyword(keyword)
    setKeywordModalOpen(true)
  }

  const handleCloseModal = () => {
    setKeywordModalOpen(false)
    // Keep the keyword selected for a moment to prevent flicker
    setTimeout(() => setSelectedKeyword(null), 300)
  }

  const handleExpandModal = () => {
    if (!selectedKeyword || !selectedASIN) return
    
    // Build URL parameters
    const params = new URLSearchParams({
      asin: selectedASIN,
      keyword: selectedKeyword,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    })
    
    if (compareRange.enabled && compareRange.startDate && compareRange.endDate) {
      params.append('compareStartDate', compareRange.startDate)
      params.append('compareEndDate', compareRange.endDate)
    }
    
    // Navigate to keyword analysis page
    router.push(`/keyword-analysis?${params.toString()}`)
    
    // Close modal
    setKeywordModalOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <div className="bg-gray-900 text-white">
        <div className="max-w-[1920px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <h2 className="text-lg font-semibold">SQP Intelligence</h2>
              <nav className="flex items-center space-x-4">
                <a href="/" className="text-sm hover:text-gray-300">ASIN Performance</a>
                <span className="text-gray-500">|</span>
                <a href="/brands" className="text-sm hover:text-gray-300">Brand Dashboard</a>
                <span className="text-gray-500">|</span>
                <a href="/refresh-monitor" className="text-sm hover:text-gray-300">Refresh Monitor</a>
              </nav>
            </div>
          </div>
        </div>
      </div>
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-12 z-10">
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
              <ASINSelector value={selectedASIN} onChange={(asin) => {
                setSelectedASIN(asin)
                // Reset manual selection flag when ASIN changes
                setHasManualDateSelection(false)
              }} />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <DateRangePickerV2
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
                onChange={(range) => {
                  setDateRange(range)
                  // Mark as manual selection when user changes date
                  setHasManualDateSelection(true)
                }}
                showComparison={true}
                compareStartDate={compareRange.startDate}
                compareEndDate={compareRange.endDate}
                onCompareChange={setCompareRange}
                asin={selectedASIN}
                hasManualSelection={hasManualDateSelection}
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
            {/* Debug component - REMOVE THIS IN PRODUCTION */}
            <DataDebugger 
              data={data} 
              isLoading={isLoading} 
              error={error} 
              title="ASIN Performance API Response"
            />
            
            {/* Metrics cards */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Performance Indicators</h2>
              <MetricsCards
                data={data?.metrics}
                comparisonData={data?.comparison}
                dateRange={data?.dateRange}
                comparisonDateRange={data?.comparisonDateRange}
                isLoading={isLoading}
                error={error as Error | null}
              />
            </section>

            {/* Performance charts */}
            <section>
              <PerformanceChart
                data={data?.timeSeries || []}
                comparisonData={compareRange.enabled ? data?.comparisonTimeSeries : undefined}
                dateRange={data?.dateRange}
                comparisonDateRange={data?.comparisonDateRange}
                isLoading={isLoading}
                error={error as Error | null}
                // Let the chart auto-detect based on data length - no explicit chartType needed
              />
            </section>

            {/* Conversion funnel */}
            <section>
              <FunnelChart
                data={data?.metrics?.totals || null}
                comparisonData={compareRange.enabled && data?.comparison ? data.comparison.metrics.totals : null}
                dateRange={data?.dateRange}
                comparisonDateRange={data?.comparisonDateRange}
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
                dateRange={data?.dateRange}
                comparisonDateRange={data?.comparisonDateRange}
                isLoading={isLoading}
                error={error as Error | null}
                onKeywordClick={handleKeywordClick}
              />
            </section>
          </div>
        )}
      </main>

      {/* Keyword Analysis Modal */}
      {selectedKeyword && (
        <KeywordAnalysisModal
          isOpen={keywordModalOpen}
          onClose={handleCloseModal}
          onExpand={handleExpandModal}
          keyword={selectedKeyword}
          asin={selectedASIN}
          dateRange={{
            start: dateRange.startDate,
            end: dateRange.endDate,
          }}
          comparisonDateRange={compareRange.enabled ? {
            start: compareRange.startDate,
            end: compareRange.endDate,
          } : undefined}
        />
      )}
    </div>
  )
}