import React from 'react';
import { ComparisonIndicator } from './ComparisonIndicator';
export const ProductListItem = ({
  product,
  showComparison
}) => {
  const getShareClass = value => {
    const numValue = parseInt(value);
    if (numValue >= 40) return 'text-green-600 bg-green-50';
    if (numValue >= 25) return 'text-blue-600 bg-blue-50';
    return 'text-yellow-600 bg-yellow-50';
  };
  return <tr className="hover:bg-gray-50">
      <td className="px-3 py-4 whitespace-nowrap">
        <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-8 w-8">
            <img className="h-8 w-8 rounded object-cover" src={product.image} alt="" />
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
        {showComparison && <ComparisonIndicator value={product.impressionsComparison} />}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">
          {product.clicks.toLocaleString()}
        </div>
        {showComparison && <ComparisonIndicator value={product.clicksComparison} />}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">
          {product.cartAdds.toLocaleString()}
        </div>
        {showComparison && <ComparisonIndicator value={product.cartAddsComparison} />}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">
          {product.purchases.toLocaleString()}
        </div>
        {showComparison && <ComparisonIndicator value={product.purchasesComparison} />}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">{product.ctr}</div>
        {showComparison && <ComparisonIndicator value={product.ctrComparison} />}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">{product.cvr}</div>
        {showComparison && <ComparisonIndicator value={product.cvrComparison} />}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(product.impressionShare)}`}>
            {product.impressionShare}
          </span>
          {showComparison && <ComparisonIndicator value={product.impressionShareComparison} size="sm" />}
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(product.cvrShare)}`}>
            {product.cvrShare}
          </span>
          {showComparison && <ComparisonIndicator value={product.cvrShareComparison} size="sm" />}
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(product.ctrShare)}`}>
            {product.ctrShare}
          </span>
          {showComparison && <ComparisonIndicator value={product.ctrShareComparison} size="sm" />}
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(product.cartAddShare)}`}>
            {product.cartAddShare}
          </span>
          {showComparison && <ComparisonIndicator value={product.cartAddShareComparison} size="sm" />}
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(product.purchaseShare)}`}>
            {product.purchaseShare}
          </span>
          {showComparison && <ComparisonIndicator value={product.purchaseShareComparison} size="sm" />}
        </div>
      </td>
    </tr>;
};