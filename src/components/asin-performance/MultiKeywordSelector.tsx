'use client'

import React, { useState, useMemo } from 'react'
import { Search, X, Check, AlertCircle } from 'lucide-react'

interface MultiKeywordSelectorProps {
  availableKeywords: string[]
  selectedKeywords: string[]
  onSelectionChange: (keywords: string[]) => void
  maxKeywords?: number
}

export function MultiKeywordSelector({
  availableKeywords,
  selectedKeywords,
  onSelectionChange,
  maxKeywords = 10,
}: MultiKeywordSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredKeywords = useMemo(() => {
    const term = searchTerm.toLowerCase()
    if (!term) return availableKeywords

    return availableKeywords.filter(keyword =>
      keyword.toLowerCase().includes(term)
    )
  }, [availableKeywords, searchTerm])

  const sortedKeywords = useMemo(() => {
    // Show selected keywords first
    const selected = filteredKeywords.filter(k => selectedKeywords.includes(k))
    const unselected = filteredKeywords.filter(k => !selectedKeywords.includes(k))
    return [...selected, ...unselected]
  }, [filteredKeywords, selectedKeywords])

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
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Select Keywords</h3>
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

        {/* Search input */}
        <div className="relative mb-4">
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
      </div>

      {/* Keyword list */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        <p className="text-sm text-gray-500 mb-2">
          {sortedKeywords.length} keywords available
        </p>
        {sortedKeywords.map((keyword) => {
          const isSelected = selectedKeywords.includes(keyword)
          const isDisabled = !isSelected && isAtMax

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
                p-3 rounded-lg border transition-all cursor-pointer
                ${isSelected 
                  ? 'bg-blue-50 border-blue-300 hover:bg-blue-100' 
                  : isDisabled
                    ? 'bg-gray-50 border-gray-200 cursor-not-allowed opacity-50'
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }
              `}
              role="button"
              tabIndex={isDisabled ? -1 : 0}
              aria-label={`${isSelected ? 'Deselect' : 'Select'} keyword: ${keyword}`}
              aria-pressed={isSelected}
            >
              <div className="flex items-center justify-between">
                <span className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                  {keyword}
                </span>
                {isSelected && (
                  <Check className="h-5 w-5 text-blue-600" data-testid="check-icon" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}