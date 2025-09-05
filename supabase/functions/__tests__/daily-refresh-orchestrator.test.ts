import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
    functions: {
      invoke: vi.fn()
    }
  }))
}))

// Mock Deno global
const mockEnv = {
  get: vi.fn((key: string) => {
    const envVars: Record<string, string> = {
      'SUPABASE_URL': 'https://test.supabase.co',
      'SUPABASE_SERVICE_ROLE_KEY': 'test-service-key'
    }
    return envVars[key]
  })
}

// @ts-ignore
global.Deno = { env: mockEnv }

describe('daily-refresh-orchestrator', () => {
  let mockSupabase: any
  let orchestratorFunction: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create a chainable mock that always returns itself
    const createChainableMock = () => {
      const mock: any = {
        from: vi.fn(),
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        eq: vi.fn(),
        lte: vi.fn(),
        order: vi.fn(),
        single: vi.fn(),
        functions: {
          invoke: vi.fn()
        }
      }
      
      // Make each method return the mock itself for chaining
      Object.keys(mock).forEach(key => {
        if (typeof mock[key] === 'function' && key !== 'functions') {
          mock[key].mockReturnValue(mock)
        }
      })
      
      return mock
    }
    
    mockSupabase = createChainableMock()
    
    // Make createClient return our mock
    vi.mocked(createClient).mockReturnValue(mockSupabase)
  })

  describe('Table Refresh Selection', () => {
    it('should query enabled tables due for refresh', async () => {
      const mockTables = [
        { 
          id: 1, 
          table_schema: 'sqp',
          table_name: 'asin_performance_data', 
          priority: 90,
          is_enabled: true,
          next_refresh_at: '2025-01-01T00:00:00Z'
        }
      ]

      // Override the order method to return the final result
      mockSupabase.order.mockResolvedValueOnce({ 
        data: mockTables, 
        error: null 
      })

      // Import and execute the function
      const { handleRefreshOrchestration } = await import('./orchestrator-logic')
      const result = await handleRefreshOrchestration(mockSupabase)

      expect(mockSupabase.from).toHaveBeenCalledWith('sqp.refresh_config')
      expect(mockSupabase.eq).toHaveBeenCalledWith('is_enabled', true)
      expect(mockSupabase.order).toHaveBeenCalledWith('priority', { ascending: false })
      expect(result.tablesToRefresh).toHaveLength(1)
    })

    it('should handle empty table list gracefully', async () => {
      mockSupabase.order.mockResolvedValueOnce({ 
        data: [], 
        error: null 
      })

      const { handleRefreshOrchestration } = await import('./orchestrator-logic')
      const result = await handleRefreshOrchestration(mockSupabase)

      expect(result.tablesToRefresh).toHaveLength(0)
      expect(result.error).toBeUndefined()
    })

    it('should handle query errors', async () => {
      mockSupabase.order.mockResolvedValueOnce({ 
        data: null, 
        error: { message: 'Database error' } 
      })

      const { handleRefreshOrchestration } = await import('./orchestrator-logic')
      const result = await handleRefreshOrchestration(mockSupabase)

      expect(result.error).toBe('Database error')
      expect(result.tablesToRefresh).toBeUndefined()
    })
  })

  describe('Audit Log Creation', () => {
    it('should create audit log entry for each table refresh', async () => {
      const mockConfig = {
        id: 1,
        table_schema: 'sqp',
        table_name: 'asin_performance_data'
      }

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 123,
          refresh_config_id: 1,
          status: 'running'
        },
        error: null
      })

      const { createAuditLogEntry } = await import('./orchestrator-logic')
      const auditLog = await createAuditLogEntry(mockSupabase, mockConfig)

      expect(mockSupabase.from).toHaveBeenCalledWith('sqp.refresh_audit_log')
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        refresh_config_id: mockConfig.id,
        table_schema: mockConfig.table_schema,
        table_name: mockConfig.table_name,
        refresh_started_at: expect.any(String),
        status: 'running'
      })
      expect(auditLog.id).toBe(123)
    })
  })

  describe('Function Invocation', () => {
    it('should invoke correct function based on table name', async () => {
      const testCases = [
        { tableName: 'asin_performance_data', expectedFunction: 'refresh-asin-performance' },
        { tableName: 'search_query_performance', expectedFunction: 'refresh-search-queries' },
        { tableName: 'weekly_summary', expectedFunction: 'refresh-summary-tables' },
        { tableName: 'unknown_table', expectedFunction: 'refresh-generic-table' }
      ]

      const { getFunctionNameForTable } = await import('./orchestrator-logic')

      testCases.forEach(({ tableName, expectedFunction }) => {
        expect(getFunctionNameForTable(tableName)).toBe(expectedFunction)
      })
    })

    it('should pass config and audit log ID to worker function', async () => {
      const mockConfig = {
        id: 1,
        table_name: 'asin_performance_data'
      }
      const auditLogId = 123

      mockSupabase.functions.invoke.mockResolvedValueOnce({
        data: { success: true },
        error: null
      })

      const { invokeRefreshFunction } = await import('./orchestrator-logic')
      await invokeRefreshFunction(mockSupabase, mockConfig, auditLogId)

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        'refresh-asin-performance',
        {
          body: {
            config: mockConfig,
            auditLogId: auditLogId
          }
        }
      )
    })
  })

  describe('Next Refresh Time Update', () => {
    it('should update next refresh time after successful refresh', async () => {
      const mockConfig = {
        id: 1,
        refresh_frequency_hours: 24
      }

      const { updateNextRefreshTime } = await import('./orchestrator-logic')
      await updateNextRefreshTime(mockSupabase, mockConfig)

      expect(mockSupabase.from).toHaveBeenCalledWith('sqp.refresh_config')
      expect(mockSupabase.update).toHaveBeenCalledWith({
        last_refresh_at: expect.any(String),
        next_refresh_at: expect.any(String)
      })
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', mockConfig.id)
    })

    it('should calculate correct next refresh time', async () => {
      const mockConfig = {
        id: 1,
        refresh_frequency_hours: 12
      }

      const { calculateNextRefreshTime } = await import('./orchestrator-logic')
      const now = new Date()
      const nextTime = calculateNextRefreshTime(now, mockConfig.refresh_frequency_hours)

      const expectedTime = new Date(now.getTime() + 12 * 60 * 60 * 1000)
      expect(nextTime.toISOString()).toBe(expectedTime.toISOString())
    })
  })

  describe('Error Handling', () => {
    it('should update audit log on function invocation error', async () => {
      const mockConfig = { id: 1, table_name: 'test_table' }
      const auditLogId = 123
      const error = { message: 'Function timeout' }

      mockSupabase.functions.invoke.mockResolvedValueOnce({
        data: null,
        error
      })

      const { invokeRefreshFunction } = await import('./orchestrator-logic')
      const result = await invokeRefreshFunction(mockSupabase, mockConfig, auditLogId)

      expect(mockSupabase.from).toHaveBeenCalledWith('sqp.refresh_audit_log')
      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: 'failed',
        error_message: error.message,
        refresh_completed_at: expect.any(String)
      })
      expect(result.error).toBe(error.message)
    })

    it('should handle multiple table refresh failures independently', async () => {
      const mockTables = [
        { id: 1, table_name: 'table1', table_schema: 'sqp', refresh_frequency_hours: 24 },
        { id: 2, table_name: 'table2', table_schema: 'sqp', refresh_frequency_hours: 24 }
      ]

      // Mock audit log creation to return IDs
      mockSupabase.single
        .mockResolvedValueOnce({ data: { id: 1 }, error: null })
        .mockResolvedValueOnce({ data: { id: 2 }, error: null })

      // First table succeeds, second fails
      mockSupabase.functions.invoke
        .mockResolvedValueOnce({ data: { success: true }, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Failed' } })

      const { processTableRefreshes } = await import('./orchestrator-logic')
      const results = await processTableRefreshes(mockSupabase, mockTables)

      expect(results).toHaveLength(2)
      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('fulfilled') // Promise.allSettled doesn't reject
    })
  })

  describe('CORS Handling', () => {
    it('should handle OPTIONS request for CORS', async () => {
      const mockRequest = {
        method: 'OPTIONS'
      }

      const { handleCORS } = await import('./orchestrator-logic')
      const response = handleCORS(mockRequest)

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })
  })

  describe('Response Format', () => {
    it('should return success response with table count', async () => {
      const results = [
        { status: 'fulfilled', value: { success: true } },
        { status: 'fulfilled', value: { success: true } }
      ]

      const { formatResponse } = await import('./orchestrator-logic')
      const response = formatResponse(results)

      expect(response.success).toBe(true)
      expect(response.tablesProcessed).toBe(2)
      expect(response.results).toHaveLength(2)
    })

    it('should return error response on orchestrator failure', async () => {
      const error = new Error('Orchestrator failed')

      const { formatErrorResponse } = await import('./orchestrator-logic')
      const response = formatErrorResponse(error)

      expect(response.error).toBe('Orchestrator failed')
      expect(response.success).toBe(false)
    })
  })
})