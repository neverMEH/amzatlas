'use client'

import React, { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, Search, Download, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'

export interface SearchQueryData {
  searchQuery: string
  impressions: number
  clicks: number
  cartAdds: number
  purchases: number
  ctr: number
  cvr: number
  cartAddRate: number
  purchaseRate: number
  impressionShare: number
  clickShare: number
  cartAddShare?: number
  purchaseShare: number
}

interface SearchQueryTableProps {
  data: SearchQueryData[]
  comparisonData?: SearchQueryData[]
  dateRange?: { start: string; end: string }
  comparisonDateRange?: { start: string; end: string }
  isLoading: boolean
  error: Error | null
  onExport?: (data: SearchQueryData[]) => void
  onKeywordClick?: (keyword: string, rowData: SearchQueryData) => void
}

type SortField = keyof SearchQueryData
type SortDirection = 'asc' | 'desc'

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

function formatPercentage(num: number, decimals: number = 2): string {
  return `${(num * 100).toFixed(decimals)}%`
}

function formatChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+∞' : '0%'
  const change = ((current - previous) / previous) * 100
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`
}

function formatDateRange(start: string, end: string): string {
  return `${format(new Date(start), 'MMM d')} - ${format(new Date(end), 'MMM d, yyyy')}`
}

export function SearchQueryTable({ data, comparisonData, dateRange, comparisonDateRange, isLoading, error, onExport, onKeywordClick }: SearchQueryTableProps) {
  const [sortField, setSortField] = useState<SortField>('impressions')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [searchTerm, setSearchTerm] = useState('')
  const [showShareMetrics, setShowShareMetrics] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Create comparison data map for quick lookup
  const comparisonMap = useMemo(() => {
    if (!comparisonData) return new Map()
    return new Map(comparisonData.map(item => [item.searchQuery, item]))
  }, [comparisonData])

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data
    return data.filter(item => 
      item.searchQuery.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [data, searchTerm])

  // Sort data
  const sortedData = useMemo(() => {
    const sorted = [...filteredData].sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]
      
      if (typeof aValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue as string)
          : (bValue as string).localeCompare(aValue)
      }
      
      return sortDirection === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number)
    })
    return sorted
  }, [filteredData, sortField, sortDirection])

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return sortedData.slice(startIndex, startIndex + itemsPerPage)
  }, [sortedData, currentPage])

  const totalPages = Math.ceil(sortedData.length / itemsPerPage)

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
    setCurrentPage(1) // Reset to first page when sorting
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
    setCurrentPage(1) // Reset to first page when searching
  }

  const isHighPerforming = (row: SearchQueryData) => {
    // Highlight rows with high CVR (top 20%)
    const cvrs = data.map(d => d.cvr).sort((a, b) => b - a)
    const top20PercentileCvr = cvrs[Math.floor(cvrs.length * 0.2)]
    return row.cvr >= top20PercentileCvr
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse" data-testid="table-skeleton">
        <div className="h-10 bg-gray-200 rounded mb-4"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <p className="text-red-800 font-medium">Error loading search queries</p>
          <p className="text-red-600 text-sm mt-1">{error.message}</p>
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <Search className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-900 font-medium">No search query data available</p>
          <p className="text-gray-500 text-sm mt-1">
            Select an ASIN and date range to view search query performance
          </p>
        </div>
      </div>
    )
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronUp className="h-4 w-4 text-gray-400" />
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="h-4 w-4 text-blue-600" />
      : <ChevronDown className="h-4 w-4 text-blue-600" />
  }

  const ComparisonChange = ({ current, previous }: { current: number; previous: number }) => {
    const changeClass = current > previous ? 'text-green-600' : 
                       current < previous ? 'text-red-600' : 'text-gray-500'
    
    return (
      <div 
        className={`text-xs ${changeClass}`}
        title={comparisonDateRange ? `vs ${formatDateRange(comparisonDateRange.start, comparisonDateRange.end)}` : 'vs previous period'}
      >
        {formatChange(current, previous)}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header with search and controls */}
      <div className="p-4 border-b border-gray-200">
        {comparisonDateRange && (
          <div className="mb-3 text-sm text-gray-500 text-center">
            Comparing {dateRange && formatDateRange(dateRange.start, dateRange.end)} 
            {' '}vs {formatDateRange(comparisonDateRange.start, comparisonDateRange.end)}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search queries..."
                value={searchTerm}
                onChange={handleSearch}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={showShareMetrics}
                onChange={(e) => setShowShareMetrics(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                aria-label="Show share metrics"
              />
              <span className="text-gray-600">Show share metrics</span>
            </label>
          </div>
          {onExport && (
            <button
              onClick={() => onExport(sortedData)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('searchQuery')}
                  className="flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700"
                >
                  <span>Search Query</span>
                  <SortIcon field="searchQuery" />
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <button
                  onClick={() => handleSort('impressions')}
                  className="flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 ml-auto"
                >
                  <span>Impressions</span>
                  <SortIcon field="impressions" />
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <button
                  onClick={() => handleSort('clicks')}
                  className="flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 ml-auto"
                >
                  <span>Clicks</span>
                  <SortIcon field="clicks" />
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <button
                  onClick={() => handleSort('cartAdds')}
                  className="flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 ml-auto"
                >
                  <span>Cart Adds</span>
                  <SortIcon field="cartAdds" />
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <button
                  onClick={() => handleSort('purchases')}
                  className="flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 ml-auto"
                >
                  <span>Purchases</span>
                  <SortIcon field="purchases" />
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <button
                  onClick={() => handleSort('ctr')}
                  className="flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 ml-auto"
                >
                  <span>CTR</span>
                  <SortIcon field="ctr" />
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <button
                  onClick={() => handleSort('cvr')}
                  className="flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 ml-auto"
                >
                  <span>CVR</span>
                  <SortIcon field="cvr" />
                </button>
              </th>
              {showShareMetrics && (
                <>
                  <th className="px-6 py-3 text-right">
                    <button
                      onClick={() => handleSort('impressionShare')}
                      className="flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 ml-auto"
                    >
                      <span>Impression Share</span>
                      <SortIcon field="impressionShare" />
                    </button>
                  </th>
                  <th className="px-6 py-3 text-right">
                    <button
                      onClick={() => handleSort('clickShare')}
                      className="flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 ml-auto"
                    >
                      <span>Click Share</span>
                      <SortIcon field="clickShare" />
                    </button>
                  </th>
                  {data.some(d => d.cartAddShare !== undefined) && (
                    <th className="px-6 py-3 text-right">
                      <button
                        onClick={() => handleSort('cartAddShare' as SortField)}
                        className="flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 ml-auto"
                      >
                        <span>Cart Add Share</span>
                        <SortIcon field={'cartAddShare' as SortField} />
                      </button>
                    </th>
                  )}
                  <th className="px-6 py-3 text-right">
                    <button
                      onClick={() => handleSort('purchaseShare')}
                      className="flex items-center space-x-1 text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-700 ml-auto"
                    >
                      <span>Purchase Share</span>
                      <SortIcon field="purchaseShare" />
                    </button>
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((row, index) => {
              const comparisonRow = comparisonData ? comparisonMap.get(row.searchQuery) : null
              return (
                <tr 
                  key={`${row.searchQuery}-${index}`}
                  className={`hover:bg-gray-50 ${isHighPerforming(row) ? 'bg-green-50' : ''}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {onKeywordClick ? (
                      <span
                        onClick={() => onKeywordClick(row.searchQuery, row)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onKeywordClick(row.searchQuery, row)
                          }
                        }}
                        className="cursor-pointer hover:text-blue-600 hover:underline transition-colors"
                        role="button"
                        tabIndex={0}
                        aria-label={`Click to analyze keyword: ${row.searchQuery}`}
                      >
                        {row.searchQuery}
                      </span>
                    ) : (
                      row.searchQuery
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    <div>
                      {formatNumber(row.impressions)}
                      {comparisonRow && (
                        <ComparisonChange current={row.impressions} previous={comparisonRow.impressions} />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    <div>
                      {formatNumber(row.clicks)}
                      {comparisonRow && (
                        <ComparisonChange current={row.clicks} previous={comparisonRow.clicks} />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    <div>
                      {formatNumber(row.cartAdds)}
                      {comparisonRow && (
                        <ComparisonChange current={row.cartAdds} previous={comparisonRow.cartAdds} />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    <div>
                      {formatNumber(row.purchases)}
                      {comparisonRow && (
                        <ComparisonChange current={row.purchases} previous={comparisonRow.purchases} />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    <div>
                      {formatPercentage(row.ctr)}
                      {comparisonRow && (
                        <ComparisonChange current={row.ctr} previous={comparisonRow.ctr} />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    <div>
                      {formatPercentage(row.cvr)}
                      {comparisonRow && (
                        <ComparisonChange current={row.cvr} previous={comparisonRow.cvr} />
                      )}
                    </div>
                  </td>
                  {showShareMetrics && (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        <div>
                          {formatPercentage(row.impressionShare, 1)}
                          {comparisonRow && (
                            <ComparisonChange current={row.impressionShare} previous={comparisonRow.impressionShare} />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        <div>
                          {formatPercentage(row.clickShare, 1)}
                          {comparisonRow && (
                            <ComparisonChange current={row.clickShare} previous={comparisonRow.clickShare} />
                          )}
                        </div>
                      </td>
                      {row.cartAddShare !== undefined && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          <div>
                            {formatPercentage(row.cartAddShare, 1)}
                            {comparisonRow && comparisonRow.cartAddShare !== undefined && (
                              <ComparisonChange current={row.cartAddShare} previous={comparisonRow.cartAddShare} />
                            )}
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        <div>
                          {formatPercentage(row.purchaseShare, 1)}
                          {comparisonRow && (
                            <ComparisonChange current={row.purchaseShare} previous={comparisonRow.purchaseShare} />
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} results
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}