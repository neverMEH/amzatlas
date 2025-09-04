import React from 'react'
import { ComparisonIndicator } from './ComparisonIndicator'

interface Product {
  id: string
  name: string
  childAsin: string
  image: string
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

interface ProductListItemProps {
  product: Product
  showComparison: boolean
  onSelect?: (checked: boolean) => void
  onClick?: () => void
}

export const ProductListItem: React.FC<ProductListItemProps> = ({
  product,
  showComparison,
  onSelect,
  onClick,
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

  const handleRowClick = (e: React.MouseEvent) => {
    // Don't trigger row click if checkbox was clicked
    if ((e.target as HTMLElement).tagName === 'INPUT') return
    onClick?.()
  }

  return (
    <tr className="hover:bg-gray-50" onClick={handleRowClick}>
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
          <div className="flex-shrink-0 h-8 w-8">
            <img 
              className="h-8 w-8 rounded object-cover" 
              src={product.image} 
              alt={product.name}
            />
          </div>
          <div className="ml-3">
            <div className="text-sm font-medium text-gray-900">
              {product.name}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {product.childAsin}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">
          {product.impressions.toLocaleString()}
        </div>
        {showComparison && product.impressionsComparison !== undefined && (
          <ComparisonIndicator value={product.impressionsComparison} />
        )}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">
          {product.clicks.toLocaleString()}
        </div>
        {showComparison && product.clicksComparison !== undefined && (
          <ComparisonIndicator value={product.clicksComparison} />
        )}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">
          {product.cartAdds.toLocaleString()}
        </div>
        {showComparison && product.cartAddsComparison !== undefined && (
          <ComparisonIndicator value={product.cartAddsComparison} />
        )}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">
          {product.purchases.toLocaleString()}
        </div>
        {showComparison && product.purchasesComparison !== undefined && (
          <ComparisonIndicator value={product.purchasesComparison} />
        )}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">{product.ctr}</div>
        {showComparison && product.ctrComparison !== undefined && (
          <ComparisonIndicator value={product.ctrComparison} />
        )}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">{product.cvr}</div>
        {showComparison && product.cvrComparison !== undefined && (
          <ComparisonIndicator value={product.cvrComparison} />
        )}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(product.impressionShare)}`}>
            {product.impressionShare}
          </span>
          {showComparison && product.impressionShareComparison !== undefined && (
            <ComparisonIndicator value={product.impressionShareComparison} size="sm" />
          )}
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(product.cvrShare)}`}>
            {product.cvrShare}
          </span>
          {showComparison && product.cvrShareComparison !== undefined && (
            <ComparisonIndicator value={product.cvrShareComparison} size="sm" />
          )}
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(product.ctrShare)}`}>
            {product.ctrShare}
          </span>
          {showComparison && product.ctrShareComparison !== undefined && (
            <ComparisonIndicator value={product.ctrShareComparison} size="sm" />
          )}
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(product.cartAddShare)}`}>
            {product.cartAddShare}
          </span>
          {showComparison && product.cartAddShareComparison !== undefined && (
            <ComparisonIndicator value={product.cartAddShareComparison} size="sm" />
          )}
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(product.purchaseShare)}`}>
            {product.purchaseShare}
          </span>
          {showComparison && product.purchaseShareComparison !== undefined && (
            <ComparisonIndicator value={product.purchaseShareComparison} size="sm" />
          )}
        </div>
      </td>
    </tr>
  )
}