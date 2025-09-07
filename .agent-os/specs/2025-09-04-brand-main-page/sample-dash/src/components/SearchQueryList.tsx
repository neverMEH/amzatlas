import React, { useState } from 'react';
import { FilterIcon } from 'lucide-react';
import { SearchQueryListItem } from './SearchQueryListItem';
export const SearchQueryList = ({
  showComparison
}) => {
  const [searchQueries] = useState([{
    id: 1,
    query: 'laptop',
    impressions: 8500,
    impressionsComparison: 12.3,
    clicks: 1250,
    clicksComparison: 8.7,
    cartAdds: 185,
    cartAddsComparison: 5.2,
    purchases: 95,
    purchasesComparison: 7.8,
    ctr: '14.7%',
    ctrComparison: -3.6,
    cvr: '7.6%',
    cvrComparison: 2.1,
    impressionShare: '45%',
    impressionShareComparison: 8.5,
    cvrShare: '32%',
    cvrShareComparison: 4.7,
    ctrShare: '38%',
    ctrShareComparison: 6.2,
    cartAddShare: '35%',
    cartAddShareComparison: 3.8,
    purchaseShare: '30%',
    purchaseShareComparison: 5.3
  }, {
    id: 2,
    query: 'smartphone',
    impressions: 12300,
    impressionsComparison: 15.8,
    clicks: 2450,
    clicksComparison: 10.2,
    cartAdds: 320,
    cartAddsComparison: 7.5,
    purchases: 180,
    purchasesComparison: 9.3,
    ctr: '19.9%',
    ctrComparison: -5.6,
    cvr: '7.3%',
    cvrComparison: -1.8,
    impressionShare: '52%',
    impressionShareComparison: 10.7,
    cvrShare: '28%',
    cvrShareComparison: -2.5,
    ctrShare: '45%',
    ctrShareComparison: 8.9,
    cartAddShare: '42%',
    cartAddShareComparison: 6.4,
    purchaseShare: '38%',
    purchaseShareComparison: 7.2
  }, {
    id: 3,
    query: 'wireless headphones',
    impressions: 6800,
    impressionsComparison: 9.5,
    clicks: 1050,
    clicksComparison: 12.8,
    cartAdds: 210,
    cartAddsComparison: 6.3,
    purchases: 120,
    purchasesComparison: 8.1,
    ctr: '15.4%',
    ctrComparison: 3.2,
    cvr: '11.4%',
    cvrComparison: -4.5,
    impressionShare: '38%',
    impressionShareComparison: 5.2,
    cvrShare: '40%',
    cvrShareComparison: 7.8,
    ctrShare: '32%',
    ctrShareComparison: 4.1,
    cartAddShare: '36%',
    cartAddShareComparison: 5.7,
    purchaseShare: '34%',
    purchaseShareComparison: 6.3
  }, {
    id: 4,
    query: 'gaming mouse',
    impressions: 5200,
    impressionsComparison: 7.2,
    clicks: 980,
    clicksComparison: 9.8,
    cartAdds: 175,
    cartAddsComparison: 4.5,
    purchases: 85,
    purchasesComparison: 6.7,
    ctr: '18.8%',
    ctrComparison: 2.6,
    cvr: '8.7%',
    cvrComparison: -1.9,
    impressionShare: '30%',
    impressionShareComparison: 3.5,
    cvrShare: '25%',
    cvrShareComparison: -2.8,
    ctrShare: '35%',
    ctrShareComparison: 5.1,
    cartAddShare: '28%',
    cartAddShareComparison: 2.3,
    purchaseShare: '22%',
    purchaseShareComparison: -1.5
  }, {
    id: 5,
    query: 'smart watch',
    impressions: 7500,
    impressionsComparison: 11.3,
    clicks: 1350,
    clicksComparison: 13.5,
    cartAdds: 240,
    cartAddsComparison: 8.2,
    purchases: 130,
    purchasesComparison: 9.6,
    ctr: '18.0%',
    ctrComparison: 2.2,
    cvr: '9.6%',
    cvrComparison: -3.8,
    impressionShare: '42%',
    impressionShareComparison: 7.5,
    cvrShare: '35%',
    cvrShareComparison: 4.2,
    ctrShare: '40%',
    ctrShareComparison: 6.8,
    cartAddShare: '38%',
    cartAddShareComparison: 5.9,
    purchaseShare: '32%',
    purchaseShareComparison: 4.7
  }, {
    id: 6,
    query: 'bluetooth speaker',
    impressions: 4800,
    impressionsComparison: 6.5,
    clicks: 850,
    clicksComparison: 8.9,
    cartAdds: 140,
    cartAddsComparison: 3.7,
    purchases: 75,
    purchasesComparison: 5.2,
    ctr: '17.7%',
    ctrComparison: 2.4,
    cvr: '8.8%',
    cvrComparison: -2.3,
    impressionShare: '25%',
    impressionShareComparison: 2.8,
    cvrShare: '22%',
    cvrShareComparison: -3.5,
    ctrShare: '28%',
    ctrShareComparison: 3.2,
    cartAddShare: '24%',
    cartAddShareComparison: 1.9,
    purchaseShare: '20%',
    purchaseShareComparison: -2.1
  }, {
    id: 7,
    query: 'mechanical keyboard',
    impressions: 3900,
    impressionsComparison: 5.8,
    clicks: 720,
    clicksComparison: 7.6,
    cartAdds: 130,
    cartAddsComparison: 2.9,
    purchases: 65,
    purchasesComparison: 4.3,
    ctr: '18.5%',
    ctrComparison: 1.8,
    cvr: '9.0%',
    cvrComparison: -3.2,
    impressionShare: '22%',
    impressionShareComparison: 1.5,
    cvrShare: '20%',
    cvrShareComparison: -4.2,
    ctrShare: '25%',
    ctrShareComparison: 2.7,
    cartAddShare: '22%',
    cartAddShareComparison: 1.4,
    purchaseShare: '18%',
    purchaseShareComparison: -3.6
  }]);
  return <div className="bg-white rounded-lg shadow-sm border border-gray-200 mt-6">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Search Query List
            </h1>
          </div>
          <div className="flex space-x-2">
            <button className="px-4 py-2 border border-gray-300 rounded-md flex items-center text-sm">
              <FilterIcon size={16} className="mr-2" />
              Filter
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                  <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Search Query
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Impressions
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Clicks
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cart Adds
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Purchases
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CTR
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CVR
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Impression Share
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CVR Share
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CTR Share
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cart Add Share
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Purchase Share
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {searchQueries.map(query => <SearchQueryListItem key={query.id} query={query} showComparison={showComparison} />)}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-700">Showing: 1-7</div>
          <div className="flex items-center space-x-2">
            <button className="px-3 py-1 border border-gray-300 rounded-md text-gray-500">
              &lt;
            </button>
            <button className="px-3 py-1 bg-gray-900 text-white rounded-md">
              1
            </button>
            <button className="px-3 py-1 border border-gray-300 rounded-md text-gray-500">
              &gt;
            </button>
          </div>
        </div>
      </div>
    </div>;
};