import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

export interface ErrorContext {
  functionName: string
  supabase: SupabaseClient
  auditLogId?: number
  tableName?: string
}

export interface RefreshError {
  code: string
  message: string
  details?: any
  timestamp: string
}

/**
 * Wraps an async operation with error handling and audit logging
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: ErrorContext
): Promise<T | { error: RefreshError }> {
  const startTime = Date.now()
  
  try {
    return await operation()
  } catch (error: any) {
    const refreshError: RefreshError = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      details: {
        stack: error.stack,
        function: context.functionName,
        table: context.tableName
      },
      timestamp: new Date().toISOString()
    }
    
    console.error(`${context.functionName} error:`, refreshError)
    
    // Update audit log if we have an ID
    if (context.auditLogId) {
      await context.supabase
        .from('sqp.refresh_audit_log')
        .update({
          status: 'failed',
          error_message: refreshError.message,
          error_details: refreshError,
          execution_time_ms: Date.now() - startTime,
          refresh_completed_at: new Date().toISOString()
        })
        .eq('id', context.auditLogId)
    }
    
    return { error: refreshError }
  }
}

/**
 * Handles BigQuery specific errors
 */
export function handleBigQueryError(error: any): RefreshError {
  // Map common BigQuery errors to friendly messages
  const errorMappings: Record<string, string> = {
    'PERMISSION_DENIED': 'BigQuery permission denied - check service account permissions',
    'TIMEOUT': 'BigQuery query timeout - consider reducing batch size',
    'RATE_LIMIT_EXCEEDED': 'BigQuery rate limit exceeded - implement backoff',
    'INVALID_ARGUMENT': 'Invalid query parameters',
    'NOT_FOUND': 'BigQuery table or dataset not found'
  }

  const code = error.code || 'BIGQUERY_ERROR'
  const message = errorMappings[code] || error.message || 'BigQuery operation failed'

  return {
    code,
    message,
    details: error.details || {},
    timestamp: new Date().toISOString()
  }
}

/**
 * Implements exponential backoff for retryable operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: any

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error: any) {
      lastError = error
      
      // Don't retry on non-retryable errors
      if (!isRetryableError(error)) {
        throw error
      }

      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1)
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}

/**
 * Determines if an error is retryable
 */
function isRetryableError(error: any): boolean {
  const retryableCodes = [
    'TIMEOUT',
    'RATE_LIMIT_EXCEEDED',
    'INTERNAL',
    'UNAVAILABLE',
    'RESOURCE_EXHAUSTED',
    'DEADLINE_EXCEEDED'
  ]

  return retryableCodes.includes(error.code) || 
         error.status === 429 || // Rate limited
         error.status === 503 || // Service unavailable
         error.status >= 500     // Server errors
}

/**
 * Logs performance metrics to audit log
 */
export async function logPerformanceMetrics(
  supabase: SupabaseClient,
  auditLogId: number,
  metrics: {
    rowsProcessed?: number
    rowsInserted?: number
    rowsUpdated?: number
    rowsDeleted?: number
    memoryUsedMb?: number
    bigqueryJobId?: string
    syncMetadata?: any
  }
) {
  const executionTimeMs = Date.now() - (metrics.syncMetadata?.startTime || Date.now())
  
  await supabase
    .from('sqp.refresh_audit_log')
    .update({
      ...metrics,
      execution_time_ms: executionTimeMs,
      status: 'success',
      refresh_completed_at: new Date().toISOString()
    })
    .eq('id', auditLogId)
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(error: RefreshError, statusCode: number = 500) {
  return new Response(
    JSON.stringify({
      success: false,
      error: error.message,
      code: error.code,
      timestamp: error.timestamp
    }),
    {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    }
  )
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse(data: any) {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString()
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    }
  )
}