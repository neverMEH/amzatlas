#!/usr/bin/env node

const { execSync } = require('child_process');

// Set build-time environment variables
process.env.NODE_ENV = 'production';
process.env.NEXT_RUNTIME = 'false';

console.log('Starting build with environment configuration...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Build time mode enabled');

try {
  // Run the Next.js build
  execSync('next build', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_RUNTIME: 'false'
    }
  });
  
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}