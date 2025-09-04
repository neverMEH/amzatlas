import React, { useState } from 'react';
import { FilterIcon } from 'lucide-react';
import { ProductListItem } from './ProductListItem';
export const ProductList = ({
  showComparison
}) => {
  const [products] = useState([{
    id: '#ZB1011',
    name: 'Dell XPS 15',
    childAsin: 'B07HNDY9PX',
    impressions: 2450,
    impressionsComparison: 8.3,
    clicks: 385,
    clicksComparison: 12.5,
    cartAdds: 65,
    cartAddsComparison: -3.8,
    purchases: 45,
    purchasesComparison: 15.2,
    ctr: '15.7%',
    ctrComparison: 4.2,
    cvr: '11.7%',
    cvrComparison: -2.1,
    impressionShare: '32%',
    impressionShareComparison: 5.8,
    cvrShare: '28%',
    cvrShareComparison: 3.2,
    ctrShare: '35%',
    ctrShareComparison: 7.5,
    cartAddShare: '30%',
    cartAddShareComparison: -1.3,
    purchaseShare: '25%',
    purchaseShareComparison: 2.8,
    image: "/pasted-image.jpg"
  }, {
    id: '#ZB2052',
    name: 'Apple iPhone 15 Pro',
    childAsin: 'B0CHX3QBCH',
    impressions: 3800,
    impressionsComparison: 14.2,
    clicks: 720,
    clicksComparison: 9.7,
    cartAdds: 95,
    cartAddsComparison: 5.3,
    purchases: 61,
    purchasesComparison: -2.1,
    ctr: '18.9%',
    ctrComparison: -4.5,
    cvr: '8.5%',
    cvrComparison: -7.2,
    impressionShare: '45%',
    impressionShareComparison: 12.3,
    cvrShare: '22%',
    cvrShareComparison: -2.8,
    ctrShare: '40%',
    ctrShareComparison: 8.9,
    cartAddShare: '35%',
    cartAddShareComparison: 4.6,
    purchaseShare: '30%',
    purchaseShareComparison: 5.1,
    image: "/pasted-image.jpg"
  }, {
    id: '#ZB3013',
    name: 'Samsung Galaxy S23',
    childAsin: 'B0BLP45GY8',
    impressions: 5200,
    impressionsComparison: -1.8,
    clicks: 890,
    clicksComparison: -0.5,
    cartAdds: 210,
    cartAddsComparison: 7.9,
    purchases: 120,
    purchasesComparison: 11.3,
    ctr: '17.1%',
    ctrComparison: 1.3,
    cvr: '13.5%',
    cvrComparison: 3.5,
    impressionShare: '38%',
    impressionShareComparison: -2.4,
    cvrShare: '42%',
    cvrShareComparison: 6.7,
    ctrShare: '30%',
    ctrShareComparison: -1.9,
    cartAddShare: '45%',
    cartAddShareComparison: 9.2,
    purchaseShare: '40%',
    purchaseShareComparison: 7.8,
    image: "/pasted-image.jpg"
  }, {
    id: '#ZB7014',
    name: 'Logitech MX Master 3S',
    childAsin: 'B09HM94VDS',
    impressions: 4100,
    impressionsComparison: 22.5,
    clicks: 1050,
    clicksComparison: 18.3,
    cartAdds: 350,
    cartAddsComparison: 9.4,
    purchases: 200,
    purchasesComparison: 13.7,
    ctr: '25.6%',
    ctrComparison: -3.2,
    cvr: '19.0%',
    cvrComparison: 4.3,
    impressionShare: '20%',
    impressionShareComparison: -5.6,
    cvrShare: '48%',
    cvrShareComparison: 10.5,
    ctrShare: '52%',
    ctrShareComparison: 15.7,
    cartAddShare: '38%',
    cartAddShareComparison: 6.9,
    purchaseShare: '35%',
    purchaseShareComparison: 4.2,
    image: "/pasted-image.jpg"
  }, {
    id: '#ZB9015',
    name: 'Asus ROG Gaming PC',
    childAsin: 'B09RCVFVDP',
    impressions: 1800,
    impressionsComparison: -5.2,
    clicks: 320,
    clicksComparison: -8.1,
    cartAdds: 60,
    cartAddsComparison: -12.3,
    purchases: 35,
    purchasesComparison: -7.5,
    ctr: '17.8%',
    ctrComparison: -2.9,
    cvr: '10.9%',
    cvrComparison: 5.1,
    impressionShare: '15%',
    impressionShareComparison: -8.7,
    cvrShare: '25%',
    cvrShareComparison: -4.3,
    ctrShare: '28%',
    ctrShareComparison: -6.2,
    cartAddShare: '20%',
    cartAddShareComparison: -9.8,
    purchaseShare: '18%',
    purchaseShareComparison: -5.4,
    image: "/pasted-image.jpg"
  }, {
    id: '#ZB8016',
    name: 'ASUS Zenfone 10',
    childAsin: 'B0C7VMKR5H',
    impressions: 2900,
    impressionsComparison: 4.3,
    clicks: 540,
    clicksComparison: 6.8,
    cartAdds: 120,
    cartAddsComparison: 3.2,
    purchases: 75,
    purchasesComparison: 5.7,
    ctr: '18.6%',
    ctrComparison: 2.4,
    cvr: '13.9%',
    cvrComparison: 2.5,
    impressionShare: '25%',
    impressionShareComparison: 1.8,
    cvrShare: '32%',
    cvrShareComparison: 3.9,
    ctrShare: '33%',
    ctrShareComparison: 4.6,
    cartAddShare: '28%',
    cartAddShareComparison: 2.1,
    purchaseShare: '24%',
    purchaseShareComparison: 1.5,
    image: "/pasted-image.jpg"
  }, {
    id: '#ZB8017',
    name: 'AirPods Pro (2nd Gen)',
    childAsin: 'B0BDHWDR12',
    impressions: 3500,
    impressionsComparison: 10.6,
    clicks: 680,
    clicksComparison: 15.2,
    cartAdds: 180,
    cartAddsComparison: 8.9,
    purchases: 95,
    purchasesComparison: 6.3,
    ctr: '19.4%',
    ctrComparison: 4.3,
    cvr: '14.0%',
    cvrComparison: -2.6,
    impressionShare: '30%',
    impressionShareComparison: 3.5,
    cvrShare: '35%',
    cvrShareComparison: 5.2,
    ctrShare: '38%',
    ctrShareComparison: 7.4,
    cartAddShare: '32%',
    cartAddShareComparison: 4.8,
    purchaseShare: '28%',
    purchaseShareComparison: 2.9,
    image: "/pasted-image.jpg"
  }]);
  return <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Product List
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
                  Product Name
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Child ASIN
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
              {products.map((product, index) => <ProductListItem key={index} product={product} showComparison={showComparison} />)}
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