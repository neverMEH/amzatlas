'use client'

import { ChevronUp, ChevronDown } from 'lucide-react'

interface TableWidgetProps {
  title: string
  description?: string
}

// Placeholder data - will be replaced with real data
const tableData = [
  {
    keyword: 'wireless earbuds',
    purchases: 342,
    marketPurchases: 1456,
    share: 23.5,
    cvr: 4.2,
    spend: 1250,
    roi: 285,
    trend: 'up',
  },
  {
    keyword: 'bluetooth headphones',
    purchases: 287,
    marketPurchases: 1823,
    share: 15.7,
    cvr: 3.8,
    spend: 980,
    roi: 245,
    trend: 'up',
  },
  {
    keyword: 'noise cancelling earbuds',
    purchases: 198,
    marketPurchases: 921,
    share: 21.5,
    cvr: 5.1,
    spend: 560,
    roi: 320,
    trend: 'down',
  },
  {
    keyword: 'sports earphones',
    purchases: 156,
    marketPurchases: 1102,
    share: 14.2,
    cvr: 2.9,
    spend: 890,
    roi: 165,
    trend: 'up',
  },
  {
    keyword: 'wireless headset',
    purchases: 134,
    marketPurchases: 867,
    share: 15.5,
    cvr: 3.3,
    spend: 445,
    roi: 290,
    trend: 'down',
  },
]

export default function TableWidget({ title, description }: TableWidgetProps) {
  return (
    <div className="h-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">{title}</h3>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead>
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Keyword
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Purchases
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Market Share
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                CVR
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Spend
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                ROI
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Trend
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {tableData.map((row) => (
              <tr key={row.keyword} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                  {row.keyword}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                  {row.purchases.toLocaleString()}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                  {row.share}%
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                  {row.cvr}%
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">
                  ${row.spend.toLocaleString()}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-right font-medium text-success-600 dark:text-success-400">
                  {row.roi}%
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-center">
                  {row.trend === 'up' ? (
                    <ChevronUp className="h-4 w-4 text-success-600 dark:text-success-400 inline" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-error-600 dark:text-error-400 inline" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}