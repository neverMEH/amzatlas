import React, { useState } from 'react';
import { Header } from './components/Header';
import { ProductList } from './components/ProductList';
import { DateRangeSelector } from './components/DateRangeSelector';
import { KpiModules } from './components/KpiModules';
import { SearchQueryList } from './components/SearchQueryList';
export function App() {
  // State to track if comparison is enabled
  const [showComparison, setShowComparison] = useState(false);
  // Handler for when comparison is toggled
  const handleComparisonChange = isEnabled => {
    setShowComparison(isEnabled);
  };
  return <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <DateRangeSelector onComparisonChange={handleComparisonChange} />
        <KpiModules showComparison={showComparison} />
        <ProductList showComparison={showComparison} />
        <SearchQueryList showComparison={showComparison} />
      </main>
    </div>;
}