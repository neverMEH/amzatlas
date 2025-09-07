'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Search, X, Check, AlertCircle, ChevronUp, ChevronDown, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'

interface MultiKeywordSelectorProps {
  availableKeywords: string[]
  selectedKeywords: string[]
  onSelectionChange: (keywords: string[]) => void
  maxKeywords?: number
  asin?: string
  startDate?: string
  endDate?: string
  keywordsWithMetrics?: Array<{
    keyword: string
    impressions: number
    clicks?: number
    cartAdds?: number
    purchases?: number
    ctr?: number
    cvr?: number
  }>
  metricsLoading?: boolean
}

type SortOption = 'keyword' | 'impressions' | 'clicks' | 'purchases' | 'ctr' | 'cvr'
type SortDirection = 'asc' | 'desc'

const ITEMS_PER_PAGE = 25

export function MultiKeywordSelector({
  availableKeywords,
  selectedKeywords,
  onSelectionChange,
  maxKeywords = 10,
  asin,
  startDate,
  endDate,
  keywordsWithMetrics,
  metricsLoading = false,
}: MultiKeywordSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('impressions')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [showFilters, setShowFilters] = useState(false)
  const [minImpressions, setMinImpressions] = useState('')
  const [minPurchases, setMinPurchases] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // Create a map of keyword to metrics
  const metricsMap = useMemo(() => {
    const map = new Map<string, {
      impressions: number
      clicks: number
      cartAdds: number
      purchases: number
      ctr: number
      cvr: number
    }>()
    if (keywordsWithMetrics) {
      keywordsWithMetrics.forEach(metric => {
        map.set(metric.keyword, {
          impressions: metric.impressions,
          clicks: metric.clicks || 0,
          cartAdds: metric.cartAdds || 0,
          purchases: metric.purchases || 0,
          ctr: metric.ctr || 0,
          cvr: metric.cvr || 0,
        })
      })
    }
    return map
  }, [keywordsWithMetrics])

  const filteredKeywords = useMemo(() => {
    const term = searchTerm.toLowerCase()
    let keywords = availableKeywords

    // Filter by search term
    if (term) {
      keywords = keywords.filter(keyword =>
        keyword.toLowerCase().includes(term)
      )
    }

    // Filter by minimum impressions
    if (minImpressions && metricsMap.size > 0) {
      const minImp = parseInt(minImpressions)
      keywords = keywords.filter(keyword => {
        const metrics = metricsMap.get(keyword)
        return !metrics || metrics.impressions >= minImp
      })
    }

    // Filter by minimum purchases
    if (minPurchases && metricsMap.size > 0) {
      const minPur = parseInt(minPurchases)
      keywords = keywords.filter(keyword => {
        const metrics = metricsMap.get(keyword)
        return !metrics || metrics.purchases >= minPur
      })
    }

    return keywords
  }, [availableKeywords, searchTerm, minImpressions, minPurchases, metricsMap])

  const sortedKeywords = useMemo(() => {
    let sorted = [...filteredKeywords]

    // Sort based on selected option
    sorted.sort((a, b) => {
      const aMetrics = metricsMap.get(a)
      const bMetrics = metricsMap.get(b)

      let comparison = 0

      if (sortBy === 'keyword') {
        comparison = a.localeCompare(b)
      } else if (aMetrics && bMetrics) {
        switch (sortBy) {
          case 'impressions':
            comparison = aMetrics.impressions - bMetrics.impressions
            break
          case 'clicks':
            comparison = aMetrics.clicks - bMetrics.clicks
            break
          case 'purchases':
            comparison = aMetrics.purchases - bMetrics.purchases
            break
          case 'ctr':
            comparison = aMetrics.ctr - bMetrics.ctr
            break
          case 'cvr':
            comparison = aMetrics.cvr - bMetrics.cvr
            break
        }
      } else if (!aMetrics && bMetrics) {
        return 1
      } else if (aMetrics && !bMetrics) {
        return -1
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [filteredKeywords, sortBy, sortDirection, metricsMap])

  // Pagination calculations
  const totalPages = Math.ceil(sortedKeywords.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedKeywords = sortedKeywords.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, minImpressions, minPurchases, sortBy, sortDirection])

  const handleKeywordToggle = (keyword: string) => {
    if (selectedKeywords.includes(keyword)) {
      // Deselect
      onSelectionChange(selectedKeywords.filter(k => k !== keyword))
    } else {
      // Select (if not at max)
      if (selectedKeywords.length < maxKeywords) {
        onSelectionChange([...selectedKeywords, keyword])
      }
    }
  }

  const handleSelectAll = () => {
    // Select all visible keywords on current page
    const visibleKeywords = paginatedKeywords.slice(0, maxKeywords - selectedKeywords.length)
    const newSelection = [...new Set([...selectedKeywords, ...visibleKeywords])]
    onSelectionChange(newSelection.slice(0, maxKeywords))
  }

  const handleClearAll = () => {
    onSelectionChange([])
  }

  const handleSort = (column: SortOption) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDirection('desc')
    }
  }

  const isAtMax = selectedKeywords.length >= maxKeywords

  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toLocaleString()
  }

  function formatPercentage(num: number): string {
    return `${num.toFixed(1)}%`
  }

  if (availableKeywords.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-900 font-medium">No keywords available</p>
          <p className="text-gray-500 text-sm mt-1">
            Select an ASIN and date range to view available keywords
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Select Keywords to Compare</h3>
            <p className="text-sm text-gray-500 mt-1">
              {selectedKeywords.length} / {maxKeywords} keywords selected
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {selectedKeywords.length < maxKeywords && paginatedKeywords.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Select visible ({Math.min(paginatedKeywords.length, maxKeywords - selectedKeywords.length)})
              </button>
            )}
            {selectedKeywords.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {isAtMax && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">Maximum keywords selected</p>
          </div>
        )}

        {/* Search and filters */}
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search keywords..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium flex items-center space-x-1"
              disabled={metricsLoading || metricsMap.size === 0}
            >
              <span>Filters</span>
              {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            <p className="text-sm text-gray-500">
              {sortedKeywords.length} keywords
            </p>
          </div>

          {/* Filter inputs */}
          {showFilters && (
            <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Min Impressions
                </label>
                <input
                  type="number"
                  value={minImpressions}
                  onChange={(e) => setMinImpressions(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Min Purchases
                </label>
                <input
                  type="number"
                  value={minPurchases}
                  onChange={(e) => setMinPurchases(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => {
                  setMinImpressions('')
                  setMinPurchases('')
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table with keywords and metrics */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left">
                <div className="flex items-center space-x-1">
                  <input
                    type="checkbox"
                    checked={selectedKeywords.length === paginatedKeywords.length && paginatedKeywords.length > 0}
                    ref={(el) => {
                      if (el) {
                        el.indeterminate = selectedKeywords.filter(k => paginatedKeywords.includes(k)).length > 0 && 
                                           selectedKeywords.filter(k => paginatedKeywords.includes(k)).length < paginatedKeywords.length
                      }
                    }}
                    onChange={() => {
                      const pageSelected = paginatedKeywords.filter(k => selectedKeywords.includes(k))
                      if (pageSelected.length === paginatedKeywords.length) {
                        // Deselect all on this page
                        onSelectionChange(selectedKeywords.filter(k => !paginatedKeywords.includes(k)))
                      } else {
                        // Select all on this page
                        handleSelectAll()
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={paginatedKeywords.length === 0}
                  />
                </div>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('keyword')}
                  className="flex items-center space-x-1 font-medium text-xs text-gray-900 uppercase tracking-wider hover:text-gray-700"
                >
                  <span>Keyword</span>
                  <ArrowUpDown className={`h-4 w-4 ${sortBy === 'keyword' ? 'text-blue-600' : 'text-gray-400'}`} />
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button
                  onClick={() => handleSort('impressions')}
                  className="flex items-center space-x-1 font-medium text-xs text-gray-900 uppercase tracking-wider hover:text-gray-700 ml-auto"
                  disabled={metricsMap.size === 0}
                >
                  <span>Impressions</span>
                  <ArrowUpDown className={`h-4 w-4 ${sortBy === 'impressions' ? 'text-blue-600' : 'text-gray-400'}`} />
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button
                  onClick={() => handleSort('clicks')}
                  className="flex items-center space-x-1 font-medium text-xs text-gray-900 uppercase tracking-wider hover:text-gray-700 ml-auto"
                  disabled={metricsMap.size === 0}
                >
                  <span>Clicks</span>
                  <ArrowUpDown className={`h-4 w-4 ${sortBy === 'clicks' ? 'text-blue-600' : 'text-gray-400'}`} />
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button
                  onClick={() => handleSort('purchases')}
                  className="flex items-center space-x-1 font-medium text-xs text-gray-900 uppercase tracking-wider hover:text-gray-700 ml-auto"
                  disabled={metricsMap.size === 0}
                >
                  <span>Purchases</span>
                  <ArrowUpDown className={`h-4 w-4 ${sortBy === 'purchases' ? 'text-blue-600' : 'text-gray-400'}`} />
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button
                  onClick={() => handleSort('ctr')}
                  className="flex items-center space-x-1 font-medium text-xs text-gray-900 uppercase tracking-wider hover:text-gray-700 ml-auto"
                  disabled={metricsMap.size === 0}
                >
                  <span>CTR</span>
                  <ArrowUpDown className={`h-4 w-4 ${sortBy === 'ctr' ? 'text-blue-600' : 'text-gray-400'}`} />
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <button
                  onClick={() => handleSort('cvr')}
                  className="flex items-center space-x-1 font-medium text-xs text-gray-900 uppercase tracking-wider hover:text-gray-700 ml-auto"
                  disabled={metricsMap.size === 0}
                >
                  <span>CVR</span>
                  <ArrowUpDown className={`h-4 w-4 ${sortBy === 'cvr' ? 'text-blue-600' : 'text-gray-400'}`} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {metricsLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center">
                  <div className="inline-flex items-center space-x-2 text-gray-600">
                    <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
                    <span>Loading keyword metrics...</span>
                  </div>
                </td>
              </tr>
            )}

            {!metricsLoading && paginatedKeywords.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No keywords match your filters
                </td>
              </tr>
            )}

            {!metricsLoading && paginatedKeywords.map((keyword) => {
              const isSelected = selectedKeywords.includes(keyword)
              const isDisabled = !isSelected && isAtMax
              const metrics = metricsMap.get(keyword)

              return (
                <tr
                  key={keyword}
                  className={`
                    transition-colors
                    ${isSelected 
                      ? 'bg-blue-50' 
                      : isDisabled
                        ? 'opacity-50'
                        : 'hover:bg-gray-50'
                    }
                  `}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleKeywordToggle(keyword)}
                      disabled={isDisabled}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      aria-label={`${isSelected ? 'Deselect' : 'Select'} keyword: ${keyword}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                      {keyword}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {metrics ? formatNumber(metrics.impressions) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {metrics ? formatNumber(metrics.clicks) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {metrics ? formatNumber(metrics.purchases) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {metrics ? formatPercentage(metrics.ctr) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {metrics ? formatPercentage(metrics.cvr) : '-'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <span className="text-sm text-gray-600">
            Showing {startIndex + 1}-{Math.min(endIndex, sortedKeywords.length)} of {sortedKeywords.length} keywords
          </span>
        </div>
      )}
    </div>
  )
}