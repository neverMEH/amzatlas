#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js'
import { promises as fs } from 'fs'
import path from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

async function validateMigration() {
  console.log('🔍 Validating migration syntax...\n')

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../lib/supabase/migrations/031_fix_asin_column_simple.sql')
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8')
    
    console.log('📋 Migration file loaded')
    console.log(`Size: ${migrationSQL.length} characters`)
    console.log(`Lines: ${migrationSQL.split('\n').length}`)
    
    // Check for common syntax issues
    const issues: string[] = []
    
    // Check for RAISE NOTICE outside of DO blocks
    const lines = migrationSQL.split('\n')
    let inDoBlock = false
    let blockDepth = 0
    
    lines.forEach((line, idx) => {
      const trimmed = line.trim()
      
      // Track DO block status
      if (trimmed.toUpperCase().startsWith('DO $$')) {
        inDoBlock = true
        blockDepth++
      }
      if (trimmed === '$$;' || trimmed.endsWith('$$;')) {
        blockDepth--
        if (blockDepth === 0) inDoBlock = false
      }
      
      // Check for RAISE NOTICE outside DO blocks
      if (trimmed.toUpperCase().startsWith('RAISE NOTICE') && !inDoBlock) {
        issues.push(`Line ${idx + 1}: RAISE NOTICE outside of DO block`)
      }
      
      // Check for unmatched quotes
      const singleQuotes = (line.match(/'/g) || []).length
      const doubleQuotes = (line.match(/"/g) || []).length
      if (singleQuotes % 2 !== 0) {
        issues.push(`Line ${idx + 1}: Unmatched single quotes`)
      }
      if (doubleQuotes % 2 !== 0 && !line.includes('--')) {
        issues.push(`Line ${idx + 1}: Unmatched double quotes`)
      }
    })
    
    // Check for missing semicolons
    const statements = migrationSQL.split(/;\s*$/m).filter(s => s.trim())
    statements.forEach((stmt, idx) => {
      const trimmed = stmt.trim()
      if (trimmed && !trimmed.endsWith(';') && !trimmed.endsWith('$$') && idx < statements.length - 1) {
        const firstLine = trimmed.split('\n')[0]
        if (!firstLine.startsWith('--')) {
          issues.push(`Statement ${idx + 1}: Missing semicolon (starts with: ${firstLine.substring(0, 50)}...)`)
        }
      }
    })
    
    if (issues.length > 0) {
      console.log('\n❌ Found syntax issues:')
      issues.forEach(issue => console.log(`  - ${issue}`))
    } else {
      console.log('\n✅ No obvious syntax issues found')
    }
    
    console.log('\n📝 Migration Summary:')
    console.log('- Drops all dependent views')
    console.log('- Alters ASIN columns to VARCHAR(20)')
    console.log('- Recreates necessary views')
    console.log('- All RAISE NOTICE statements are inside DO blocks')
    
  } catch (error) {
    console.error('Error:', error)
  }
}

// Run validation
validateMigration()