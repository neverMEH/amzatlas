import React from 'react'
import { ComparisonIndicator } from './ComparisonIndicator'

interface SearchQuery {
  id: number
  query: string
  impressions: number
  impressionsComparison?: number
  clicks: number
  clicksComparison?: number
  cartAdds: number
  cartAddsComparison?: number
  purchases: number
  purchasesComparison?: number
  ctr: string
  ctrComparison?: number
  cvr: string
  cvrComparison?: number
  impressionShare: string
  impressionShareComparison?: number
  cvrShare: string
  cvrShareComparison?: number
  ctrShare: string
  ctrShareComparison?: number
  cartAddShare: string
  cartAddShareComparison?: number
  purchaseShare: string
  purchaseShareComparison?: number
}

interface SearchQueryListItemProps {
  query: SearchQuery
  showComparison: boolean
  onSelect?: (checked: boolean) => void
}

export const SearchQueryListItem: React.FC<SearchQueryListItemProps> = ({
  query,
  showComparison,
  onSelect,
}) => {
  const getShareClass = (value: string) => {
    const numValue = parseInt(value)
    if (numValue >= 40) return 'text-green-600 bg-green-50'
    if (numValue >= 25) return 'text-blue-600 bg-blue-50'
    return 'text-yellow-600 bg-yellow-50'
  }

  const handleCheckboxClick = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    onSelect?.(e.target.checked)
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          onChange={handleCheckboxClick}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {query.query}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">
          {query.impressions.toLocaleString()}
        </div>
        {showComparison && query.impressionsComparison !== undefined && (
          <ComparisonIndicator value={query.impressionsComparison} />
        )}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">
          {query.clicks.toLocaleString()}
        </div>
        {showComparison && query.clicksComparison !== undefined && (
          <ComparisonIndicator value={query.clicksComparison} />
        )}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">
          {query.cartAdds.toLocaleString()}
        </div>
        {showComparison && query.cartAddsComparison !== undefined && (
          <ComparisonIndicator value={query.cartAddsComparison} />
        )}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">
          {query.purchases.toLocaleString()}
        </div>
        {showComparison && query.purchasesComparison !== undefined && (
          <ComparisonIndicator value={query.purchasesComparison} />
        )}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">{query.ctr}</div>
        {showComparison && query.ctrComparison !== undefined && (
          <ComparisonIndicator value={query.ctrComparison} />
        )}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">{query.cvr}</div>
        {showComparison && query.cvrComparison !== undefined && (
          <ComparisonIndicator value={query.cvrComparison} />
        )}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(query.impressionShare)}`}>
            {query.impressionShare}
          </span>
          {showComparison && query.impressionShareComparison !== undefined && (
            <ComparisonIndicator value={query.impressionShareComparison} size="sm" />
          )}
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(query.cvrShare)}`}>
            {query.cvrShare}
          </span>
          {showComparison && query.cvrShareComparison !== undefined && (
            <ComparisonIndicator value={query.cvrShareComparison} size="sm" />
          )}
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(query.ctrShare)}`}>
            {query.ctrShare}
          </span>
          {showComparison && query.ctrShareComparison !== undefined && (
            <ComparisonIndicator value={query.ctrShareComparison} size="sm" />
          )}
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(query.cartAddShare)}`}>
            {query.cartAddShare}
          </span>
          {showComparison && query.cartAddShareComparison !== undefined && (
            <ComparisonIndicator value={query.cartAddShareComparison} size="sm" />
          )}
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(query.purchaseShare)}`}>
            {query.purchaseShare}
          </span>
          {showComparison && query.purchaseShareComparison !== undefined && (
            <ComparisonIndicator value={query.purchaseShareComparison} size="sm" />
          )}
        </div>
      </td>
    </tr>
  )
}