import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { BigQuery } from '@google-cloud/bigquery'

// Mock dependencies
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn()
}))

vi.mock('@google-cloud/bigquery', () => ({
  BigQuery: vi.fn()
}))

// Mock Deno global
const mockEnv = {
  get: vi.fn((key: string) => {
    const envVars: Record<string, string> = {
      'SUPABASE_URL': 'https://test.supabase.co',
      'SUPABASE_SERVICE_ROLE_KEY': 'test-service-key',
      'BIGQUERY_PROJECT_ID': 'test-project',
      'BIGQUERY_DATASET': 'test_dataset',
      'GOOGLE_APPLICATION_CREDENTIALS_JSON': JSON.stringify({
        type: 'service_account',
        project_id: 'test-project'
      })
    }
    return envVars[key]
  })
}

// @ts-ignore
global.Deno = { env: mockEnv }

describe('refresh-asin-performance', () => {
  let mockSupabase: any
  let mockBigQuery: any
  let mockDataset: any
  let mockTable: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup Supabase mock
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      rpc: vi.fn()
    }
    
    // Setup BigQuery mock
    mockTable = {
      query: vi.fn()
    }
    
    mockDataset = {
      table: vi.fn().mockReturnValue(mockTable)
    }
    
    mockBigQuery = {
      dataset: vi.fn().mockReturnValue(mockDataset),
      query: vi.fn()
    }
    
    vi.mocked(createClient).mockReturnValue(mockSupabase)
    vi.mocked(BigQuery).mockReturnValue(mockBigQuery)
  })

  describe('Checkpoint Management', () => {
    it('should check for existing checkpoint on start', async () => {
      const mockCheckpoint = {
        checkpoint_data: {
          last_processed_date: '2025-01-01',
          batch_number: 5
        }
      }
      
      mockSupabase.single.mockResolvedValueOnce({
        data: mockCheckpoint,
        error: null
      })

      const { checkForExistingCheckpoint } = await import('./asin-performance-logic')
      const checkpoint = await checkForExistingCheckpoint(mockSupabase, 'test-table')

      expect(mockSupabase.from).toHaveBeenCalledWith('sqp.refresh_checkpoints')
      expect(mockSupabase.eq).toHaveBeenCalledWith('function_name', 'refresh-asin-performance')
      expect(mockSupabase.eq).toHaveBeenCalledWith('table_name', 'test-table')
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'active')
      expect(checkpoint).toEqual(mockCheckpoint.checkpoint_data)
    })

    it('should handle no existing checkpoint', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null
      })

      const { checkForExistingCheckpoint } = await import('./asin-performance-logic')
      const checkpoint = await checkForExistingCheckpoint(mockSupabase, 'test-table')

      expect(checkpoint).toBeNull()
    })

    it('should save checkpoint after batch processing', async () => {
      const checkpointData = {
        last_processed_date: '2025-01-15',
        batch_number: 10,
        rows_processed: 5000
      }

      const { saveCheckpoint } = await import('./asin-performance-logic')
      await saveCheckpoint(mockSupabase, 'test-table', checkpointData)

      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          function_name: 'refresh-asin-performance',
          table_name: 'test-table',
          checkpoint_data: checkpointData,
          status: 'active'
        }),
        expect.objectContaining({
          onConflict: 'function_name,table_schema,table_name,status'
        })
      )
    })

    it('should mark checkpoint as completed when done', async () => {
      const { completeCheckpoint } = await import('./asin-performance-logic')
      await completeCheckpoint(mockSupabase, 'test-table')

      expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'completed' })
      expect(mockSupabase.eq).toHaveBeenCalledWith('function_name', 'refresh-asin-performance')
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'active')
    })
  })

  describe('BigQuery Data Fetching', () => {
    it('should query BigQuery for new data since last sync', async () => {
      const lastSyncDate = '2025-01-01'
      const mockRows = [
        { 
          start_date: { value: '2025-01-02' },
          end_date: { value: '2025-01-08' },
          asin: 'B001234567',
          parent_asin: 'B001234567',
          brand: 'Test Brand',
          product_title: 'Test Product',
          market_impressions: 1000,
          asin_impressions: 100
        }
      ]

      mockBigQuery.query.mockResolvedValueOnce([mockRows])

      const { fetchNewDataFromBigQuery } = await import('./asin-performance-logic')
      const rows = await fetchNewDataFromBigQuery(mockBigQuery, lastSyncDate)

      expect(mockBigQuery.query).toHaveBeenCalledWith({
        query: expect.stringContaining('WHERE end_date > @lastProcessedDate'),
        params: { lastProcessedDate: lastSyncDate },
        useLegacySql: false
      })
      expect(rows).toEqual(mockRows)
    })

    it('should handle BigQuery date object format', async () => {
      const mockRow = {
        start_date: { value: '2025-01-02T00:00:00.000Z' },
        end_date: { value: '2025-01-08T00:00:00.000Z' },
        asin: 'B001234567'
      }

      const { transformAsinPerformanceRow } = await import('./asin-performance-logic')
      const transformed = transformAsinPerformanceRow(mockRow)

      expect(transformed.start_date).toBe('2025-01-02T00:00:00.000Z')
      expect(transformed.end_date).toBe('2025-01-08T00:00:00.000Z')
    })

    it('should limit query results to batch size', async () => {
      const batchSize = 5000
      mockBigQuery.query.mockResolvedValueOnce([Array(batchSize).fill({})])

      const { fetchNewDataFromBigQuery } = await import('./asin-performance-logic')
      await fetchNewDataFromBigQuery(mockBigQuery, '2025-01-01', batchSize)

      expect(mockBigQuery.query).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.stringContaining(`LIMIT ${batchSize}`)
        })
      )
    })
  })

  describe('Data Transformation', () => {
    it('should transform BigQuery row to Supabase format', async () => {
      const bigQueryRow = {
        start_date: { value: '2025-01-02' },
        end_date: { value: '2025-01-08' },
        asin: 'B001234567',
        parent_asin: 'B001234567',
        brand: 'Test Brand',
        product_title: 'Test Product',
        market_impressions: 1000,
        market_clicks: 100,
        market_cart_adds: 50,
        market_purchases: 25,
        asin_impressions: 500,
        asin_clicks: 50,
        asin_cart_adds: 25,
        asin_purchases: 10,
        market_price_median: 29.99,
        asin_price_median: 29.99
      }

      const { transformAsinPerformanceRow } = await import('./asin-performance-logic')
      const transformed = transformAsinPerformanceRow(bigQueryRow)

      expect(transformed).toEqual({
        start_date: '2025-01-02',
        end_date: '2025-01-08',
        asin: 'B001234567',
        parent_asin: 'B001234567',
        brand: 'Test Brand',
        product_title: 'Test Product',
        market_impressions: 1000,
        market_clicks: 100,
        market_cart_adds: 50,
        market_purchases: 25,
        asin_impressions: 500,
        asin_clicks: 50,
        asin_cart_adds: 25,
        asin_purchases: 10,
        market_price_median: 29.99,
        asin_price_median: 29.99
      })
    })

    it('should handle null values in transformation', async () => {
      const bigQueryRow = {
        start_date: '2025-01-02',
        end_date: '2025-01-08',
        asin: 'B001234567',
        parent_asin: null,
        brand: null,
        product_title: 'Test Product',
        market_impressions: 1000,
        asin_impressions: null
      }

      const { transformAsinPerformanceRow } = await import('./asin-performance-logic')
      const transformed = transformAsinPerformanceRow(bigQueryRow)

      expect(transformed.parent_asin).toBeNull()
      expect(transformed.brand).toBeNull()
      expect(transformed.asin_impressions).toBeNull()
    })
  })

  describe('Batch Processing', () => {
    it('should process data in batches', async () => {
      const mockRows = Array(1500).fill({}).map((_, i) => ({
        start_date: '2025-01-02',
        end_date: '2025-01-08',
        asin: `B00${1234567 + i}`,
        market_impressions: 1000
      }))

      mockSupabase.select.mockResolvedValue({ data: [], error: null })

      const { processBatch } = await import('./asin-performance-logic')
      const result = await processBatch(mockSupabase, mockRows, 500)

      // Should be called 3 times (1500 / 500)
      expect(mockSupabase.upsert).toHaveBeenCalledTimes(3)
      expect(result.rowsProcessed).toBe(1500)
    })

    it('should update checkpoint after each batch', async () => {
      const mockRows = Array(1000).fill({}).map((_, i) => ({
        start_date: '2025-01-02',
        end_date: '2025-01-08',
        asin: `B00${1234567 + i}`
      }))

      mockSupabase.select.mockResolvedValue({ data: [], error: null })

      const { processBatchWithCheckpoint } = await import('./asin-performance-logic')
      await processBatchWithCheckpoint(mockSupabase, mockRows, 500, 1)

      // Checkpoint should be saved after each batch
      expect(mockSupabase.from).toHaveBeenCalledWith('sqp.refresh_checkpoints')
      expect(mockSupabase.upsert).toHaveBeenCalled()
    })
  })

  describe('Time Limit Handling', () => {
    it('should detect when approaching time limit', async () => {
      const startTime = Date.now()
      const timeLimit = 240000 // 4 minutes
      
      // Simulate time passing
      const mockNow = vi.spyOn(Date, 'now')
      mockNow.mockReturnValue(startTime + timeLimit - 10000) // 10 seconds before limit

      const { isApproachingTimeLimit } = await import('./asin-performance-logic')
      const shouldStop = isApproachingTimeLimit(startTime, timeLimit)

      expect(shouldStop).toBe(true)
    })

    it('should schedule continuation when time limit reached', async () => {
      mockSupabase.functions = { invoke: vi.fn() }
      
      const config = { id: 1, table_name: 'test_table' }
      const auditLogId = 123

      const { scheduleContinuation } = await import('./asin-performance-logic')
      await scheduleContinuation(mockSupabase, config, auditLogId)

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        'refresh-asin-performance',
        {
          body: { config, auditLogId }
        }
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle BigQuery errors', async () => {
      const error = new Error('BigQuery connection failed')
      mockBigQuery.query.mockRejectedValueOnce(error)

      const { fetchNewDataFromBigQuery } = await import('./asin-performance-logic')
      await expect(fetchNewDataFromBigQuery(mockBigQuery, '2025-01-01'))
        .rejects.toThrow('BigQuery connection failed')
    })

    it('should handle upsert conflicts', async () => {
      mockSupabase.upsert.mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'Duplicate key' }
      })

      const { processBatch } = await import('./asin-performance-logic')
      const rows = [{ asin: 'B001234567' }]
      
      await expect(processBatch(mockSupabase, rows))
        .rejects.toThrow()
    })

    it('should update audit log on failure', async () => {
      const auditLogId = 123
      const error = { message: 'Test error' }

      const { updateAuditLogError } = await import('./asin-performance-logic')
      await updateAuditLogError(mockSupabase, auditLogId, error)

      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: 'failed',
        error_message: error.message,
        refresh_completed_at: expect.any(String)
      })
    })
  })

  describe('Last Sync Date Detection', () => {
    it('should get last sync date from existing data', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { end_date: '2025-01-15' },
        error: null
      })

      const { getLastSyncDate } = await import('./asin-performance-logic')
      const lastDate = await getLastSyncDate(mockSupabase)

      expect(mockSupabase.from).toHaveBeenCalledWith('sqp.asin_performance_data')
      expect(mockSupabase.order).toHaveBeenCalledWith('end_date', { ascending: false })
      expect(lastDate).toBe('2025-01-15')
    })

    it('should return default date when no data exists', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null
      })

      const { getLastSyncDate } = await import('./asin-performance-logic')
      const lastDate = await getLastSyncDate(mockSupabase)

      expect(lastDate).toBe('2024-08-18') // Default start date
    })
  })

  describe('Performance Metrics', () => {
    it('should track and log performance metrics', async () => {
      const metrics = {
        rowsProcessed: 5000,
        rowsInserted: 4500,
        rowsUpdated: 500,
        startTime: Date.now() - 30000 // 30 seconds ago
      }

      const { logPerformanceMetrics } = await import('./asin-performance-logic')
      await logPerformanceMetrics(mockSupabase, 123, metrics)

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          rows_processed: 5000,
          rows_inserted: 4500,
          rows_updated: 500,
          execution_time_ms: expect.any(Number),
          status: 'success'
        })
      )
    })
  })
})