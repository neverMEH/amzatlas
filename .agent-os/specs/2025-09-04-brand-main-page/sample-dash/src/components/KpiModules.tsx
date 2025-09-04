import React, { Component } from 'react';
// Sample data for sparklines
const generateSampleData = (baseValue, variance) => {
  const data = [];
  for (let i = 0; i < 20; i++) {
    // Create some random but somewhat consistent data
    data.push(baseValue + Math.random() * variance - variance / 2);
  }
  return data;
};
const impressionsData = generateSampleData(3000, 1000);
const clicksData = generateSampleData(600, 200);
const cartAddsData = generateSampleData(150, 50);
const purchasesData = generateSampleData(80, 30);
// Function to generate sparkline path from data
const generateSparklinePath = (data, width, height) => {
  if (!data || data.length === 0) return '';
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1; // Avoid division by zero
  const xStep = width / (data.length - 1);
  return data.map((value, index) => {
    const x = index * xStep;
    const y = height - (value - min) / range * height;
    return `${index === 0 ? 'M' : 'L'} ${x},${y}`;
  }).join(' ');
};
// KPI Card Component
const KpiCard = ({
  title,
  value,
  data,
  comparison,
  positive = true,
  formatter = val => val.toLocaleString()
}) => {
  const sparklineWidth = 100;
  const sparklineHeight = 30;
  const path = generateSparklinePath(data, sparklineWidth, sparklineHeight);
  return <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        {comparison && <div className={`text-xs font-medium px-2 py-1 rounded-full ${comparison > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {comparison > 0 ? '+' : ''}
            {comparison}%
          </div>}
      </div>
      <div className="flex items-end justify-between">
        <div className="text-2xl font-semibold">{formatter(value)}</div>
        <div className="h-8">
          <svg width={sparklineWidth} height={sparklineHeight} className="overflow-visible">
            <path d={path} fill="none" stroke={positive ? '#3b82f6' : '#ef4444'} strokeWidth="1.5" />
          </svg>
        </div>
      </div>
    </div>;
};
export const KpiModules = ({
  showComparison = false
}) => {
  // In a real app, this data would come from props or a data fetch
  const metrics = [{
    title: 'Impressions',
    value: 24500,
    data: impressionsData,
    comparison: 12.3,
    positive: true
  }, {
    title: 'Clicks',
    value: 4585,
    data: clicksData,
    comparison: 8.7,
    positive: true
  }, {
    title: 'Cart Adds',
    value: 1080,
    data: cartAddsData,
    comparison: -3.2,
    positive: false
  }, {
    title: 'Purchases',
    value: 631,
    data: purchasesData,
    comparison: 15.4,
    positive: true
  }];
  return <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {metrics.map((metric, index) => <KpiCard key={index} title={metric.title} value={metric.value} data={metric.data} comparison={showComparison ? metric.comparison : null} positive={metric.positive} />)}
    </div>;
};