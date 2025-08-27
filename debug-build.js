#!/usr/bin/env node

console.log('=== Build Environment Debug ===');
console.log('Current working directory:', process.cwd());
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);

const fs = require('fs');
const path = require('path');

console.log('\n=== Directory Structure ===');
const currentDir = process.cwd();
console.log('Contents of current directory:');
try {
  const files = fs.readdirSync(currentDir);
  files.forEach(file => {
    const filePath = path.join(currentDir, file);
    const stats = fs.statSync(filePath);
    console.log(`  ${stats.isDirectory() ? '📁' : '📄'} ${file}`);
  });
} catch (error) {
  console.error('Error reading directory:', error.message);
}

console.log('\n=== Checking for src/app directory ===');
const srcAppPath = path.join(currentDir, 'src', 'app');
if (fs.existsSync(srcAppPath)) {
  console.log('✅ src/app directory exists');
  try {
    const appFiles = fs.readdirSync(srcAppPath);
    console.log('Contents of src/app:');
    appFiles.forEach(file => {
      const filePath = path.join(srcAppPath, file);
      const stats = fs.statSync(filePath);
      console.log(`  ${stats.isDirectory() ? '📁' : '📄'} ${file}`);
    });
  } catch (error) {
    console.error('Error reading src/app:', error.message);
  }
} else {
  console.log('❌ src/app directory does not exist');
  
  // Check if app directory exists in root
  const rootAppPath = path.join(currentDir, 'app');
  if (fs.existsSync(rootAppPath)) {
    console.log('✅ app directory exists in root');
  } else {
    console.log('❌ app directory does not exist in root either');
  }
}

console.log('\n=== Package.json check ===');
const packagePath = path.join(currentDir, 'package.json');
if (fs.existsSync(packagePath)) {
  console.log('✅ package.json exists');
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    console.log('Project name:', pkg.name);
    console.log('Next.js version:', pkg.dependencies?.next);
  } catch (error) {
    console.error('Error reading package.json:', error.message);
  }
} else {
  console.log('❌ package.json does not exist');
}

console.log('\n=== Next.js config check ===');
const nextConfigPath = path.join(currentDir, 'next.config.js');
if (fs.existsSync(nextConfigPath)) {
  console.log('✅ next.config.js exists');
} else {
  console.log('❌ next.config.js does not exist');
}

console.log('\n=== Environment Variables ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PWD:', process.env.PWD);

console.log('\n=== Debug Complete ===');