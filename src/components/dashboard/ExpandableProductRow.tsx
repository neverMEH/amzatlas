import React, { useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, Calendar } from 'lucide-react'
import { ComparisonIndicator } from './ComparisonIndicator'
import { DateSegmentTable } from './DateSegmentTable'
// Using CSS transitions instead of framer-motion for now

interface Product {
  asin: string
  productName: string
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
  clickShare: number
  cartAddShare: number
  purchaseShare: number
  segmentMetadata?: {
    weeklySegmentsAvailable: number
    monthlySegmentsAvailable: number
    hasWeeklyData: boolean
    hasMonthlyData: boolean
    dateRange: {
      earliest: number
      latest: number
    }
  }
}

interface ExpandableProductRowProps {
  product: Product
  showComparison: boolean
  onSelect?: (checked: boolean) => void
  onClick?: (asin: string) => void
  isExpanded: boolean
  onToggleExpand: (asin: string) => void
  brandId: string
  dateRange?: {
    startDate: string
    endDate: string
  }
  comparisonDateRange?: {
    startDate: string
    endDate: string
  }
}

export const ExpandableProductRow: React.FC<ExpandableProductRowProps> = ({
  product,
  showComparison,
  onSelect,
  onClick,
  isExpanded,
  onToggleExpand,
  brandId,
  dateRange,
  comparisonDateRange
}) => {
  const [selectedSegmentType, setSelectedSegmentType] = useState<'weekly' | 'monthly'>('weekly')

  const getShareClass = (value: number) => {
    if (value >= 40) return 'text-green-600 bg-green-50'
    if (value >= 25) return 'text-blue-600 bg-blue-50'
    return 'text-yellow-600 bg-yellow-50'
  }

  const handleCheckboxClick = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    onSelect?.(e.target.checked)
  }

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't trigger row click if checkbox or expand button was clicked
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.closest('[data-expand-button]')) {
      return
    }
    onClick?.(product.asin)
  }

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleExpand(product.asin)
  }

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

  const hasSegmentData = product.segmentMetadata && 
    (product.segmentMetadata.hasWeeklyData || product.segmentMetadata.hasMonthlyData)

  const canExpand = hasSegmentData && (
    (selectedSegmentType === 'weekly' && product.segmentMetadata?.hasWeeklyData) ||
    (selectedSegmentType === 'monthly' && product.segmentMetadata?.hasMonthlyData)
  )

  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={handleRowClick}>
        <td className="px-3 py-4 whitespace-nowrap">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            onChange={handleCheckboxClick}
            onClick={(e) => e.stopPropagation()}
          />
        </td>
        <td className="px-3 py-4 whitespace-nowrap">
          <div className="flex items-center">
            {canExpand && (
              <button
                data-expand-button
                onClick={handleExpandClick}
                className="mr-2 p-1 hover:bg-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={isExpanded ? 'Collapse segments' : 'Expand segments'}
              >
                {isExpanded ? (
                  <ChevronDown size={16} className="text-gray-500" />
                ) : (
                  <ChevronRight size={16} className="text-gray-500" />
                )}
              </button>
            )}
            <div className="flex-shrink-0 h-8 w-8 mr-3">
              <div className="h-8 w-8 rounded bg-gray-200 flex items-center justify-center">
                <span className="text-xs font-medium text-gray-600">
                  {product.asin.slice(-4)}
                </span>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">
                {product.productName || product.asin}
              </div>
              <div className="text-xs text-gray-500">
                {product.asin}
              </div>
            </div>
          </div>
        </td>
        <td className="px-3 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900">
            {formatNumber(product.impressions)}
          </div>
          {showComparison && product.impressionsComparison !== undefined && (
            <ComparisonIndicator value={product.impressionsComparison} />
          )}
        </td>
        <td className="px-3 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900">
            {formatNumber(product.clicks)}
          </div>
          {showComparison && product.clicksComparison !== undefined && (
            <ComparisonIndicator value={product.clicksComparison} />
          )}
        </td>
        <td className="px-3 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900">
            {formatNumber(product.cartAdds)}
          </div>
          {showComparison && product.cartAddsComparison !== undefined && (
            <ComparisonIndicator value={product.cartAddsComparison} />
          )}
        </td>
        <td className="px-3 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900">
            {formatNumber(product.purchases)}
          </div>
          {showComparison && product.purchasesComparison !== undefined && (
            <ComparisonIndicator value={product.purchasesComparison} />
          )}
        </td>
        <td className="px-3 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900">{formatPercentage(product.ctr)}</div>
          {showComparison && product.ctrComparison !== undefined && (
            <ComparisonIndicator value={product.ctrComparison} />
          )}
        </td>
        <td className="px-3 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900">{formatPercentage(product.cvr)}</div>
          {showComparison && product.cvrComparison !== undefined && (
            <ComparisonIndicator value={product.cvrComparison} />
          )}
        </td>
        <td className="px-3 py-4 whitespace-nowrap">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(product.clickShare)}`}>
            {formatPercentage(product.clickShare / 100)}
          </span>
        </td>
        <td className="px-3 py-4 whitespace-nowrap">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(product.cartAddShare)}`}>
            {formatPercentage(product.cartAddShare / 100)}
          </span>
        </td>
        <td className="px-3 py-4 whitespace-nowrap">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(product.purchaseShare)}`}>
            {formatPercentage(product.purchaseShare / 100)}
          </span>
        </td>
        <td className="px-3 py-4 whitespace-nowrap">
          <div className="flex items-center space-x-2">
            {hasSegmentData && (
              <div className="flex items-center text-xs text-gray-500">
                <Calendar size={12} className="mr-1" />
                <span>
                  {product.segmentMetadata?.weeklySegmentsAvailable}W,{' '}
                  {product.segmentMetadata?.monthlySegmentsAvailable}M
                </span>
              </div>
            )}
          </div>
        </td>
      </tr>
      
      {isExpanded && canExpand && (
        <tr>
          <td colSpan={12} className="px-0 py-0 bg-gray-50">
            <div 
              className={`transition-all duration-300 ease-in-out overflow-hidden ${
                isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="p-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-gray-900">
                    Date Segments for {product.productName || product.asin}
                  </h4>
                  <div className="flex items-center space-x-2">
                    <label className="text-xs text-gray-500">View:</label>
                    <select
                      value={selectedSegmentType}
                      onChange={(e) => setSelectedSegmentType(e.target.value as 'weekly' | 'monthly')}
                      className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {product.segmentMetadata?.hasWeeklyData && (
                        <option value="weekly">Weekly ({product.segmentMetadata.weeklySegmentsAvailable})</option>
                      )}
                      {product.segmentMetadata?.hasMonthlyData && (
                        <option value="monthly">Monthly ({product.segmentMetadata.monthlySegmentsAvailable})</option>
                      )}
                    </select>
                  </div>
                </div>
                
                <DateSegmentTable
                  brandId={brandId}
                  asin={product.asin}
                  segmentType={selectedSegmentType}
                  dateRange={dateRange}
                  comparisonDateRange={comparisonDateRange}
                  showComparison={showComparison}
                />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}