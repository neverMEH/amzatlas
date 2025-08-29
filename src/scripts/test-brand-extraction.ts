#!/usr/bin/env tsx
/**
 * Test script for brand extraction accuracy
 * Tests the PostgreSQL brand extraction functions with sample product titles
 */

import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import chalk from 'chalk'

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

// Test cases with expected results
const testCases = [
  // Clear brand indicators
  { title: 'Apple iPhone 15 Pro Max 256GB', expectedBrand: 'Apple', expectedType: 'Mobile Devices' },
  { title: 'Samsung Galaxy S24 Ultra Smartphone', expectedBrand: 'Samsung', expectedType: 'Mobile Devices' },
  { title: 'Sony WH-1000XM5 Wireless Headphones', expectedBrand: 'Sony', expectedType: 'Audio' },
  { title: 'Bose QuietComfort Ultra Earbuds', expectedBrand: 'Bose', expectedType: 'Audio' },
  
  // Brand with separator patterns
  { title: 'Anker - PowerCore 10000 Portable Charger', expectedBrand: 'Anker', expectedType: 'Power & Cables' },
  { title: 'JBL | Charge 5 Portable Bluetooth Speaker', expectedBrand: 'JBL', expectedType: 'Speakers' },
  { title: 'Logitech: MX Master 3S Wireless Mouse', expectedBrand: 'Logitech', expectedType: 'Accessories' },
  { title: '[Amazon Basics] HDMI Cable 6 Feet', expectedBrand: 'Amazon Basics', expectedType: 'Power & Cables' },
  
  // Brand with "by" pattern
  { title: 'Echo Dot (5th Gen) by Amazon', expectedBrand: 'Echo Dot', expectedType: 'Speakers' },
  { title: 'Fire TV Stick 4K by Amazon', expectedBrand: 'Fire TV Stick', expectedType: 'Other' },
  { title: 'Surface Pro 9 by Microsoft', expectedBrand: 'Surface Pro', expectedType: 'Tablets' },
  
  // Trademark symbols
  { title: 'Nike® Air Max 270 Running Shoes', expectedBrand: 'Nike', expectedType: 'Other' },
  { title: 'LEGO™ Star Wars Millennium Falcon', expectedBrand: 'LEGO', expectedType: 'Other' },
  { title: 'Nintendo™ Switch OLED Model', expectedBrand: 'Nintendo', expectedType: 'Gaming' },
  
  // Complex product titles
  { title: 'ASUS ROG Strix G16 Gaming Laptop Intel Core i9', expectedBrand: 'ASUS', expectedType: 'Computers' },
  { title: 'Dell XPS 15 9530 Laptop Computer - 15.6" FHD+', expectedBrand: 'Dell', expectedType: 'Computers' },
  { title: 'HP Envy x360 2-in-1 Touchscreen Laptop', expectedBrand: 'HP', expectedType: 'Computers' },
  
  // Edge cases
  { title: 'USB C Hub 7 in 1 Multiport Adapter', expectedBrand: 'USB', expectedType: 'Other' },
  { title: '3M Command Strips Heavy Duty', expectedBrand: '3M', expectedType: 'Other' },
  { title: 'generic bluetooth earphones wireless', expectedBrand: 'Unknown', expectedType: 'Audio' },
  { title: '', expectedBrand: 'Unknown', expectedType: 'Other' },
]

async function testBrandExtraction() {
  console.log(chalk.blue('\n=== Testing Brand Extraction Functions ===\n'))
  
  let correctBrands = 0
  let correctTypes = 0
  const results: any[] = []
  
  for (const testCase of testCases) {
    try {
      // Test brand extraction
      const { data: brandResult, error: brandError } = await supabase
        .rpc('extract_brand_from_title', { product_title: testCase.title })
      
      if (brandError) throw brandError
      
      // Test product type extraction
      const { data: typeResult, error: typeError } = await supabase
        .rpc('extract_product_type', { product_title: testCase.title })
      
      if (typeError) throw typeError
      
      const brandMatch = brandResult === testCase.expectedBrand
      const typeMatch = typeResult === testCase.expectedType
      
      if (brandMatch) correctBrands++
      if (typeMatch) correctTypes++
      
      results.push({
        title: testCase.title,
        expectedBrand: testCase.expectedBrand,
        extractedBrand: brandResult,
        brandMatch,
        expectedType: testCase.expectedType,
        extractedType: typeResult,
        typeMatch
      })
      
      // Display result
      console.log(chalk.gray('Title:'), testCase.title)
      console.log(
        chalk.gray('Brand:'),
        brandMatch ? chalk.green('✓') : chalk.red('✗'),
        `Expected: ${testCase.expectedBrand}, Got: ${brandResult}`
      )
      console.log(
        chalk.gray('Type:'),
        typeMatch ? chalk.green('✓') : chalk.red('✗'),
        `Expected: ${testCase.expectedType}, Got: ${typeResult}`
      )
      console.log()
      
    } catch (error) {
      console.error(chalk.red('Error testing:'), testCase.title)
      console.error(error)
    }
  }
  
  // Summary statistics
  const brandAccuracy = (correctBrands / testCases.length * 100).toFixed(1)
  const typeAccuracy = (correctTypes / testCases.length * 100).toFixed(1)
  
  console.log(chalk.blue('\n=== Test Summary ==='))
  console.log(chalk.gray('Total test cases:'), testCases.length)
  console.log(chalk.gray('Brand extraction accuracy:'), `${correctBrands}/${testCases.length} (${brandAccuracy}%)`)
  console.log(chalk.gray('Type extraction accuracy:'), `${correctTypes}/${testCases.length} (${typeAccuracy}%)`)
  
  // Show failed cases
  const failedBrands = results.filter(r => !r.brandMatch)
  const failedTypes = results.filter(r => !r.typeMatch)
  
  if (failedBrands.length > 0) {
    console.log(chalk.red('\n=== Failed Brand Extractions ==='))
    failedBrands.forEach(r => {
      console.log(`Title: "${r.title}"`)
      console.log(`  Expected: ${r.expectedBrand}, Got: ${r.extractedBrand}`)
    })
  }
  
  if (failedTypes.length > 0) {
    console.log(chalk.red('\n=== Failed Type Extractions ==='))
    failedTypes.forEach(r => {
      console.log(`Title: "${r.title}"`)
      console.log(`  Expected: ${r.expectedType}, Got: ${r.extractedType}`)
    })
  }
}

async function testRealASINs() {
  console.log(chalk.blue('\n=== Testing with Real ASIN Data ===\n'))
  
  // Get a sample of ASINs with product titles
  const { data: asins, error } = await supabase
    .from('asin_performance_data')
    .select('asin, product_title')
    .not('product_title', 'is', null)
    .limit(20)
  
  if (error) {
    console.error(chalk.red('Error fetching ASINs:'), error)
    return
  }
  
  if (!asins || asins.length === 0) {
    console.log(chalk.yellow('No ASINs with product titles found'))
    return
  }
  
  console.log(chalk.gray(`Testing ${asins.length} real product titles...\n`))
  
  for (const asin of asins) {
    const { data: brandResult } = await supabase
      .rpc('extract_brand_from_title', { product_title: asin.product_title })
    
    const { data: typeResult } = await supabase
      .rpc('extract_product_type', { product_title: asin.product_title })
    
    console.log(chalk.gray('ASIN:'), asin.asin)
    console.log(chalk.gray('Title:'), asin.product_title)
    console.log(chalk.gray('Extracted Brand:'), brandResult || 'Unknown')
    console.log(chalk.gray('Extracted Type:'), typeResult || 'Other')
    console.log()
  }
}

async function testBrandMappingStats() {
  console.log(chalk.blue('\n=== Brand Mapping Statistics ===\n'))
  
  // Get overall statistics
  const { data: stats, error } = await supabase
    .from('asin_brand_mapping')
    .select('confidence_score, extraction_method, verified')
  
  if (error) {
    console.error(chalk.red('Error fetching stats:'), error)
    return
  }
  
  if (!stats || stats.length === 0) {
    console.log(chalk.yellow('No brand mappings found'))
    return
  }
  
  const totalMappings = stats.length
  const verifiedCount = stats.filter(s => s.verified).length
  const automaticCount = stats.filter(s => s.extraction_method === 'automatic').length
  const manualCount = stats.filter(s => s.extraction_method === 'manual').length
  const overrideCount = stats.filter(s => s.extraction_method === 'override').length
  
  const avgConfidence = stats.reduce((sum, s) => sum + (s.confidence_score || 0), 0) / totalMappings
  const highConfidence = stats.filter(s => (s.confidence_score || 0) >= 0.75).length
  const lowConfidence = stats.filter(s => (s.confidence_score || 0) < 0.5).length
  
  console.log(chalk.gray('Total ASIN-Brand mappings:'), totalMappings)
  console.log(chalk.gray('Verified mappings:'), `${verifiedCount} (${(verifiedCount/totalMappings*100).toFixed(1)}%)`)
  console.log()
  console.log(chalk.gray('Extraction methods:'))
  console.log(chalk.gray('  - Automatic:'), `${automaticCount} (${(automaticCount/totalMappings*100).toFixed(1)}%)`)
  console.log(chalk.gray('  - Manual:'), `${manualCount} (${(manualCount/totalMappings*100).toFixed(1)}%)`)
  console.log(chalk.gray('  - Override:'), `${overrideCount} (${(overrideCount/totalMappings*100).toFixed(1)}%)`)
  console.log()
  console.log(chalk.gray('Confidence scores:'))
  console.log(chalk.gray('  - Average:'), avgConfidence.toFixed(3))
  console.log(chalk.gray('  - High (≥0.75):'), `${highConfidence} (${(highConfidence/totalMappings*100).toFixed(1)}%)`)
  console.log(chalk.gray('  - Low (<0.5):'), `${lowConfidence} (${(lowConfidence/totalMappings*100).toFixed(1)}%)`)
  
  // Get brand distribution
  const { data: brandDist } = await supabase
    .from('brands')
    .select(`
      brand_name,
      asin_brand_mapping!inner(asin)
    `)
  
  if (brandDist) {
    const brandCounts = brandDist.map(b => ({
      brand: b.brand_name,
      count: b.asin_brand_mapping.length
    })).sort((a, b) => b.count - a.count)
    
    console.log(chalk.blue('\n=== Top 10 Brands by ASIN Count ==='))
    brandCounts.slice(0, 10).forEach((b, i) => {
      console.log(chalk.gray(`${i + 1}.`), b.brand, chalk.gray(`(${b.count} ASINs)`))
    })
  }
}

// Main execution
async function main() {
  try {
    await testBrandExtraction()
    await testRealASINs()
    await testBrandMappingStats()
  } catch (error) {
    console.error(chalk.red('Script failed:'), error)
    process.exit(1)
  }
}

main()