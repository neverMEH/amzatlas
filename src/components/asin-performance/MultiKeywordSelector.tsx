'use client'

import React, { useState, useMemo } from 'react'
import { Search, X, Check, AlertCircle, TrendingUp, Users, ShoppingCart, ChevronUp, ChevronDown } from 'lucide-react'
import { useKeywordMetrics, type KeywordKPI } from '@/lib/api/keyword-analysis'

interface MultiKeywordSelectorProps {
  availableKeywords: string[]
  selectedKeywords: string[]
  onSelectionChange: (keywords: string[]) => void
  maxKeywords?: number
  asin?: string
  startDate?: string
  endDate?: string
}

type SortOption = 'impressions' | 'clicks' | 'purchases' | 'ctr' | 'cvr' | 'alphabetical'

export function MultiKeywordSelector({
  availableKeywords,
  selectedKeywords,
  onSelectionChange,
  maxKeywords = 10,
  asin,
  startDate,
  endDate,
}: MultiKeywordSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('impressions')
  const [showFilters, setShowFilters] = useState(false)
  const [minImpressions, setMinImpressions] = useState('')
  const [minPurchases, setMinPurchases] = useState('')

  // Fetch keyword metrics if we have the required params
  const { data: metricsData, isLoading: metricsLoading } = useKeywordMetrics(
    asin && startDate && endDate ? { asin, startDate, endDate } : null
  )

  // Create a map of keyword to metrics
  const metricsMap = useMemo(() => {
    const map = new Map<string, KeywordKPI>()
    if (metricsData?.keywords) {
      metricsData.keywords.forEach(metric => {
        map.set(metric.keyword, metric)
      })
    }
    return map
  }, [metricsData])

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
    if (sortBy === 'alphabetical') {
      sorted.sort((a, b) => a.localeCompare(b))
    } else if (metricsMap.size > 0) {
      sorted.sort((a, b) => {
        const aMetrics = metricsMap.get(a)
        const bMetrics = metricsMap.get(b)
        
        if (!aMetrics && !bMetrics) return 0
        if (!aMetrics) return 1
        if (!bMetrics) return -1

        switch (sortBy) {
          case 'impressions':
            return bMetrics.impressions - aMetrics.impressions
          case 'clicks':
            return bMetrics.clicks - aMetrics.clicks
          case 'purchases':
            return bMetrics.purchases - aMetrics.purchases
          case 'ctr':
            return bMetrics.ctr - aMetrics.ctr
          case 'cvr':
            return bMetrics.cvr - aMetrics.cvr
          default:
            return 0
        }
      })
    }

    // Show selected keywords first
    const selected = sorted.filter(k => selectedKeywords.includes(k))
    const unselected = sorted.filter(k => !selectedKeywords.includes(k))
    return [...selected, ...unselected]
  }, [filteredKeywords, selectedKeywords, sortBy, metricsMap])

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

  const handleClearAll = () => {
    onSelectionChange([])
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
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Select Keywords to Compare</h3>
            <p className="text-sm text-gray-500 mt-1">
              {selectedKeywords.length} / {maxKeywords} keywords selected
            </p>
          </div>
          {selectedKeywords.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear all
            </button>
          )}
        </div>

        {isAtMax && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">Maximum keywords selected</p>
          </div>
        )}

        {/* Search and filters */}
        <div className="space-y-4 mb-4">
          <div className="relative">
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

          {/* Sort and filter controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={metricsLoading || metricsMap.size === 0}
              >
                <option value="impressions">Sort by Impressions</option>
                <option value="clicks">Sort by Clicks</option>
                <option value="purchases">Sort by Purchases</option>
                <option value="ctr">Sort by CTR</option>
                <option value="cvr">Sort by CVR</option>
                <option value="alphabetical">Sort Alphabetically</option>
              </select>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium flex items-center space-x-1"
                disabled={metricsLoading || metricsMap.size === 0}
              >
                <span>Filters</span>
                {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>

            <p className="text-sm text-gray-500">
              {sortedKeywords.length} keywords available
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

      {/* Keyword list with KPIs */}
      <div className="border-t border-gray-200 max-h-[600px] overflow-y-auto">
        {metricsLoading && (
          <div className="p-4 text-center">
            <div className="inline-flex items-center space-x-2 text-gray-600">
              <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
              <span>Loading keyword metrics...</span>
            </div>
          </div>
        )}

        {!metricsLoading && sortedKeywords.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No keywords match your filters
          </div>
        )}

        {!metricsLoading && sortedKeywords.map((keyword) => {
          const isSelected = selectedKeywords.includes(keyword)
          const isDisabled = !isSelected && isAtMax
          const metrics = metricsMap.get(keyword)

          return (
            <div
              key={keyword}
              data-testid="keyword-item"
              onClick={() => !isDisabled && handleKeywordToggle(keyword)}
              onKeyDown={(e) => {
                if (!isDisabled && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  handleKeywordToggle(keyword)
                }
              }}
              className={`
                border-b border-gray-200 transition-all cursor-pointer
                ${isSelected 
                  ? 'bg-blue-50 hover:bg-blue-100' 
                  : isDisabled
                    ? 'bg-gray-50 cursor-not-allowed opacity-50'
                    : 'bg-white hover:bg-gray-50'
                }
              `}
              role="button"
              tabIndex={isDisabled ? -1 : 0}
              aria-label={`${isSelected ? 'Deselect' : 'Select'} keyword: ${keyword}`}
              aria-pressed={isSelected}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                    {keyword}
                  </span>
                  {isSelected && (
                    <Check className="h-5 w-5 text-blue-600" data-testid="check-icon" />
                  )}
                </div>

                {/* KPI metrics */}
                {metrics && (
                  <div className="grid grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Impressions</p>
                      <p className="font-medium text-gray-900">{formatNumber(metrics.impressions)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Clicks</p>
                      <p className="font-medium text-gray-900">{formatNumber(metrics.clicks)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Purchases</p>
                      <p className="font-medium text-gray-900">{formatNumber(metrics.purchases)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">CTR</p>
                      <p className="font-medium text-gray-900">{formatPercentage(metrics.ctr)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">CVR</p>
                      <p className="font-medium text-gray-900">{formatPercentage(metrics.cvr)}</p>
                    </div>
                  </div>
                )}

                {/* Loading state for individual keyword */}
                {!metrics && metricsMap.size > 0 && (
                  <div className="flex space-x-4 text-sm">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex-1">
                        <div className="h-4 bg-gray-200 rounded animate-pulse mb-1"></div>
                        <div className="h-5 bg-gray-200 rounded animate-pulse w-2/3"></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}