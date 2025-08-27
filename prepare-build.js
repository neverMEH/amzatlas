#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('=== Preparing build environment ===');
console.log('Build timestamp:', new Date().toISOString());

const currentDir = process.cwd();
console.log('Current directory:', currentDir);
console.log('Node version:', process.version);

// Check if we're in the right directory structure
const srcAppPath = path.join(currentDir, 'src', 'app');
const rootAppPath = path.join(currentDir, 'app');

console.log('Checking for src/app:', fs.existsSync(srcAppPath));
console.log('Checking for root app:', fs.existsSync(rootAppPath));

// If src/app exists but app doesn't, create a symlink
if (fs.existsSync(srcAppPath) && !fs.existsSync(rootAppPath)) {
  try {
    console.log('Creating symlink from src/app to app...');
    fs.symlinkSync('./src/app', rootAppPath, 'dir');
    console.log('✅ Symlink created successfully');
  } catch (error) {
    console.warn('⚠️ Could not create symlink:', error.message);
    
    // Fallback: copy the directory
    console.log('Attempting to copy src/app to app...');
    try {
      const copyRecursive = (src, dest) => {
        if (fs.statSync(src).isDirectory()) {
          if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
          fs.readdirSync(src).forEach(file => {
            copyRecursive(path.join(src, file), path.join(dest, file));
          });
        } else {
          fs.copyFileSync(src, dest);
        }
      };
      copyRecursive(srcAppPath, rootAppPath);
      console.log('✅ Directory copied successfully');
    } catch (copyError) {
      console.error('❌ Failed to copy directory:', copyError.message);
      process.exit(1);
    }
  }
}

// Also check for pages directory (in case Next.js is looking for that)
const srcPagesPath = path.join(currentDir, 'src', 'pages');
const rootPagesPath = path.join(currentDir, 'pages');

if (fs.existsSync(srcPagesPath) && !fs.existsSync(rootPagesPath)) {
  try {
    console.log('Creating symlink from src/pages to pages...');
    fs.symlinkSync('./src/pages', rootPagesPath, 'dir');
    console.log('✅ Pages symlink created successfully');
  } catch (error) {
    console.log('Pages directory handling skipped:', error.message);
  }
}

console.log('=== Build preparation complete ===');
console.log('Final directory structure:');
try {
  const files = fs.readdirSync(currentDir);
  files.forEach(file => {
    if (file === 'app' || file === 'pages' || file === 'src') {
      const filePath = path.join(currentDir, file);
      const stats = fs.statSync(filePath);
      const isSymlink = fs.lstatSync(filePath).isSymbolicLink();
      console.log(`  ${stats.isDirectory() ? '📁' : '📄'} ${file}${isSymlink ? ' (symlink)' : ''}`);
    }
  });
} catch (error) {
  console.error('Error listing final directory:', error.message);
}