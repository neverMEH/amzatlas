'use client'

import { Database, Layers, Tag, ChartBar, Archive, X } from 'lucide-react'
import { useState } from 'react'

interface Category {
  id: string
  label: string
  count: number
  description?: string
  health?: 'healthy' | 'warning' | 'error'
}

interface TableCategoryFilterProps {
  categories: Category[]
  selectedCategory: string
  onCategoryChange: (category: string) => void
  compact?: boolean
}

export function TableCategoryFilter({ 
  categories, 
  selectedCategory, 
  onCategoryChange,
  compact = false 
}: TableCategoryFilterProps) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)

  const getCategoryIcon = (id: string) => {
    switch (id) {
      case 'all':
        return <Layers className="w-4 h-4" data-testid="icon-all" />
      case 'core':
        return <Database className="w-4 h-4" data-testid="icon-core" />
      case 'brand':
        return <Tag className="w-4 h-4" data-testid="icon-brand" />
      case 'reporting':
        return <ChartBar className="w-4 h-4" data-testid="icon-reporting" />
      case 'legacy':
        return <Archive className="w-4 h-4" data-testid="icon-legacy" />
      default:
        return <Layers className="w-4 h-4" />
    }
  }

  const getHealthIndicator = (health?: string) => {
    if (!health) return null
    
    return (
      <div className={`w-2 h-2 rounded-full ${
        health === 'healthy' ? 'bg-green-500' :
        health === 'warning' ? 'bg-yellow-500' :
        'bg-red-500'
      }`} />
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    if (e.key === 'ArrowRight' && currentIndex < categories.length - 1) {
      const nextCategory = categories[currentIndex + 1]
      const nextButton = document.getElementById(`category-btn-${nextCategory.id}`)
      nextButton?.focus()
    } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
      const prevCategory = categories[currentIndex - 1]
      const prevButton = document.getElementById(`category-btn-${prevCategory.id}`)
      prevButton?.focus()
    } else if (e.key === 'Enter') {
      const category = categories[currentIndex]
      if (category.count > 0) {
        onCategoryChange(category.id)
      }
    }
  }

  return (
    <div>
      {/* Filter Buttons */}
      <div 
        className={`flex gap-2 ${compact ? 'flex-wrap' : ''}`}
        data-testid={compact ? 'category-filter-compact' : 'category-filter'}
      >
        {categories.map((category, index) => (
          <div key={category.id} className="relative">
            <button
              id={`category-btn-${category.id}`}
              onClick={() => category.count > 0 && onCategoryChange(category.id)}
              onMouseEnter={() => setHoveredCategory(category.id)}
              onMouseLeave={() => setHoveredCategory(null)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              disabled={category.count === 0}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
                ${selectedCategory === category.id
                  ? 'bg-blue-100 text-blue-700 border-blue-300'
                  : category.count === 0
                  ? 'bg-gray-50 text-gray-400 border-gray-200 opacity-50 cursor-not-allowed'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                }
              `}
            >
              {getCategoryIcon(category.id)}
              <span className="text-sm font-medium">{category.label}</span>
              <span className="text-xs text-gray-500">({category.count})</span>
              {getHealthIndicator(category.health)}
            </button>

            {/* Tooltip */}
            {hoveredCategory === category.id && category.description && (
              <div className="absolute z-10 bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-3 py-2 bg-gray-900 text-white text-xs rounded-md shadow-lg whitespace-nowrap">
                {category.description}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Active Filter Indicator */}
      {selectedCategory !== 'all' && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <span>Filtered: {categories.find(c => c.id === selectedCategory)?.label}</span>
          <button
            onClick={() => onCategoryChange('all')}
            className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
            data-testid="clear-filter"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        </div>
      )}
    </div>
  )
}