#!/usr/bin/env node

/**
 * Manual integration test for brand products API endpoints
 * Tests the new API routes we created for brand product segments
 */

const http = require('http');

// Assume the development server is running on localhost:3000
const BASE_URL = 'http://localhost:3000';

// Test brand ID from our existing data (Work Sharp)
const TEST_BRAND_ID = '123e4567-e89b-12d3-a456-426614174000';
const TEST_ASIN = 'B08N5WRWNW'; // Work Sharp Precision Adjust

async function makeRequest(path, description) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    console.log(`\n🔍 Testing: ${description}`);
    console.log(`   URL: ${url}`);
    
    const startTime = Date.now();
    
    http.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const duration = Date.now() - startTime;
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Duration: ${duration}ms`);
        
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            console.log(`   ✅ SUCCESS - Response has ${Object.keys(json).length} top-level keys`);
            
            // Log some key metrics
            if (json.data && json.data.products) {
              console.log(`   📊 Products returned: ${json.data.products.length}`);
            }
            if (json.data && json.data.segments) {
              console.log(`   📊 Segments returned: ${json.data.segments.length}`);
            }
            if (json.meta && json.meta.queryTime) {
              console.log(`   ⚡ Query time: ${json.meta.queryTime}ms`);
            }
            
            resolve({ success: true, status: res.statusCode, data: json, duration });
          } catch (e) {
            console.log(`   ❌ FAILED - Invalid JSON response`);
            resolve({ success: false, status: res.statusCode, error: 'Invalid JSON', duration });
          }
        } else {
          console.log(`   ❌ FAILED - HTTP ${res.statusCode}`);
          console.log(`   Response: ${data.substring(0, 200)}...`);
          resolve({ success: false, status: res.statusCode, error: data, duration });
        }
      });
    }).on('error', (err) => {
      console.log(`   ❌ FAILED - Network error: ${err.message}`);
      reject(err);
    });
  });
}

async function runTests() {
  console.log('🚀 Starting Brand Products API Integration Tests');
  console.log('================================================');
  
  const tests = [
    // Basic products endpoint
    {
      path: `/api/brands/${TEST_BRAND_ID}/products`,
      description: 'Basic products list for brand'
    },
    
    // Products with date range
    {
      path: `/api/brands/${TEST_BRAND_ID}/products?dateFrom=2024-08-01&dateTo=2024-08-31`,
      description: 'Products with date range filter'
    },
    
    // Products with segment metadata
    {
      path: `/api/brands/${TEST_BRAND_ID}/products?includeSegments=true`,
      description: 'Products with segment metadata included'
    },
    
    // Products with comparison period
    {
      path: `/api/brands/${TEST_BRAND_ID}/products?dateFrom=2024-08-01&dateTo=2024-08-31&comparisonDateFrom=2024-07-01&comparisonDateTo=2024-07-31`,
      description: 'Products with comparison period'
    },
    
    // Products with filtering and sorting
    {
      path: `/api/brands/${TEST_BRAND_ID}/products?minImpressions=1000&sortBy=purchases&sortOrder=desc&limit=10`,
      description: 'Products with filters and sorting'
    },
    
    // Specific ASIN segments endpoint
    {
      path: `/api/brands/${TEST_BRAND_ID}/products/${TEST_ASIN}/segments`,
      description: 'Segments for specific ASIN'
    },
    
    // ASIN segments with date range
    {
      path: `/api/brands/${TEST_BRAND_ID}/products/${TEST_ASIN}/segments?dateFrom=2024-08-01&dateTo=2024-08-31&segmentType=weekly`,
      description: 'ASIN segments with date range and type'
    },
    
    // ASIN segments with comparison
    {
      path: `/api/brands/${TEST_BRAND_ID}/products/${TEST_ASIN}/segments?dateFrom=2024-08-01&dateTo=2024-08-31&comparisonDateFrom=2024-07-01&comparisonDateTo=2024-07-31`,
      description: 'ASIN segments with comparison period'
    }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const result = await makeRequest(test.path, test.description);
      results.push({ ...test, ...result });
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      results.push({ 
        ...test, 
        success: false, 
        error: error.message 
      });
    }
  }
  
  // Summary
  console.log('\n\n📋 Test Results Summary');
  console.log('========================');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Successful: ${successful}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  • ${r.description} (${r.status || 'N/A'})`);
    });
  }
  
  // Performance metrics
  const successfulWithTiming = results.filter(r => r.success && r.duration);
  if (successfulWithTiming.length > 0) {
    const avgDuration = successfulWithTiming.reduce((sum, r) => sum + r.duration, 0) / successfulWithTiming.length;
    const maxDuration = Math.max(...successfulWithTiming.map(r => r.duration));
    const minDuration = Math.min(...successfulWithTiming.map(r => r.duration));
    
    console.log('\n⚡ Performance Metrics:');
    console.log(`   Average response time: ${avgDuration.toFixed(0)}ms`);
    console.log(`   Fastest response: ${minDuration}ms`);
    console.log(`   Slowest response: ${maxDuration}ms`);
  }
  
  console.log('\n🎯 Integration Test Complete');
  
  return failed === 0;
}

if (require.main === module) {
  runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}

module.exports = { runTests };