#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing .env file JSON format...\n');

try {
  const envPath = path.join(process.cwd(), '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  const lines = envContent.split('\n');
  const newLines = [];
  let inJson = false;
  let jsonBuffer = '';
  let jsonKey = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line starts a JSON value
    if (line.includes('GOOGLE_APPLICATION_CREDENTIALS_JSON=')) {
      jsonKey = 'GOOGLE_APPLICATION_CREDENTIALS_JSON';
      const valueStart = line.indexOf('=') + 1;
      const value = line.substring(valueStart).trim();
      
      // Check if it's a complete JSON (starts with { and ends with })
      if (value.startsWith('{') && value.endsWith('}')) {
        // It's already on one line, just add it
        newLines.push(line);
      } else if (value.startsWith('"{"') && value.endsWith('}"')) {
        // It's quoted and complete
        newLines.push(line);
      } else if (value.startsWith('{') || value.startsWith('"{')) {
        // Start of multiline JSON
        inJson = true;
        jsonBuffer = value;
      } else {
        newLines.push(line);
      }
    } else if (inJson) {
      // We're inside a multiline JSON
      jsonBuffer += line.trim();
      
      // Check if this completes the JSON
      if (line.includes('}')) {
        inJson = false;
        
        // Clean up the JSON
        let cleanJson = jsonBuffer;
        
        // Remove quotes if the whole thing is quoted
        if (cleanJson.startsWith('"') && cleanJson.endsWith('"')) {
          cleanJson = cleanJson.slice(1, -1);
        }
        
        // Escape the JSON for .env file (put it all on one line)
        const escaped = JSON.stringify(cleanJson);
        
        // Remove outer quotes that JSON.stringify adds
        const finalValue = escaped.slice(1, -1);
        
        newLines.push(`${jsonKey}='${finalValue}'`);
        jsonBuffer = '';
        jsonKey = '';
      }
    } else {
      // Regular line
      newLines.push(line);
    }
  }
  
  // Write the fixed content
  const fixedContent = newLines.join('\n');
  const backupPath = envPath + '.backup';
  
  // Create backup
  fs.copyFileSync(envPath, backupPath);
  console.log(`✅ Created backup: ${backupPath}`);
  
  // Write fixed version
  fs.writeFileSync(envPath, fixedContent);
  console.log('✅ Fixed .env file written');
  
  // Test the fix
  console.log('\n🔍 Testing the fix...');
  delete require.cache[require.resolve('dotenv')];
  require('dotenv').config();
  
  const testCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (testCreds) {
    try {
      let credStr = testCreds;
      if (credStr.startsWith("'") && credStr.endsWith("'")) {
        credStr = credStr.slice(1, -1);
      }
      
      const parsed = JSON.parse(credStr);
      console.log('✅ JSON parsing successful!');
      console.log('   Type:', parsed.type);
      console.log('   Project:', parsed.project_id);
      console.log('   Email:', parsed.client_email);
    } catch (e) {
      console.log('❌ JSON parsing still failing:', e.message);
      console.log('   You may need to manually edit the .env file');
    }
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}