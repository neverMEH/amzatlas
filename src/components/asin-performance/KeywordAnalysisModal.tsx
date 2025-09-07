'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, ExternalLink, AlertCircle } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { useKeywordPerformance } from '@/lib/api/keyword-analysis'
import { useViewMode, ViewMode } from '@/hooks/use-view-mode'
import { KeywordPerformanceChart } from './KeywordPerformanceChart'
import { KeywordFunnelChart } from './KeywordFunnelChart'
import { KeywordMarketShare } from './KeywordMarketShare'
import { MetricSparkline } from './MetricSparkline'

interface KeywordAnalysisModalProps {
  isOpen: boolean
  onClose: () => void
  onExpand: () => void
  keyword: string
  asin: string
  dateRange: { start: string; end: string }
  comparisonDateRange?: { start: string; end: string }
  isLoading?: boolean
  error?: Error | null
  viewMode?: ViewMode
}

function formatDateRange(start: string, end: string): string {
  return `${format(new Date(start), 'MMM d')} - ${format(new Date(end), 'MMM d, yyyy')}`
}

export function KeywordAnalysisModal({
  isOpen,
  onClose,
  onExpand,
  keyword,
  asin,
  dateRange,
  comparisonDateRange,
  isLoading: propIsLoading = false,
  error: propError = null,
  viewMode,
}: KeywordAnalysisModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const expandButtonRef = useRef<HTMLButtonElement>(null)

  // Use view mode hook
  const { 
    isPopup, 
    shouldShowSparklines, 
    shouldShowFullCharts, 
    layout 
  } = useViewMode({ mode: viewMode })

  /**
   * Detect if the selected date range is exactly 7 days (one week).
   * This is used to switch from line charts to bar charts for better
   * visualization of weekly data with limited data points.
   * 
   * Note: differenceInDays returns 6 for a 7-day range because it
   * calculates the difference between dates (e.g., Jan 7 - Jan 1 = 6 days),
   * but the range includes both start and end dates (7 days total).
   */
  const isWeeklyRange = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return false
    const days = differenceInDays(new Date(dateRange.end), new Date(dateRange.start))
    return days === 6 // 6 days difference = 7 days total (inclusive)
  }, [dateRange.start, dateRange.end])

  /**
   * Determine the chart type for sparklines based on the date range.
   * Bar charts provide better visualization for exactly 7 data points (weekly data),
   * while line charts are better for longer time series.
   */
  const sparklineChartType = isWeeklyRange ? 'bar' : 'line'

  // Fetch keyword performance data
  const { data, isLoading: dataLoading, error: dataError } = useKeywordPerformance(
    isOpen ? {
      asin,
      keyword,
      startDate: dateRange.start,
      endDate: dateRange.end,
      compareStartDate: comparisonDateRange?.start,
      compareEndDate: comparisonDateRange?.end,
    } : null
  )

  const isLoading = propIsLoading || dataLoading
  const error = propError || dataError

  // Handle open/close with animation
  useEffect(() => {
    if (isOpen) {
      // Store current focus
      previousFocusRef.current = document.activeElement as HTMLElement
      
      // Show modal
      setIsVisible(true)
      
      // Start animation after a frame
      requestAnimationFrame(() => {
        setIsAnimating(true)
        
        // Focus close button after another frame to ensure DOM is ready
        requestAnimationFrame(() => {
          closeButtonRef.current?.focus()
        })
      })
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden'
    } else {
      // Start close animation
      setIsAnimating(false)
      
      // Hide after animation
      const timeout = setTimeout(() => {
        setIsVisible(false)
        
        // Restore focus
        previousFocusRef.current?.focus()
      }, 200) // Match transition duration
      
      // Restore body scroll
      document.body.style.overflow = ''
      
      return () => clearTimeout(timeout)
    }
  }, [isOpen])

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Focus trap
  useEffect(() => {
    if (!isOpen || !modalRef.current) return

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusableElements = modalRef.current!.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault()
        lastElement.focus()
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleTabKey)
    return () => document.removeEventListener('keydown', handleTabKey)
  }, [isOpen])

  if (!isVisible) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const modalContent = (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
        isAnimating ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleBackdropClick}
      data-testid="modal-backdrop"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50" />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative bg-white rounded-lg shadow-xl w-full ${layout.maxWidth} max-h-[90vh] overflow-hidden transform transition-all duration-200 ${
          isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-content"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex-1">
            <h2 id="modal-title" className="text-xl font-semibold text-gray-900">
              Keyword Analysis: {keyword}
            </h2>
            <div className="mt-1 text-sm text-gray-500">
              ASIN: {asin} • {formatDateRange(dateRange.start, dateRange.end)}
              {comparisonDateRange && (
                <span className="ml-2">
                  vs {formatDateRange(comparisonDateRange.start, comparisonDateRange.end)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2 ml-4">
            <button
              ref={expandButtonRef}
              onClick={onExpand}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Expand to new tab"
              tabIndex={0}
            >
              <ExternalLink className="h-5 w-5" />
            </button>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close modal"
              tabIndex={0}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={`${layout.padding} overflow-y-auto max-h-[calc(90vh-80px)]`}>
          {isLoading ? (
            <div className="animate-pulse" data-testid="modal-skeleton">
              <div className="h-64 bg-gray-200 rounded mb-4"></div>
              <div className="h-32 bg-gray-200 rounded mb-4"></div>
              <div className="h-48 bg-gray-200 rounded"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <p className="text-red-800 font-medium">Error loading keyword data</p>
              <p className="text-red-600 text-sm mt-1">{error.message}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Quick View Badge for Popup Mode */}
              {isPopup && (
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Quick View
                  </span>
                  <button
                    onClick={onExpand}
                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                  >
                    See Full Analysis →
                  </button>
                </div>
              )}

              {/* Sparkline View for Popup Mode */}
              {shouldShowSparklines && data && (
                <div className="space-y-3">
                  {/* Primary Metrics Row */}
                  <div className="grid grid-cols-2 gap-3">
                    <MetricSparkline
                      data={data.timeSeries}
                      metric="impressions"
                      label="Impressions"
                      currentValue={data.summary.impressions}
                      comparisonValue={data.comparisonSummary?.impressions}
                      chartType={sparklineChartType}
                      height={layout.chartHeight}
                    />
                    <MetricSparkline
                      data={data.timeSeries}
                      metric="clicks"
                      label="Clicks"
                      currentValue={data.summary.clicks}
                      comparisonValue={data.comparisonSummary?.clicks}
                      chartType={sparklineChartType}
                      height={layout.chartHeight}
                    />
                  </div>
                  {/* Conversion Metrics Row */}
                  <div className="grid grid-cols-2 gap-3">
                    <MetricSparkline
                      data={data.timeSeries}
                      metric="purchases"
                      label="Purchases"
                      currentValue={data.summary.purchases}
                      comparisonValue={data.comparisonSummary?.purchases}
                      chartType={sparklineChartType}
                      height={layout.chartHeight}
                    />
                    <MetricSparkline
                      data={data.timeSeries}
                      metric="cvr"
                      label="Conversion Rate"
                      currentValue={data.summary.cvr}
                      comparisonValue={data.comparisonSummary?.cvr}
                      formatValue={(v) => `${(v * 100).toFixed(2)}%`}
                      chartType={sparklineChartType}
                      height={layout.chartHeight}
                    />
                  </div>
                </div>
              )}

              {/* Full Charts for Full Page Mode */}
              {shouldShowFullCharts && (
                <>
                  {/* Performance Chart */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Trends</h3>
                    <div style={{ height: layout.chartHeight }}>
                      <KeywordPerformanceChart
                        data={data?.timeSeries.map(point => ({
                          ...point,
                          clickRate: point.ctr,
                          cartAddRate: point.impressions > 0 ? point.cartAdds / point.impressions : 0,
                          purchaseRate: point.cvr,
                        })) || []}
                        comparisonData={data?.comparisonTimeSeries?.map(point => ({
                          ...point,
                          clickRate: point.ctr,
                          cartAddRate: point.impressions > 0 ? point.cartAdds / point.impressions : 0,
                          purchaseRate: point.cvr,
                        }))}
                        keyword={keyword}
                        dateRange={dateRange}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Funnel Chart */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
                      <KeywordFunnelChart
                        data={data?.funnelData || { impressions: 0, clicks: 0, cartAdds: 0, purchases: 0 }}
                        comparisonData={data?.comparisonFunnelData}
                        keyword={keyword}
                        dateRange={dateRange}
                        comparisonDateRange={comparisonDateRange}
                        isLoading={false}
                        error={null}
                      />
                    </div>

                    {/* Market Share */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Share</h3>
                      <KeywordMarketShare
                        data={data?.marketShare || { totalMarket: { impressions: 0, clicks: 0, purchases: 0 }, competitors: [] }}
                        comparisonData={data?.comparisonMarketShare}
                        keyword={keyword}
                        asin={asin}
                        isLoading={false}
                        error={null}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Compare Keywords Button */}
              <div className="bg-blue-50 rounded-lg p-6 text-center">
                <p className="text-gray-700 mb-3">Want to compare multiple keywords?</p>
                <button
                  onClick={onExpand}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Full Analysis
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // Use portal to render at document root
  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body)
  }

  return null
}