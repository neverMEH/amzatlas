'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { ArrowLeft, Download, BarChart2, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { DateRangePickerV2 } from '@/components/asin-performance/DateRangePickerV2'
import { KeywordPerformanceChart } from '@/components/asin-performance/KeywordPerformanceChart'
import { KeywordFunnelChart } from '@/components/asin-performance/KeywordFunnelChart'
import { KeywordMarketShare } from '@/components/asin-performance/KeywordMarketShare'
import { MultiKeywordSelector } from '@/components/asin-performance/MultiKeywordSelector'
import { KeywordComparisonView } from '@/components/asin-performance/KeywordComparisonView'
import { Breadcrumb } from '@/components/asin-performance/Breadcrumb'
import { useKeywordPerformance, useKeywordComparison } from '@/lib/api/keyword-analysis'

type ViewMode = 'single' | 'comparison'

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

function formatPercentage(num: number, decimals: number = 2): string {
  return `${(num * 100).toFixed(decimals)}%`
}

function formatDateRange(start: string, end: string): string {
  return `${format(new Date(start), 'MMM d')} - ${format(new Date(end), 'MMM d, yyyy')}`
}

export default function KeywordAnalysisPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [viewMode, setViewMode] = useState<ViewMode>('single')
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [showExportMenu, setShowExportMenu] = useState(false)

  // Get URL parameters
  const asin = searchParams.get('asin')
  const singleKeyword = searchParams.get('keyword')
  const multipleKeywords = searchParams.get('keywords')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const compareStartDate = searchParams.get('compareStartDate')
  const compareEndDate = searchParams.get('compareEndDate')

  // Determine initial view mode and keywords based on URL
  useEffect(() => {
    if (multipleKeywords) {
      const keywords = multipleKeywords.split(',').map(k => k.trim()).filter(Boolean)
      setSelectedKeywords(keywords)
      setViewMode('comparison')
    } else if (singleKeyword) {
      setSelectedKeywords([singleKeyword])
      setViewMode('single')
    }
  }, [singleKeyword, multipleKeywords])

  // Check for required parameters
  const hasRequiredParams = asin && (singleKeyword || multipleKeywords) && startDate && endDate

  // Prepare API parameters
  const performanceParams = useMemo(() => {
    if (!hasRequiredParams || viewMode !== 'single' || !singleKeyword) return null
    
    return {
      asin,
      keyword: singleKeyword,
      startDate,
      endDate,
      compareStartDate: compareStartDate || undefined,
      compareEndDate: compareEndDate || undefined,
    }
  }, [asin, singleKeyword, startDate, endDate, compareStartDate, compareEndDate, viewMode, hasRequiredParams])

  const comparisonParams = useMemo(() => {
    if (!hasRequiredParams || viewMode !== 'comparison' || selectedKeywords.length === 0) return null
    
    return {
      asin,
      keywords: selectedKeywords,
      startDate,
      endDate,
    }
  }, [asin, selectedKeywords, startDate, endDate, viewMode, hasRequiredParams])

  // Fetch data
  const { data: performanceData, isLoading: performanceLoading, error: performanceError } = 
    useKeywordPerformance(performanceParams)
  
  const { data: comparisonData, isLoading: comparisonLoading, error: comparisonError } = 
    useKeywordComparison(comparisonParams)

  // Handle date range changes
  const handleDateRangeChange = useCallback((range: { startDate: string; endDate: string }) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('startDate', range.startDate)
    params.set('endDate', range.endDate)
    
    router.push(`${pathname}?${params.toString()}`)
  }, [pathname, router, searchParams])

  const handleCompareRangeChange = useCallback((range: { startDate: string; endDate: string; enabled: boolean }) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (range.enabled && range.startDate && range.endDate) {
      params.set('compareStartDate', range.startDate)
      params.set('compareEndDate', range.endDate)
    } else {
      params.delete('compareStartDate')
      params.delete('compareEndDate')
    }
    
    router.push(`${pathname}?${params.toString()}`)
  }, [pathname, router, searchParams])

  // Handle view mode changes
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    
    const params = new URLSearchParams(searchParams.toString())
    if (mode === 'single' && selectedKeywords.length > 0) {
      params.set('keyword', selectedKeywords[0])
      params.delete('keywords')
    } else if (mode === 'comparison' && selectedKeywords.length > 0) {
      params.set('keywords', selectedKeywords.join(','))
      params.delete('keyword')
    }
    
    router.push(`${pathname}?${params.toString()}`)
  }

  // Handle keyword selection changes
  const handleKeywordSelectionChange = (keywords: string[]) => {
    setSelectedKeywords(keywords)
    
    if (viewMode === 'comparison' && keywords.length > 0) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('keywords', keywords.join(','))
      router.push(`${pathname}?${params.toString()}`)
    }
  }

  // Export functionality
  const handleExport = (format: 'csv' | 'excel') => {
    // TODO: Implement export functionality
    console.log(`Exporting as ${format}`)
    setShowExportMenu(false)
  }

  if (!hasRequiredParams) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Missing required parameters</h2>
            <p className="text-gray-600">
              Please provide ASIN, keyword, start date, and end date in the URL parameters.
            </p>
            <button
              onClick={() => router.back()}
              className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isLoading = viewMode === 'single' ? performanceLoading : comparisonLoading
  const error = viewMode === 'single' ? performanceError : comparisonError

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Back to dashboard"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              
              {/* Breadcrumb */}
              <Breadcrumb 
                items={[
                  { label: 'Dashboard', href: '/', icon: 'home' },
                  { label: asin || '', href: `/products/${asin}` },
                  { label: viewMode === 'single' ? singleKeyword || '' : `${selectedKeywords.length} keywords` }
                ]}
              />
            </div>
            
            <div className="flex items-center space-x-4">
              {/* View mode toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => handleViewModeChange('single')}
                  className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                    viewMode === 'single'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Single Keyword
                </button>
                <button
                  onClick={() => handleViewModeChange('comparison')}
                  className={`px-3 py-1 text-sm font-medium rounded transition-colors ${
                    viewMode === 'comparison'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Compare Keywords
                </button>
              </div>
              
              {/* Export button */}
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Download className="h-4 w-4" />
                  <span>Export Data</span>
                </button>
                
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                    <button
                      onClick={() => handleExport('csv')}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-50"
                    >
                      Export as CSV
                    </button>
                    <button
                      onClick={() => handleExport('excel')}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-50"
                    >
                      Export as Excel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Page title and metrics */}
          <div className="mt-6">
            <h1 className="text-2xl font-bold text-gray-900">Keyword Analysis</h1>
            {viewMode === 'single' && performanceData && (
              <div className="flex items-center space-x-6 mt-2 text-sm">
                <div>
                  <span className="text-gray-500">Impressions:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {formatNumber(performanceData.funnelData.impressions)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">CTR:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {formatPercentage(performanceData.funnelData.clicks / performanceData.funnelData.impressions)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">CVR:</span>
                  <span className="ml-2 font-medium text-gray-900">
                    {formatPercentage(performanceData.funnelData.purchases / performanceData.funnelData.impressions)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-8 py-6">
        {/* Date range picker */}
        <div className="mb-6" data-testid="date-range-picker">
          <DateRangePickerV2
            startDate={startDate}
            endDate={endDate}
            onChange={handleDateRangeChange}
            showComparison={viewMode === 'single'}
            compareStartDate={compareStartDate || undefined}
            compareEndDate={compareEndDate || undefined}
            onCompareChange={handleCompareRangeChange}
            asin={asin}
            hasManualSelection={true}
          />
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-6" data-testid="loading-skeleton">
            <div className="bg-white rounded-lg shadow p-6 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="h-48 bg-gray-200 rounded"></div>
              </div>
              <div className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="h-48 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error loading keyword analysis</h3>
              <p className="text-gray-600">{error.message}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Single keyword view */}
        {viewMode === 'single' && performanceData && !isLoading && !error && (
          <div className="space-y-6">
            {/* Performance chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Trends</h2>
              <KeywordPerformanceChart
                data={performanceData.timeSeries.map(point => ({
                  ...point,
                  clickRate: point.ctr,
                  cartAddRate: point.impressions > 0 ? point.cartAdds / point.impressions : 0,
                  purchaseRate: point.cvr,
                }))}
                comparisonData={performanceData.comparisonTimeSeries?.map(point => ({
                  ...point,
                  clickRate: point.ctr,
                  cartAddRate: point.impressions > 0 ? point.cartAdds / point.impressions : 0,
                  purchaseRate: point.cvr,
                }))}
                keyword={singleKeyword!}
                dateRange={{ start: startDate, end: endDate }}
                isLoading={false}
                error={null}
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Funnel chart */}
              <KeywordFunnelChart
                data={performanceData.funnelData}
                comparisonData={performanceData.comparisonFunnelData}
                keyword={singleKeyword!}
                dateRange={{ start: startDate, end: endDate }}
                isLoading={false}
                error={null}
              />

              {/* Market share */}
              <KeywordMarketShare
                data={performanceData.marketShare}
                comparisonData={performanceData.comparisonMarketShare}
                keyword={singleKeyword!}
                asin={asin}
                isLoading={false}
                error={null}
              />
            </div>

            {/* Comparison info */}
            {compareStartDate && compareEndDate && (
              <div className="text-center text-sm text-gray-500 mt-4">
                Comparing to {formatDateRange(compareStartDate, compareEndDate)}
              </div>
            )}
          </div>
        )}

        {/* Comparison view */}
        {viewMode === 'comparison' && !isLoading && !error && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1">
              <MultiKeywordSelector
                availableKeywords={['knife sharpener', 'electric knife sharpener', 'manual knife sharpener']} // TODO: Get from API
                selectedKeywords={selectedKeywords}
                onSelectionChange={handleKeywordSelectionChange}
                maxKeywords={10}
              />
            </div>
            
            <div className="col-span-2">
              {selectedKeywords.length > 0 && comparisonData && (
                <KeywordComparisonView
                  keywords={selectedKeywords}
                  data={comparisonData}
                  dateRange={{ start: startDate, end: endDate }}
                  comparisonDateRange={compareStartDate && compareEndDate ? 
                    { start: compareStartDate, end: compareEndDate } : undefined}
                  isLoading={false}
                  error={null}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}