#!/usr/bin/env node

require('dotenv').config();

console.log('🔍 Debugging credentials format...\n');

const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
if (!raw) {
  console.log('❌ No GOOGLE_APPLICATION_CREDENTIALS_JSON found');
  process.exit(1);
}

console.log('Raw length:', raw.length);
console.log('First 50 chars:', raw.substring(0, 50));
console.log('Last 50 chars:', raw.substring(raw.length - 50));
console.log('Starts with single quote:', raw.startsWith("'"));
console.log('Ends with single quote:', raw.endsWith("'"));
console.log('Starts with double quote:', raw.startsWith('"'));
console.log('Ends with double quote:', raw.endsWith('"'));

// Check for newlines
const newlineCount = (raw.match(/\n/g) || []).length;
console.log('Contains newlines:', newlineCount);

// Try different parsing strategies
console.log('\nTrying parsing strategies:');

// Strategy 1: Direct parse
try {
  const parsed1 = JSON.parse(raw);
  console.log('✅ Strategy 1 (direct): SUCCESS');
  console.log('   Type:', parsed1.type);
  console.log('   Project:', parsed1.project_id);
} catch (e) {
  console.log('❌ Strategy 1 (direct):', e.message);
}

// Strategy 2: Remove outer quotes
try {
  let cleaned = raw;
  if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.slice(1, -1);
  } else if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  const parsed2 = JSON.parse(cleaned);
  console.log('✅ Strategy 2 (remove quotes): SUCCESS');
  console.log('   Type:', parsed2.type);
  console.log('   Project:', parsed2.project_id);
} catch (e) {
  console.log('❌ Strategy 2 (remove quotes):', e.message);
}

// Strategy 3: Multiline JSON
try {
  // Check if it's a multiline JSON that needs to be joined
  const lines = raw.split('\n');
  if (lines.length > 1) {
    console.log(`   Found ${lines.length} lines`);
    
    // Try to find where JSON starts and ends
    let jsonStart = -1;
    let jsonEnd = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('{')) {
        jsonStart = i;
        break;
      }
    }
    
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes('}')) {
        jsonEnd = i;
        break;
      }
    }
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonLines = lines.slice(jsonStart, jsonEnd + 1);
      const joined = jsonLines.join('');
      const parsed3 = JSON.parse(joined);
      console.log('✅ Strategy 3 (multiline): SUCCESS');
      console.log('   Type:', parsed3.type);
      console.log('   Project:', parsed3.project_id);
    }
  }
} catch (e) {
  console.log('❌ Strategy 3 (multiline):', e.message);
}

// Strategy 4: Read from .env file directly
const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(process.cwd(), '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Find the line with GOOGLE_APPLICATION_CREDENTIALS_JSON
  const lines = envContent.split('\n');
  const credLine = lines.find(line => line.startsWith('GOOGLE_APPLICATION_CREDENTIALS_JSON='));
  
  if (credLine) {
    console.log('\n.env file line found');
    console.log('Line length:', credLine.length);
    console.log('First 100 chars:', credLine.substring(0, 100));
    
    // Extract value after the equals sign
    const valueStart = credLine.indexOf('=') + 1;
    let value = credLine.substring(valueStart);
    
    // Check if it's wrapped in quotes
    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    } else if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    
    // Try parsing
    try {
      const parsed4 = JSON.parse(value);
      console.log('✅ Strategy 4 (from file): SUCCESS');
      console.log('   Type:', parsed4.type);
      console.log('   Project:', parsed4.project_id);
    } catch (e) {
      console.log('❌ Strategy 4 (from file):', e.message);
      
      // Show the actual structure
      console.log('\nShowing value structure:');
      console.log('Value starts with:', value.substring(0, 20));
      console.log('Checking for multiline...');
      
      // It might be a multiline value in the .env file
      if (value.startsWith('{') && !value.endsWith('}')) {
        console.log('Appears to be multiline JSON in .env file');
        console.log('This format is not supported by dotenv');
        console.log('The JSON should be on a single line');
      }
    }
  }
} catch (e) {
  console.log('Could not read .env file:', e.message);
}