// Shared utilities for edge functions

export interface ErrorResponse {
  error: string
  details?: any
}

export interface SuccessResponse<T = any> {
  success: boolean
  data?: T
  message?: string
}

export function createErrorResponse(error: string, details?: any): Response {
  console.error('Error:', error, details)
  return new Response(
    JSON.stringify({ error, details }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

export function createSuccessResponse<T>(data?: T, message?: string): Response {
  return new Response(
    JSON.stringify({ success: true, data, message }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

export async function logError(supabase: any, auditLogId: number, error: string) {
  await supabase
    .from('refresh_audit_log')
    .update({
      status: 'failed',
      error_message: error,
      refresh_completed_at: new Date().toISOString()
    })
    .eq('id', auditLogId)
}