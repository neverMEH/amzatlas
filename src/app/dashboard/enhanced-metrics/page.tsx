'use client';

import { useState } from 'react';
import { EnhancedMetricsDashboard } from '@/components/dashboard/enhanced-metrics-dashboard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Package } from 'lucide-react';

export default function EnhancedMetricsPage() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  
  const [selectedASINs, setSelectedASINs] = useState<string[]>([]);
  const [asinInput, setAsinInput] = useState('');

  const handleAddASIN = () => {
    if (asinInput && !selectedASINs.includes(asinInput)) {
      setSelectedASINs([...selectedASINs, asinInput]);
      setAsinInput('');
    }
  };

  const handleRemoveASIN = (asin: string) => {
    setSelectedASINs(selectedASINs.filter(a => a !== asin));
  };

  const quickDateRanges = [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 14 days', days: 14 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Enhanced SQP Metrics Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Comprehensive search query performance analysis with market context, funnel metrics, and pricing insights
          </p>
        </div>

        {/* Controls */}
        <Card className="p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date Range Selection */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                Date Range
              </h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  {quickDateRanges.map(range => (
                    <Button
                      key={range.days}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const end = new Date();
                        const start = new Date(end.getTime() - range.days * 24 * 60 * 60 * 1000);
                        setDateRange({
                          startDate: start.toISOString().split('T')[0],
                          endDate: end.toISOString().split('T')[0]
                        });
                      }}
                    >
                      {range.label}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                    className="px-3 py-2 border rounded-md text-sm"
                  />
                  <span className="self-center">to</span>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                    className="px-3 py-2 border rounded-md text-sm"
                  />
                </div>
              </div>
            </div>

            {/* ASIN Selection */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <Package className="w-4 h-4 mr-2" />
                ASINs (Optional)
              </h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter ASIN (e.g., B08N5WRWNW)"
                    value={asinInput}
                    onChange={(e) => setAsinInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddASIN()}
                    className="flex-1 px-3 py-2 border rounded-md text-sm"
                  />
                  <Button onClick={handleAddASIN} size="sm">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedASINs.map(asin => (
                    <span
                      key={asin}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                    >
                      {asin}
                      <button
                        onClick={() => handleRemoveASIN(asin)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {selectedASINs.length === 0 && (
                    <span className="text-sm text-gray-500">
                      No ASINs selected (will show all data)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Dashboard */}
        <EnhancedMetricsDashboard
          asins={selectedASINs}
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
        />
      </div>
    </div>
  );
}