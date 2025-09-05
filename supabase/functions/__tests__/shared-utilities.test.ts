import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  withErrorHandling, 
  handleBigQueryError, 
  withRetry,
  createErrorResponse,
  createSuccessResponse
} from '../_shared/error-handler'

describe('Shared Error Handler Utilities', () => {
  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis()
    }
  })

  describe('withErrorHandling', () => {
    it('should return result on successful operation', async () => {
      const successfulOperation = async () => ({ data: 'success' })
      const context = {
        functionName: 'test-function',
        supabase: mockSupabase
      }

      const result = await withErrorHandling(successfulOperation, context)
      expect(result).toEqual({ data: 'success' })
    })

    it('should handle errors and update audit log', async () => {
      const failingOperation = async () => {
        throw new Error('Test error')
      }
      const context = {
        functionName: 'test-function',
        supabase: mockSupabase,
        auditLogId: 123,
        tableName: 'test_table'
      }

      const result = await withErrorHandling(failingOperation, context)
      
      expect(result).toHaveProperty('error')
      expect((result as any).error.message).toBe('Test error')
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_message: 'Test error'
        })
      )
    })
  })

  describe('handleBigQueryError', () => {
    it('should map known BigQuery error codes', () => {
      const error = { code: 'PERMISSION_DENIED', message: 'Access denied' }
      const result = handleBigQueryError(error)
      
      expect(result.code).toBe('PERMISSION_DENIED')
      expect(result.message).toContain('check service account permissions')
    })

    it('should handle unknown error codes', () => {
      const error = { code: 'UNKNOWN_CODE', message: 'Something went wrong' }
      const result = handleBigQueryError(error)
      
      expect(result.code).toBe('UNKNOWN_CODE')
      expect(result.message).toBe('Something went wrong')
    })
  })

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      const result = await withRetry(operation, 3)
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry on retryable errors', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce({ code: 'TIMEOUT' })
        .mockRejectedValueOnce({ code: 'TIMEOUT' })
        .mockResolvedValue('success')
      
      const result = await withRetry(operation, 3, 10) // Short delay for tests
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('should not retry non-retryable errors', async () => {
      const operation = vi.fn()
        .mockRejectedValue({ code: 'INVALID_ARGUMENT' })
      
      await expect(withRetry(operation, 3)).rejects.toEqual({ code: 'INVALID_ARGUMENT' })
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should throw after max attempts', async () => {
      const operation = vi.fn()
        .mockRejectedValue({ code: 'TIMEOUT' })
      
      await expect(withRetry(operation, 2, 10)).rejects.toEqual({ code: 'TIMEOUT' })
      expect(operation).toHaveBeenCalledTimes(2)
    })
  })

  describe('Response helpers', () => {
    it('should create error response with correct headers', () => {
      const error = {
        code: 'TEST_ERROR',
        message: 'Test error message',
        timestamp: '2025-01-01T00:00:00Z'
      }
      
      const response = createErrorResponse(error, 400)
      
      expect(response.status).toBe(400)
      expect(response.headers.get('Content-Type')).toBe('application/json')
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })

    it('should create success response with correct format', () => {
      const data = { result: 'success', count: 10 }
      const response = createSuccessResponse(data)
      
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })
  })
})