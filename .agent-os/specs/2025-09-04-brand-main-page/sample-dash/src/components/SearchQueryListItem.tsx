import React from 'react';
import { ComparisonIndicator } from './ComparisonIndicator';
export const SearchQueryListItem = ({
  query,
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
      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {query.query}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">
          {query.impressions.toLocaleString()}
        </div>
        {showComparison && <ComparisonIndicator value={query.impressionsComparison} />}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">
          {query.clicks.toLocaleString()}
        </div>
        {showComparison && <ComparisonIndicator value={query.clicksComparison} />}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">
          {query.cartAdds.toLocaleString()}
        </div>
        {showComparison && <ComparisonIndicator value={query.cartAddsComparison} />}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">
          {query.purchases.toLocaleString()}
        </div>
        {showComparison && <ComparisonIndicator value={query.purchasesComparison} />}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">{query.ctr}</div>
        {showComparison && <ComparisonIndicator value={query.ctrComparison} />}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-500">{query.cvr}</div>
        {showComparison && <ComparisonIndicator value={query.cvrComparison} />}
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(query.impressionShare)}`}>
            {query.impressionShare}
          </span>
          {showComparison && <ComparisonIndicator value={query.impressionShareComparison} size="sm" />}
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(query.cvrShare)}`}>
            {query.cvrShare}
          </span>
          {showComparison && <ComparisonIndicator value={query.cvrShareComparison} size="sm" />}
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(query.ctrShare)}`}>
            {query.ctrShare}
          </span>
          {showComparison && <ComparisonIndicator value={query.ctrShareComparison} size="sm" />}
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(query.cartAddShare)}`}>
            {query.cartAddShare}
          </span>
          {showComparison && <ComparisonIndicator value={query.cartAddShareComparison} size="sm" />}
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="flex flex-col items-start">
          <span className={`px-2 py-1 text-xs rounded-full ${getShareClass(query.purchaseShare)}`}>
            {query.purchaseShare}
          </span>
          {showComparison && <ComparisonIndicator value={query.purchaseShareComparison} size="sm" />}
        </div>
      </td>
    </tr>;
};