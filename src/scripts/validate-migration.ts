#!/usr/bin/env node
import * as fs from 'fs'
import * as path from 'path'

interface ValidationResult {
  file: string
  valid: boolean
  errors: string[]
  warnings: string[]
}

function validateSQLSyntax(content: string, filename: string): ValidationResult {
  const result: ValidationResult = {
    file: filename,
    valid: true,
    errors: [],
    warnings: []
  }

  // Check for basic syntax patterns
  const lines = content.split('\n')
  let inDOBlock = false
  let doBlockCount = 0
  let endBlockCount = 0
  let openParens = 0
  let openQuotes = 0

  lines.forEach((line, lineNum) => {
    const trimmedLine = line.trim()
    
    // Skip comments
    if (trimmedLine.startsWith('--') || trimmedLine === '') {
      return
    }

    // Check for DO blocks
    if (trimmedLine.startsWith('DO $$')) {
      inDOBlock = true
      doBlockCount++
    }
    
    if (trimmedLine === 'END $$;') {
      inDOBlock = false
      endBlockCount++
    }

    // Check for RAISE NOTICE outside DO blocks
    if (trimmedLine.includes('RAISE NOTICE') && !inDOBlock) {
      result.errors.push(`Line ${lineNum + 1}: RAISE NOTICE found outside DO block`)
      result.valid = false
    }

    // Check for unbalanced parentheses
    for (const char of line) {
      if (char === '(' && openQuotes % 2 === 0) openParens++
      if (char === ')' && openQuotes % 2 === 0) openParens--
      if (char === "'") openQuotes++
    }

    // Check for common SQL errors
    if (trimmedLine.endsWith(',') && lines[lineNum + 1]?.trim().startsWith(')')) {
      result.warnings.push(`Line ${lineNum + 1}: Trailing comma before closing parenthesis`)
    }

    // Check for missing semicolons
    if (trimmedLine.length > 0 && 
        !trimmedLine.endsWith(';') && 
        !trimmedLine.endsWith('$$') &&
        !trimmedLine.startsWith('--') &&
        !inDOBlock &&
        lineNum < lines.length - 1) {
      const nextLine = lines[lineNum + 1]?.trim() || ''
      if (!nextLine.startsWith('FROM') && 
          !nextLine.startsWith('WHERE') && 
          !nextLine.startsWith('AND') &&
          !nextLine.startsWith('OR') &&
          !nextLine.startsWith('JOIN') &&
          !nextLine.startsWith('ORDER') &&
          !nextLine.startsWith('GROUP') &&
          !nextLine.startsWith('UNION') &&
          !nextLine.startsWith(',')) {
        // Check if this might be a complete statement
        if (trimmedLine.match(/^(CREATE|DROP|ALTER|INSERT|UPDATE|DELETE|GRANT|COMMENT)/i)) {
          result.warnings.push(`Line ${lineNum + 1}: Statement might be missing semicolon`)
        }
      }
    }
  })

  // Final checks
  if (doBlockCount !== endBlockCount) {
    result.errors.push(`Unbalanced DO blocks: ${doBlockCount} DO $$ but ${endBlockCount} END $$;`)
    result.valid = false
  }

  if (openParens !== 0) {
    result.errors.push(`Unbalanced parentheses: ${openParens > 0 ? openParens + ' unclosed' : Math.abs(openParens) + ' extra closing'}`)
    result.valid = false
  }

  if (openQuotes % 2 !== 0) {
    result.errors.push('Unbalanced quotes')
    result.valid = false
  }

  return result
}

function validateMigrationFile(filepath: string): ValidationResult {
  try {
    const content = fs.readFileSync(filepath, 'utf8')
    return validateSQLSyntax(content, path.basename(filepath))
  } catch (error) {
    return {
      file: path.basename(filepath),
      valid: false,
      errors: [`Failed to read file: ${error}`],
      warnings: []
    }
  }
}

async function main() {
  console.log('=== SQL Migration Syntax Validator ===\n')

  // Check specific migration files
  const migrationFiles = [
    '/root/amzatlas/migrations_backup_2025_09_06/031_fix_asin_column_corrected.sql',
    '/root/amzatlas/migrations_backup_2025_09_06/032_recreate_asin_performance_by_brand.sql',
    '/root/amzatlas/migrations_backup_2025_09_06/033_recreate_brand_search_query_metrics.sql'
  ]

  let allValid = true

  for (const file of migrationFiles) {
    if (fs.existsSync(file)) {
      const result = validateMigrationFile(file)
      
      console.log(`\nFile: ${result.file}`)
      console.log(`Status: ${result.valid ? '✅ VALID' : '❌ INVALID'}`)
      
      if (result.errors.length > 0) {
        console.log('\nErrors:')
        result.errors.forEach(err => console.log(`  - ${err}`))
        allValid = false
      }
      
      if (result.warnings.length > 0) {
        console.log('\nWarnings:')
        result.warnings.forEach(warn => console.log(`  - ${warn}`))
      }
      
      if (result.valid && result.errors.length === 0 && result.warnings.length === 0) {
        console.log('  No issues found')
      }
    } else {
      console.log(`\nFile not found: ${file}`)
      allValid = false
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Overall status: ${allValid ? '✅ All files valid' : '❌ Some files have issues'}`)
  
  if (allValid) {
    console.log('\nThe migration files appear to have valid SQL syntax.')
    console.log('They should be safe to execute in Supabase.')
  } else {
    console.log('\nPlease fix the errors before executing the migrations.')
  }

  process.exit(allValid ? 0 : 1)
}

main()