#!/usr/bin/env node

import fetch from 'node-fetch';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function testAPIs() {
  console.log('Testing new BigQuery schema APIs...\n');
  
  // Test parameters
  const startDate = '2024-12-01';
  const endDate = '2024-12-07';
  const testASINs = ['B08N5WRWNW', 'B07X5F81L8']; // Example ASINs
  
  // API endpoints to test
  const endpoints = [
    {
      name: 'Search Performance',
      url: `/api/dashboard/v2/search-performance?startDate=${startDate}&endDate=${endDate}&limit=10`,
      description: 'Comprehensive search performance metrics'
    },
    {
      name: 'Top Queries',
      url: `/api/dashboard/v2/top-queries?startDate=${startDate}&endDate=${endDate}&metric=volume&limit=5`,
      description: 'Top search queries by volume'
    },
    {
      name: 'Funnel Analysis',
      url: `/api/dashboard/v2/funnel-analysis?startDate=${startDate}&endDate=${endDate}&asins=${testASINs.join(',')}`,
      description: 'Conversion funnel including cart adds'
    },
    {
      name: 'Market Share',
      url: `/api/dashboard/v2/market-share?startDate=${startDate}&endDate=${endDate}&searchQuery=test&limit=5`,
      description: 'Market share for a specific query'
    },
    {
      name: 'Price Analysis',
      url: `/api/dashboard/v2/price-analysis?startDate=${startDate}&endDate=${endDate}&asins=${testASINs.join(',')}`,
      description: 'Price competitiveness analysis'
    }
  ];
  
  // Test each endpoint
  for (const endpoint of endpoints) {
    console.log(`\nTesting: ${endpoint.name}`);
    console.log(`Description: ${endpoint.description}`);
    console.log(`URL: ${BASE_URL}${endpoint.url}`);
    
    try {
      const response = await fetch(`${BASE_URL}${endpoint.url}`);
      const data = await response.json();
      
      if (response.ok) {
        console.log('✅ Success!');
        const responseData = data as any;
        console.log(`Response summary:`, {
          status: response.status,
          dataCount: Array.isArray(responseData.data) ? responseData.data.length : 'N/A',
          hasSummary: !!responseData.summary,
          hasFilters: !!responseData.filters
        });
      } else {
        const responseData = data as any;
        console.log('❌ Error:', responseData.error || response.statusText);
      }
    } catch (error) {
      console.log('❌ Request failed:', error instanceof Error ? error.message : String(error));
    }
  }
  
  console.log('\nAPI testing complete!');
}

// Add node-fetch for Node.js environment
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

testAPIs().catch(console.error);