const http = require('http');

function testPage(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      console.log(`\n=== Testing ${path} ===`);
      console.log(`Status: ${res.statusCode}`);
      
      if (res.statusCode === 200) {
        console.log('✅ Page loads successfully!');
      } else {
        console.log('❌ Page not found or error');
      }
      resolve();
    });
    
    req.on('timeout', () => {
      console.log(`\n=== Testing ${path} ===`);
      console.log('⏱️ Request timed out');
      req.destroy();
      resolve();
    });
    
    req.on('error', (error) => {
      console.log(`\n=== Testing ${path} ===`);
      console.error('❌ Error:', error.message);
      resolve();
    });
    
    req.setTimeout(10000);
    req.end();
  });
}

async function runTests() {
  console.log('Testing pages...');
  
  const pages = [
    '/',
    '/refresh-monitor',
    '/api/refresh/status',
    '/api/health/pipeline'
  ];
  
  for (const page of pages) {
    await testPage(page);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

runTests().catch(console.error);