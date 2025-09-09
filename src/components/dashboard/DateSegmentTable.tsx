import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ComparisonCell } from './ComparisonCell'
import { AlertCircle, Loader2 } from 'lucide-react'

interface DateSegment {
  segmentId: string
  segmentType: string
  startDate: string
  endDate: string
  impressions: number
  impressionsComparison?: number
  clicks: number
  clicksComparison?: number
  cartAdds: number
  cartAddsComparison?: number
  purchases: number
  purchasesComparison?: number
  ctr: number
  ctrComparison?: number
  cvr: number
  cvrComparison?: number
  cartAddRate: number
  clickShare: number
  cartAddShare: number
  purchaseShare: number
  queryCount: number
  topQuery?: string
  dataQuality?: string
}

interface DateSegmentTableProps {
  brandId: string
  asin: string
  segmentType: 'weekly' | 'monthly'
  dateRange?: {
    startDate: string
    endDate: string
  }
  comparisonDateRange?: {
    startDate: string
    endDate: string
  }
  showComparison: boolean
}

export const DateSegmentTable: React.FC<DateSegmentTableProps> = ({
  brandId,
  asin,
  segmentType,
  dateRange,
  comparisonDateRange,
  showComparison
}) => {
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Construct query parameters
  const queryParams = new URLSearchParams({
    segmentType,
    limit: itemsPerPage.toString(),
    offset: ((currentPage - 1) * itemsPerPage).toString(),
    ...(dateRange?.startDate && { dateFrom: dateRange.startDate }),
    ...(dateRange?.endDate && { dateTo: dateRange.endDate }),
    ...(comparisonDateRange?.startDate && { comparisonDateFrom: comparisonDateRange.startDate }),
    ...(comparisonDateRange?.endDate && { comparisonDateTo: comparisonDateRange.endDate }),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['brandProductSegments', brandId, asin, segmentType, currentPage, dateRange, comparisonDateRange],
    queryFn: async () => {
      const response = await fetch(`/api/brands/${brandId}/products/${asin}/segments?${queryParams}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to fetch segment data')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })

  const segments: DateSegment[] = data?.data?.segments || []
  const totals = data?.data?.totals
  const meta = data?.meta
  const totalPages = Math.ceil((meta?.totalCount || 0) / itemsPerPage)

  const formatNumber = (value: number) => {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M'
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K'
    }
    return value.toLocaleString()
  }

  const formatPercentage = (value: number) => {
    return (value * 100).toFixed(1) + '%'
  }

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    if (segmentType === 'weekly') {
      return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`
    }
    
    return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getFullYear()}`
  }

  const getShareClass = (value: number) => {
    if (value >= 40) return 'text-green-600 bg-green-50'
    if (value >= 25) return 'text-blue-600 bg-blue-50'
    return 'text-yellow-600 bg-yellow-50'
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={24} className="animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-gray-500">Loading {segmentType} segments...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8 text-red-600">
        <AlertCircle size={20} className="mr-2" />
        <span className="text-sm">Failed to load segment data: {error.message}</span>
      </div>
    )
  }

  if (segments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-sm">No {segmentType} segments found for this period</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary totals */}
      {totals && (
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="grid grid-cols-6 gap-4 text-sm">
            <div>
              <div className="text-gray-500 text-xs">Period Total</div>
              <div className="font-medium">{formatNumber(totals.impressions)} impressions</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Clicks</div>
              <div className="font-medium">{formatNumber(totals.clicks)}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Cart Adds</div>
              <div className="font-medium">{formatNumber(totals.cartAdds)}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Purchases</div>
              <div className="font-medium">{formatNumber(totals.purchases)}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">CTR</div>
              <div className="font-medium">{formatPercentage(totals.ctr)}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">CVR</div>
              <div className="font-medium">{formatPercentage(totals.cvr)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Segments table */}
      <div className="overflow-hidden border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                {segmentType === 'weekly' ? 'Week' : 'Month'}
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Impressions
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Clicks
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Cart Adds
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Purchases
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                CTR
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                CVR
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Click Share
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Purchase Share
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Queries
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {segments.map((segment) => (
              <tr key={segment.segmentId} className="hover:bg-gray-50">
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {formatDateRange(segment.startDate, segment.endDate)}
                  </div>
                  {segment.topQuery && (
                    <div className="text-xs text-gray-500 truncate max-w-24" title={segment.topQuery}>
                      Top: {segment.topQuery}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <ComparisonCell
                    value={formatNumber(segment.impressions)}
                    comparison={segment.impressionsComparison}
                    showComparison={showComparison}
                  />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <ComparisonCell
                    value={formatNumber(segment.clicks)}
                    comparison={segment.clicksComparison}
                    showComparison={showComparison}
                  />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <ComparisonCell
                    value={formatNumber(segment.cartAdds)}
                    comparison={segment.cartAddsComparison}
                    showComparison={showComparison}
                  />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <ComparisonCell
                    value={formatNumber(segment.purchases)}
                    comparison={segment.purchasesComparison}
                    showComparison={showComparison}
                  />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <ComparisonCell
                    value={formatPercentage(segment.ctr)}
                    comparison={segment.ctrComparison}
                    showComparison={showComparison}
                  />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <ComparisonCell
                    value={formatPercentage(segment.cvr)}
                    comparison={segment.cvrComparison}
                    showComparison={showComparison}
                  />
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(segment.clickShare)}`}>
                    {formatPercentage(segment.clickShare / 100)}
                  </span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(segment.purchaseShare)}`}>
                    {formatPercentage(segment.purchaseShare / 100)}
                  </span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{segment.queryCount}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Page {currentPage} of {totalPages} ({meta.totalCount} segments)
          </div>
          <div className="flex items-center space-x-2">
            <button
              className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-500 disabled:opacity-50"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              const pageNum = Math.max(1, currentPage - 2) + i
              if (pageNum > totalPages) return null
              return (
                <button
                  key={pageNum}
                  className={`px-3 py-1 rounded-md text-sm ${
                    currentPage === pageNum
                      ? 'bg-blue-500 text-white'
                      : 'border border-gray-300 text-gray-500'
                  }`}
                  onClick={() => handlePageChange(pageNum)}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              className="px-3 py-1 border border-gray-300 rounded-md text-sm text-gray-500 disabled:opacity-50"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}