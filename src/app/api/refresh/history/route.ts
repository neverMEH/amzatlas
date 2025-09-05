import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50')))
    const tableName = searchParams.get('table_name')
    const status = searchParams.get('status')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Validate pagination parameters
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      )
    }

    // Build query
    let query = supabase.from('refresh_audit_log').select('*', { count: 'exact' })
    
    // Apply filters
    if (tableName) {
      query = query.eq('table_name', tableName)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (startDate) {
      query = query.gte('refresh_started_at', startDate)
    }
    if (endDate) {
      query = query.lte('refresh_started_at', endDate)
    }

    // Get total count
    const { count } = await query

    // Get paginated data
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize - 1
    
    const { data: history, error } = await query
      .order('refresh_started_at', { ascending: false })
      .range(startIndex, endIndex)

    if (error) {
      throw new Error(error.message)
    }

    // Process history entries
    const processedHistory = history?.map(entry => {
      const startTime = new Date(entry.refresh_started_at)
      const endTime = entry.refresh_completed_at ? new Date(entry.refresh_completed_at) : null
      const durationMinutes = endTime 
        ? Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))
        : null

      return {
        id: entry.id,
        table_name: entry.table_name,
        table_schema: entry.table_schema,
        status: entry.status,
        refresh_type: entry.refresh_type,
        started_at: entry.refresh_started_at,
        completed_at: entry.refresh_completed_at,
        duration_minutes: durationMinutes,
        rows_processed: entry.rows_processed,
        rows_inserted: entry.rows_inserted,
        rows_updated: entry.rows_updated,
        rows_deleted: entry.rows_deleted,
        execution_time_ms: entry.execution_time_ms,
        memory_used_mb: entry.memory_used_mb,
        error_message: entry.error_message,
        error_details: entry.error_details,
        bigquery_job_id: entry.bigquery_job_id,
        function_name: entry.function_name
      }
    }) || []

    // Calculate summary statistics
    const summary = {
      total: count || 0,
      success: 0,
      failed: 0,
      running: 0,
      warning: 0,
      average_duration_minutes: 0,
      total_rows_processed: 0
    }

    if (processedHistory.length > 0) {
      const durations: number[] = []
      
      processedHistory.forEach(entry => {
        summary[entry.status as keyof typeof summary]++
        if (entry.duration_minutes) {
          durations.push(entry.duration_minutes)
        }
        if (entry.rows_processed) {
          summary.total_rows_processed += entry.rows_processed
        }
      })

      if (durations.length > 0) {
        summary.average_duration_minutes = 
          Math.round(durations.reduce((a, b) => a + b, 0) / durations.length * 10) / 10
      }
    }

    // Calculate pagination info
    const totalPages = Math.ceil((count || 0) / pageSize)
    
    const pagination = {
      page,
      pageSize,
      total: count || 0,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1
    }

    return NextResponse.json({
      history: processedHistory,
      summary,
      pagination,
      filters: {
        table_name: tableName,
        status,
        start_date: startDate,
        end_date: endDate
      }
    })

  } catch (error) {
    console.error('Error fetching refresh history:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch refresh history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}