'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  FunnelChart, Funnel, LabelList
} from 'recharts';

interface EnhancedMetricsDashboardProps {
  asins?: string[];
  startDate: string;
  endDate: string;
}

export function EnhancedMetricsDashboard({ 
  asins = [], 
  startDate, 
  endDate 
}: EnhancedMetricsDashboardProps) {
  const [searchPerformance, setSearchPerformance] = useState<any[]>([]);
  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [marketShare, setMarketShare] = useState<any[]>([]);
  const [topQueries, setTopQueries] = useState<any[]>([]);
  const [priceAnalysis, setPriceAnalysis] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, [asins, startDate, endDate]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Fetch search performance
      const perfResponse = await fetch(
        `/api/dashboard/v2/search-performance?${new URLSearchParams({
          startDate,
          endDate,
          asins: asins.join(','),
          limit: '50'
        })}`
      );
      const perfData = await perfResponse.json();
      setSearchPerformance(perfData.data || []);

      // Fetch funnel analysis
      if (asins.length > 0) {
        const funnelResponse = await fetch(
          `/api/dashboard/v2/funnel-analysis?${new URLSearchParams({
            startDate,
            endDate,
            asins: asins.join(',')
          })}`
        );
        const funnelResult = await funnelResponse.json();
        setFunnelData(funnelResult.funnel || []);
      }

      // Fetch top queries
      const queriesResponse = await fetch(
        `/api/dashboard/v2/top-queries?${new URLSearchParams({
          startDate,
          endDate,
          metric: 'volume',
          limit: '10'
        })}`
      );
      const queriesData = await queriesResponse.json();
      setTopQueries(queriesData.data || []);

      // Fetch market share for top query
      if (queriesData.data && queriesData.data.length > 0) {
        const topQuery = queriesData.data[0].searchQuery;
        const shareResponse = await fetch(
          `/api/dashboard/v2/market-share?${new URLSearchParams({
            startDate,
            endDate,
            searchQuery: topQuery,
            limit: '5'
          })}`
        );
        const shareData = await shareResponse.json();
        setMarketShare(shareData.data || []);
      }

      // Fetch price analysis
      if (asins.length > 0) {
        const priceResponse = await fetch(
          `/api/dashboard/v2/price-analysis?${new URLSearchParams({
            startDate,
            endDate,
            asins: asins.join(',')
          })}`
        );
        const priceData = await priceResponse.json();
        setPriceAnalysis(priceData);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  if (loading) {
    return <div className="p-8 text-center">Loading enhanced metrics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500">Total Impressions</h3>
          <p className="text-2xl font-bold">
            {searchPerformance.reduce((sum, item) => sum + item.impressions, 0).toLocaleString()}
          </p>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500">Total Clicks</h3>
          <p className="text-2xl font-bold">
            {searchPerformance.reduce((sum, item) => sum + item.clicks, 0).toLocaleString()}
          </p>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500">Total Cart Adds</h3>
          <p className="text-2xl font-bold">
            {searchPerformance.reduce((sum, item) => sum + item.cartAdds, 0).toLocaleString()}
          </p>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500">Total Purchases</h3>
          <p className="text-2xl font-bold">
            {searchPerformance.reduce((sum, item) => sum + item.purchases, 0).toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Conversion Funnel */}
      {funnelData.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Conversion Funnel</h2>
          <ResponsiveContainer width="100%" height={400}>
            <FunnelChart>
              <Tooltip />
              <Funnel
                dataKey="count"
                data={funnelData}
                isAnimationActive
              >
                <LabelList 
                  position="center" 
                  fill="#fff" 
                  formatter={(value: any) => {
                    const numValue = typeof value === 'number' ? value : parseFloat(value);
                    if (isNaN(numValue)) return '';
                    return `${numValue.toLocaleString()} (${funnelData.find(d => d.count === numValue)?.rate.toFixed(1)}%)`;
                  }}
                />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Search Queries */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Top Search Queries by Volume</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topQueries.slice(0, 10)} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="searchQuery" type="category" width={150} />
              <Tooltip />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Market Share Distribution */}
        {marketShare.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">
              Market Share for "{marketShare[0]?.searchQuery}"
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={marketShare}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.asin}: ${entry.marketShare.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="marketShare"
                >
                  {marketShare.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* Price Analysis */}
      {priceAnalysis.byAsin && priceAnalysis.byAsin.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Price Analysis by ASIN</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={priceAnalysis.byAsin}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="asin" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="avgClickPrice" fill="#8884d8" name="Avg Click Price" />
              <Bar dataKey="avgCartAddPrice" fill="#82ca9d" name="Avg Cart Add Price" />
              <Bar dataKey="avgPurchasePrice" fill="#ffc658" name="Avg Purchase Price" />
            </BarChart>
          </ResponsiveContainer>
          {priceAnalysis.summary && (
            <div className="mt-4 text-sm text-gray-600">
              <p>Average Price: ${priceAnalysis.summary.averagePrice?.toFixed(2) || 'N/A'}</p>
              <p>Price Competitiveness: {priceAnalysis.summary.competitivenessInterpretation}</p>
            </div>
          )}
        </Card>
      )}

      {/* Search Performance Details */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Detailed Search Performance</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Query</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ASIN</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Volume</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Impressions</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Clicks</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cart Adds</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Purchases</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">CTR</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">CVR</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Market Share</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {searchPerformance.slice(0, 20).map((item, index) => (
                <tr key={index}>
                  <td className="px-4 py-2 text-sm">{item.searchQuery}</td>
                  <td className="px-4 py-2 text-sm">{item.asin}</td>
                  <td className="px-4 py-2 text-sm text-right">{item.searchQueryVolume?.toLocaleString() || '-'}</td>
                  <td className="px-4 py-2 text-sm text-right">{item.impressions.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm text-right">{item.clicks.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm text-right">{item.cartAdds.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm text-right">{item.purchases.toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm text-right">{(item.ctr * 100).toFixed(2)}%</td>
                  <td className="px-4 py-2 text-sm text-right">{(item.conversionRate * 100).toFixed(2)}%</td>
                  <td className="px-4 py-2 text-sm text-right">{(item.purchaseShare * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}