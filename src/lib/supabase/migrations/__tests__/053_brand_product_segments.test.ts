import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'

describe('053_brand_product_segments migration', () => {
  const supabaseUrl = process.env.SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  beforeAll(async () => {
    // Ensure helper functions exist for testing
    await supabase.rpc('execute_sql', {
      sql: helperFunctions
    })
  })

  describe('Materialized View Creation', () => {
    it('should create brand_product_segments materialized view with correct structure', async () => {
      const { data, error } = await supabase
        .from('brand_product_segments')
        .select()
        .limit(0)

      expect(error).toBeNull()
      
      // Check columns exist by querying information schema
      const { data: columns } = await supabase
        .rpc('get_table_columns', { 
          schema_name: 'public', 
          table_name: 'brand_product_segments' 
        })
      
      const columnNames = columns?.map((c: any) => c.column_name) || []
      
      // Core identification columns
      expect(columnNames).toContain('brand_id')
      expect(columnNames).toContain('asin')
      expect(columnNames).toContain('product_name')
      expect(columnNames).toContain('segment_type')
      expect(columnNames).toContain('segment_start_date')
      expect(columnNames).toContain('segment_end_date')
      
      // Performance metrics
      expect(columnNames).toContain('total_impressions')
      expect(columnNames).toContain('total_clicks')
      expect(columnNames).toContain('total_cart_adds')
      expect(columnNames).toContain('total_purchases')
      
      // Rate calculations
      expect(columnNames).toContain('click_through_rate')
      expect(columnNames).toContain('conversion_rate')
      expect(columnNames).toContain('cart_add_rate')
      
      // Share metrics
      expect(columnNames).toContain('click_share')
      expect(columnNames).toContain('cart_add_share')
      expect(columnNames).toContain('purchase_share')
      
      // Metadata
      expect(columnNames).toContain('query_count')
      expect(columnNames).toContain('top_query')
      expect(columnNames).toContain('top_query_purchases')
    })

    it('should have proper indexes on materialized view', async () => {
      const { data: indexes } = await supabase
        .rpc('get_table_indexes', {
          schema_name: 'public',
          table_name: 'brand_product_segments'
        })

      const indexNames = indexes?.map((i: any) => i.index_name) || []
      
      // Essential indexes for query performance
      expect(indexNames).toContain('idx_brand_product_segments_brand_asin')
      expect(indexNames).toContain('idx_brand_product_segments_dates')
      expect(indexNames).toContain('idx_brand_product_segments_segment_type')
      expect(indexNames).toContain('idx_brand_product_segments_performance')
    })

    it('should populate with actual data when test data exists', async () => {
      // First, ensure we have test data
      await setupTestData()

      // Refresh the materialized view
      await supabase.rpc('execute_sql', {
        sql: 'REFRESH MATERIALIZED VIEW public.brand_product_segments;'
      })

      // Check that data is populated
      const { data, error } = await supabase
        .from('brand_product_segments')
        .select('*')
        .limit(5)

      expect(error).toBeNull()
      
      if (data && data.length > 0) {
        const firstRow = data[0]
        
        // Verify required fields are present
        expect(firstRow.brand_id).toBeDefined()
        expect(firstRow.asin).toBeDefined()
        expect(firstRow.segment_type).toMatch(/^(daily|weekly|monthly)$/)
        expect(firstRow.segment_start_date).toBeDefined()
        expect(firstRow.segment_end_date).toBeDefined()
        
        // Verify calculated fields
        expect(typeof firstRow.total_impressions).toBe('number')
        expect(typeof firstRow.total_clicks).toBe('number')
        expect(typeof firstRow.click_through_rate).toBe('number')
        
        // Verify rates are within valid range
        if (firstRow.click_through_rate !== null) {
          expect(firstRow.click_through_rate).toBeGreaterThanOrEqual(0)
          expect(firstRow.click_through_rate).toBeLessThanOrEqual(1)
        }
      }

      // Cleanup test data
      await cleanupTestData()
    })
  })

  describe('Enhanced Brand Performance View', () => {
    it('should create brand_performance_enhanced view', async () => {
      const { data, error } = await supabase
        .from('brand_performance_enhanced')
        .select()
        .limit(0)

      expect(error).toBeNull()
      
      const { data: columns } = await supabase
        .rpc('get_table_columns', { 
          schema_name: 'public', 
          table_name: 'brand_performance_enhanced' 
        })
      
      const columnNames = columns?.map((c: any) => c.column_name) || []
      
      // Core brand performance fields
      expect(columnNames).toContain('brand_id')
      expect(columnNames).toContain('brand_name')
      expect(columnNames).toContain('asin')
      expect(columnNames).toContain('product_name')
      
      // Segment metadata
      expect(columnNames).toContain('weekly_segments_available')
      expect(columnNames).toContain('monthly_segments_available')
      expect(columnNames).toContain('daily_segments_available')
      expect(columnNames).toContain('has_weekly_data')
      expect(columnNames).toContain('has_monthly_data')
    })
  })

  describe('Performance Optimizations', () => {
    it('should have composite indexes for efficient segment queries', async () => {
      const { data: indexes } = await supabase
        .rpc('get_table_indexes', {
          schema_name: 'public',
          table_name: 'brand_product_segments'
        })

      const indexNames = indexes?.map((i: any) => i.index_name) || []
      
      // Multi-column indexes for common query patterns
      expect(indexNames).toContain('idx_brand_product_segments_brand_asin')
      expect(indexNames).toContain('idx_brand_product_segments_dates')
      
      // Check if partial indexes exist for performance data
      const { data: indexDetails } = await supabase
        .rpc('get_index_details', {
          schema_name: 'public',
          table_name: 'brand_product_segments'
        })
      
      // Should have partial index for records with actual impressions
      const partialIndex = indexDetails?.find((idx: any) => 
        idx.index_name === 'idx_brand_product_segments_performance_partial'
      )
      
      expect(partialIndex).toBeDefined()
    })

    it('should benchmark query performance for segment data', async () => {
      await setupTestData()
      
      // Refresh materialized view
      await supabase.rpc('execute_sql', {
        sql: 'REFRESH MATERIALIZED VIEW public.brand_product_segments;'
      })

      // Test query performance for common access patterns
      const startTime = Date.now()
      
      const { data, error } = await supabase
        .from('brand_product_segments')
        .select('*')
        .eq('segment_type', 'weekly')
        .gte('segment_start_date', '2024-08-01')
        .lte('segment_end_date', '2024-09-30')
        .order('total_purchases', { ascending: false })
        .limit(50)

      const queryTime = Date.now() - startTime
      
      expect(error).toBeNull()
      expect(queryTime).toBeLessThan(200) // Should be under 200ms
      
      // Log performance for monitoring
      console.log(`Segment query performance: ${queryTime}ms`)
      
      await cleanupTestData()
    })
  })

  describe('Helper Functions', () => {
    it('should create get_product_segment_metadata function', async () => {
      // Test the helper function exists and works
      const { data, error } = await supabase
        .rpc('get_product_segment_metadata', {
          p_brand_id: '123e4567-e89b-12d3-a456-426614174000', // UUID format
          p_asin: 'B08N5WRWNW',
          p_segment_type: 'weekly'
        })

      // Should not error (function exists)
      expect(error).toBeNull()
      
      // Should return expected structure
      if (data) {
        expect(typeof data).toBe('object')
      }
    })

    it('should create refresh_brand_product_segments_incremental function', async () => {
      const { data, error } = await supabase
        .rpc('refresh_brand_product_segments_incremental', {
          lookback_days: 30
        })

      expect(error).toBeNull()
      expect(typeof data).toBe('boolean')
    })

    it('should validate segment data integrity', async () => {
      await setupTestData()
      
      // Refresh materialized view
      await supabase.rpc('execute_sql', {
        sql: 'REFRESH MATERIALIZED VIEW public.brand_product_segments;'
      })

      const { data, error } = await supabase
        .from('brand_product_segments')
        .select('*')
        .limit(10)

      expect(error).toBeNull()

      if (data && data.length > 0) {
        data.forEach(segment => {
          // Validate data integrity
          expect(segment.segment_start_date <= segment.segment_end_date).toBe(true)
          
          // Validate rates are within bounds
          if (segment.click_through_rate !== null) {
            expect(segment.click_through_rate).toBeGreaterThanOrEqual(0)
            expect(segment.click_through_rate).toBeLessThanOrEqual(1)
          }
          
          if (segment.conversion_rate !== null) {
            expect(segment.conversion_rate).toBeGreaterThanOrEqual(0)
            expect(segment.conversion_rate).toBeLessThanOrEqual(1)
          }
          
          // Validate share metrics
          if (segment.click_share !== null) {
            expect(segment.click_share).toBeGreaterThanOrEqual(0)
            expect(segment.click_share).toBeLessThanOrEqual(1)
          }
        })
      }

      await cleanupTestData()
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing brand mappings gracefully', async () => {
      // Test querying segments for non-existent brand
      const { data, error } = await supabase
        .from('brand_product_segments')
        .select('*')
        .eq('brand_id', '00000000-0000-0000-0000-000000000000')

      expect(error).toBeNull()
      expect(data).toEqual([])
    })

    it('should handle date range edge cases', async () => {
      const { data, error } = await supabase
        .from('brand_product_segments')
        .select('*')
        .gte('segment_start_date', '2099-01-01')

      expect(error).toBeNull()
      expect(data).toEqual([])
    })

    it('should validate segment_type constraint', async () => {
      // This test verifies the materialized view correctly filters segment types
      const { data, error } = await supabase
        .from('brand_product_segments')
        .select('segment_type')
        .limit(100)

      expect(error).toBeNull()
      
      if (data && data.length > 0) {
        data.forEach(row => {
          expect(['daily', 'weekly', 'monthly']).toContain(row.segment_type)
        })
      }
    })
  })
})

// Helper functions for testing
const helperFunctions = `
CREATE OR REPLACE FUNCTION get_table_columns(schema_name text, table_name text)
RETURNS TABLE(column_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT c.column_name::text
  FROM information_schema.columns c
  WHERE c.table_schema = schema_name
  AND c.table_name = table_name;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_table_indexes(schema_name text, table_name text)
RETURNS TABLE(index_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT i.indexname::text
  FROM pg_indexes i
  WHERE i.schemaname = schema_name
  AND i.tablename = table_name;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_index_details(schema_name text, table_name text)
RETURNS TABLE(index_name text, index_def text) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.indexname::text,
    pg_get_indexdef(idx.indexrelid)::text
  FROM pg_indexes i
  JOIN pg_class t ON t.relname = i.tablename
  JOIN pg_namespace n ON n.nspname = i.schemaname
  JOIN pg_index idx ON idx.indrelid = t.oid
  JOIN pg_class ic ON ic.oid = idx.indexrelid
  WHERE i.schemaname = schema_name
  AND i.tablename = table_name
  AND ic.relname = i.indexname;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION execute_sql(sql text)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql;
`

// Test data setup and cleanup functions
async function setupTestData() {
  const supabaseUrl = process.env.SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Insert test brand
  const { data: brand } = await supabase
    .from('brands')
    .upsert({
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Test Brand',
      is_active: true
    })
    .select()
    .single()

  // Insert test ASIN performance data
  const { data: asinPerf } = await supabase
    .from('asin_performance_data')
    .upsert({
      start_date: '2024-08-25',
      end_date: '2024-08-31',
      asin: 'B08N5WRWNW'
    })
    .select()
    .single()

  // Insert test search query performance
  if (asinPerf) {
    await supabase
      .from('search_query_performance')
      .upsert({
        asin_performance_id: asinPerf.id,
        search_query: 'test knife sharpener',
        total_query_impression_count: 1000,
        asin_impression_count: 100,
        asin_click_count: 25,
        asin_cart_add_count: 10,
        asin_purchase_count: 5
      })
  }

  // Insert brand mapping
  await supabase
    .from('asin_brand_mapping')
    .upsert({
      asin: 'B08N5WRWNW',
      brand_id: '123e4567-e89b-12d3-a456-426614174000',
      product_name: 'Work Sharp Precision Adjust Knife Sharpener'
    })
}

async function cleanupTestData() {
  const supabaseUrl = process.env.SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Clean up in reverse order of creation
  await supabase
    .from('asin_brand_mapping')
    .delete()
    .eq('asin', 'B08N5WRWNW')

  await supabase
    .from('search_query_performance')
    .delete()
    .in('asin_performance_id', [
      // This would need the actual IDs from the test data
    ])

  await supabase
    .from('asin_performance_data')
    .delete()
    .eq('asin', 'B08N5WRWNW')

  await supabase
    .from('brands')
    .delete()
    .eq('id', '123e4567-e89b-12d3-a456-426614174000')
}