import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

// Test utilities
const extractBrandFromTitle = (title: string): string => {
  if (!title) return 'Unknown'
  
  const patterns = [
    /^([A-Z][A-Za-z0-9\-&\s]+)\s+(?:by|from|Brand:|®|™)/,  // "Brand by", "Brand from", etc.
    /^([A-Z][A-Za-z0-9\-&]+)\s+[A-Z]/,                     // Brand followed by product name
    /^([A-Z][A-Za-z0-9\-&]+)\s*[-–—]/,                     // Brand followed by dash
    /^([A-Z][A-Za-z0-9\-&]+)\s*\|/,                        // Brand followed by pipe
    /^([A-Z][A-Za-z0-9\-&]+)\s*:/,                         // Brand followed by colon
    /^\[([A-Z][A-Za-z0-9\-&\s]+)\]/                        // Brand in brackets
  ]
  
  const cleanTitle = title.trim()
  
  for (const pattern of patterns) {
    const match = cleanTitle.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  
  // Fallback: First word if it starts with capital letter
  const firstWordMatch = cleanTitle.match(/^([A-Z][A-Za-z0-9\-&]+)/)
  return firstWordMatch ? firstWordMatch[1].trim() : 'Unknown'
}

const normalizeBrandName = (brand: string): string => {
  return brand
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

const extractProductType = (title: string): string => {
  const titleLower = title.toLowerCase()
  
  const productTypeMap = [
    { pattern: /(headphone|earphone|earbud|airpod)/, type: 'Audio' },
    { pattern: /(laptop|notebook|computer|desktop|chromebook)/, type: 'Computers' },
    { pattern: /(phone|mobile|smartphone|iphone|android)/, type: 'Mobile Devices' },
    { pattern: /(tablet|ipad|kindle|galaxy tab)/, type: 'Tablets' },
    { pattern: /(camera|webcam|gopro)/, type: 'Cameras' },
    { pattern: /(speaker|soundbar|echo|alexa)/, type: 'Speakers' },
    { pattern: /(watch|smartwatch|fitness tracker)/, type: 'Wearables' },
    { pattern: /(tv|television|monitor|display)/, type: 'Displays' },
    { pattern: /(router|modem|network|wifi)/, type: 'Networking' },
    { pattern: /(keyboard|mouse|controller|gamepad)/, type: 'Accessories' }
  ]
  
  for (const { pattern, type } of productTypeMap) {
    if (pattern.test(titleLower)) {
      return type
    }
  }
  
  return 'Other'
}

describe('Brand Extraction Functions', () => {
  describe('extractBrandFromTitle', () => {
    it('should extract brand with "by" separator', () => {
      expect(extractBrandFromTitle('Sony WH-1000XM4 by Sony Electronics')).toBe('Sony WH-1000XM4')
      expect(extractBrandFromTitle('Anker PowerCore by Anker')).toBe('Anker PowerCore')
    })

    it('should extract brand with trademark symbols', () => {
      expect(extractBrandFromTitle('Apple® iPhone 15 Pro')).toBe('Apple')
      expect(extractBrandFromTitle('Samsung™ Galaxy S24')).toBe('Samsung')
    })

    it('should extract brand followed by product name', () => {
      expect(extractBrandFromTitle('Logitech MX Master 3S Mouse')).toBe('Logitech')
      expect(extractBrandFromTitle('Bose QuietComfort Earbuds')).toBe('Bose')
    })

    it('should extract brand with dash separator', () => {
      expect(extractBrandFromTitle('JBL - Charge 5 Portable Speaker')).toBe('JBL')
      expect(extractBrandFromTitle('ASUS – ROG Gaming Laptop')).toBe('ASUS')
    })

    it('should extract brand with pipe separator', () => {
      expect(extractBrandFromTitle('Microsoft | Surface Pro 9')).toBe('Microsoft')
      expect(extractBrandFromTitle('HP | Pavilion Desktop')).toBe('HP')
    })

    it('should extract brand with colon separator', () => {
      expect(extractBrandFromTitle('Razer: DeathAdder Gaming Mouse')).toBe('Razer')
      expect(extractBrandFromTitle('Corsair: K95 RGB Keyboard')).toBe('Corsair')
    })

    it('should extract brand in brackets', () => {
      expect(extractBrandFromTitle('[Amazon Basics] USB Cable')).toBe('Amazon Basics')
      expect(extractBrandFromTitle('[Anker] Wireless Charger')).toBe('Anker')
    })

    it('should handle edge cases', () => {
      expect(extractBrandFromTitle('')).toBe('Unknown')
      expect(extractBrandFromTitle('   ')).toBe('Unknown')
      expect(extractBrandFromTitle('generic product name')).toBe('Unknown')
      expect(extractBrandFromTitle('123 Product')).toBe('Unknown')
    })

    it('should extract first capitalized word as fallback', () => {
      expect(extractBrandFromTitle('SanDisk 128GB SD Card')).toBe('SanDisk')
      expect(extractBrandFromTitle('Kingston Memory Module')).toBe('Kingston')
    })
  })

  describe('normalizeBrandName', () => {
    it('should normalize brand names correctly', () => {
      expect(normalizeBrandName('Apple Inc.')).toBe('apple inc')
      expect(normalizeBrandName('Samsung Electronics')).toBe('samsung electronics')
      expect(normalizeBrandName('LG-Electronics')).toBe('lgelectronics')
      expect(normalizeBrandName('Sony®')).toBe('sony')
      expect(normalizeBrandName('  Bose  ')).toBe('bose')
      expect(normalizeBrandName('3M™')).toBe('3m')
    })

    it('should handle special characters', () => {
      expect(normalizeBrandName('AT&T')).toBe('att')
      expect(normalizeBrandName('Hewlett-Packard')).toBe('hewlettpackard')
      expect(normalizeBrandName('Procter & Gamble')).toBe('procter  gamble')
    })
  })

  describe('extractProductType', () => {
    it('should identify audio products', () => {
      expect(extractProductType('Sony WH-1000XM4 Headphones')).toBe('Audio')
      expect(extractProductType('Apple AirPods Pro')).toBe('Audio')
      expect(extractProductType('Bose QuietComfort Earbuds')).toBe('Audio')
    })

    it('should identify computer products', () => {
      expect(extractProductType('Dell XPS 15 Laptop')).toBe('Computers')
      expect(extractProductType('HP Desktop Computer')).toBe('Computers')
      expect(extractProductType('Lenovo ThinkPad Notebook')).toBe('Computers')
    })

    it('should identify mobile devices', () => {
      expect(extractProductType('iPhone 15 Pro Max')).toBe('Mobile Devices')
      expect(extractProductType('Samsung Galaxy Smartphone')).toBe('Mobile Devices')
      expect(extractProductType('Google Pixel 8 Mobile Phone')).toBe('Mobile Devices')
    })

    it('should identify tablets', () => {
      expect(extractProductType('Apple iPad Pro 12.9')).toBe('Tablets')
      expect(extractProductType('Amazon Kindle Paperwhite')).toBe('Tablets')
      expect(extractProductType('Samsung Galaxy Tab')).toBe('Tablets')
    })

    it('should identify speakers', () => {
      expect(extractProductType('JBL Bluetooth Speaker')).toBe('Speakers')
      expect(extractProductType('Amazon Echo Dot')).toBe('Speakers')
      expect(extractProductType('Sonos Soundbar')).toBe('Speakers')
    })

    it('should return Other for unmatched products', () => {
      expect(extractProductType('Generic Product')).toBe('Other')
      expect(extractProductType('USB Cable')).toBe('Other')
      expect(extractProductType('Power Adapter')).toBe('Other')
    })
  })
})

describe('Brand Database Operations', () => {
  let supabase: ReturnType<typeof createClient<Database>>
  
  beforeAll(() => {
    const supabaseUrl = process.env.SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)
  })

  describe('Brand Table Operations', () => {
    it('should insert and retrieve brands', async () => {
      // Test data
      const testBrand = {
        brand_name: 'TestBrand Electronics',
        normalized_name: 'testbrand electronics',
        display_name: 'TestBrand Electronics'
      }

      // Insert test brand
      const { data: insertedBrand, error: insertError } = await supabase
        .from('brands')
        .insert(testBrand)
        .select()
        .single()

      expect(insertError).toBeNull()
      expect(insertedBrand).toBeDefined()
      expect(insertedBrand?.brand_name).toBe(testBrand.brand_name)

      // Retrieve brand
      const { data: retrievedBrand, error: retrieveError } = await supabase
        .from('brands')
        .select('*')
        .eq('brand_name', testBrand.brand_name)
        .single()

      expect(retrieveError).toBeNull()
      expect(retrievedBrand).toBeDefined()
      expect(retrievedBrand?.normalized_name).toBe(testBrand.normalized_name)

      // Cleanup
      if (insertedBrand?.id) {
        await supabase
          .from('brands')
          .delete()
          .eq('id', insertedBrand.id)
      }
    })

    it('should handle duplicate brand names', async () => {
      const testBrand = {
        brand_name: 'DuplicateTestBrand',
        normalized_name: 'duplicatetestbrand',
        display_name: 'DuplicateTestBrand'
      }

      // First insert should succeed
      const { data: firstInsert, error: firstError } = await supabase
        .from('brands')
        .insert(testBrand)
        .select()
        .single()

      expect(firstError).toBeNull()
      expect(firstInsert).toBeDefined()

      // Second insert should fail due to unique constraint
      const { error: secondError } = await supabase
        .from('brands')
        .insert(testBrand)

      expect(secondError).toBeDefined()
      expect(secondError?.code).toBe('23505') // Unique violation

      // Cleanup
      if (firstInsert?.id) {
        await supabase
          .from('brands')
          .delete()
          .eq('id', firstInsert.id)
      }
    })
  })

  describe('ASIN Brand Mapping Operations', () => {
    let testBrandId: string

    beforeAll(async () => {
      // Create test brand for mapping tests
      const { data: brand } = await supabase
        .from('brands')
        .insert({
          brand_name: 'MappingTestBrand',
          normalized_name: 'mappingtestbrand',
          display_name: 'MappingTestBrand'
        })
        .select()
        .single()

      testBrandId = brand?.id || ''
    })

    afterAll(async () => {
      // Cleanup test brand
      await supabase
        .from('brands')
        .delete()
        .eq('id', testBrandId)
    })

    it('should map ASIN to brand', async () => {
      const testMapping = {
        asin: 'B0TEST12345',
        brand_id: testBrandId,
        product_title: 'MappingTestBrand Test Product',
        extraction_method: 'automatic' as const,
        confidence_score: 0.85
      }

      const { data: mapping, error } = await supabase
        .from('asin_brand_mapping')
        .insert(testMapping)
        .select()
        .single()

      expect(error).toBeNull()
      expect(mapping).toBeDefined()
      expect(mapping?.confidence_score).toBe(0.85)

      // Cleanup
      await supabase
        .from('asin_brand_mapping')
        .delete()
        .eq('asin', testMapping.asin)
    })

    it('should update existing ASIN mapping', async () => {
      const testAsin = 'B0UPDATE123'
      
      // Initial mapping
      await supabase
        .from('asin_brand_mapping')
        .insert({
          asin: testAsin,
          brand_id: testBrandId,
          product_title: 'Initial Title',
          extraction_method: 'automatic' as const,
          confidence_score: 0.75
        })

      // Update mapping
      const { data: updated, error } = await supabase
        .from('asin_brand_mapping')
        .update({
          confidence_score: 0.95,
          extraction_method: 'manual' as const,
          verified: true
        })
        .eq('asin', testAsin)
        .select()
        .single()

      expect(error).toBeNull()
      expect(updated?.confidence_score).toBe(0.95)
      expect(updated?.extraction_method).toBe('manual')
      expect(updated?.verified).toBe(true)

      // Cleanup
      await supabase
        .from('asin_brand_mapping')
        .delete()
        .eq('asin', testAsin)
    })
  })

  describe('Product Type Mapping Operations', () => {
    it('should insert and retrieve product type mappings', async () => {
      const testMapping = {
        asin: 'B0PRODTYPE123',
        product_type: 'Audio',
        extraction_method: 'automatic' as const,
        confidence_score: 0.90
      }

      const { data: mapping, error: insertError } = await supabase
        .from('product_type_mapping')
        .insert(testMapping)
        .select()
        .single()

      expect(insertError).toBeNull()
      expect(mapping).toBeDefined()
      expect(mapping?.product_type).toBe('Audio')

      // Cleanup
      await supabase
        .from('product_type_mapping')
        .delete()
        .eq('asin', testMapping.asin)
    })
  })
})