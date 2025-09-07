// Test the refresh API endpoints
const http = require('http');

function testEndpoint(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`\n=== Testing ${path} ===`);
        console.log(`Status: ${res.statusCode}`);
        console.log(`Headers:`, res.headers);
        
        try {
          const jsonData = JSON.parse(data);
          console.log(`Response:`, JSON.stringify(jsonData, null, 2));
          resolve(jsonData);
        } catch (e) {
          console.log(`Raw Response: ${data.substring(0, 200)}...`);
          resolve(data);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`Error testing ${path}:`, error);
      reject(error);
    });
    
    req.end();
  });
}

async function runTests() {
  console.log('Testing Refresh API Endpoints...');
  
  // Test each endpoint
  const endpoints = [
    '/api/refresh/status',
    '/api/refresh/history',
    '/api/refresh/config',
    '/api/refresh/metrics',
    '/api/refresh/webhooks',
    '/api/health/pipeline'
  ];
  
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between requests
  }
}

runTests().catch(console.error);