import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { reportGenerationService } from '@/services/reports/report-generation-service'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    const { configurationId } = body

    if (!configurationId) {
      return NextResponse.json(
        { error: 'Configuration ID is required' },
        { status: 400 }
      )
    }

    // Create execution history entry
    const { data: execution, error: execError } = await supabase
      .from('report_execution_history')
      .insert({
        report_configuration_id: configurationId,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (execError) {
      console.error('Error creating execution history:', execError)
      return NextResponse.json(
        { error: 'Failed to start report generation' },
        { status: 500 }
      )
    }

    try {
      // Generate the report
      const startTime = Date.now()
      const report = await reportGenerationService.generateReport(configurationId)
      const executionTime = Date.now() - startTime

      // Update execution history with success
      await supabase
        .from('report_execution_history')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          execution_time_ms: executionTime,
          rows_processed: report.sections.reduce((total: number, section: any) => {
            if (Array.isArray(section.data)) return total + section.data.length
            if (section.data?.rows) return total + section.data.rows
            return total
          }, 0)
        })
        .eq('id', execution.id)

      // Update configuration last run time
      await supabase
        .from('report_configurations')
        .update({
          last_run_at: new Date().toISOString()
        })
        .eq('id', configurationId)

      return NextResponse.json({
        success: true,
        executionId: execution.id,
        report: {
          ...report,
          execution_time_ms: executionTime
        }
      })
    } catch (error) {
      // Update execution history with failure
      await supabase
        .from('report_execution_history')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', execution.id)

      throw error
    }
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// Process queued reports
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check for pending reports in the queue
    const { data: queuedReports, error: queueError } = await supabase
      .from('report_queue')
      .select('*, report_configurations(*)')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('priority', { ascending: true })
      .order('scheduled_for', { ascending: true })
      .limit(5)

    if (queueError) {
      console.error('Error fetching queued reports:', queueError)
      return NextResponse.json(
        { error: 'Failed to fetch queued reports' },
        { status: 500 }
      )
    }

    const processed = []

    for (const queueItem of queuedReports || []) {
      try {
        // Update queue status to processing
        await supabase
          .from('report_queue')
          .update({ 
            status: 'processing',
            last_attempt_at: new Date().toISOString(),
            attempts: queueItem.attempts + 1
          })
          .eq('id', queueItem.id)

        // Create execution history entry
        const { data: execution, error: execError } = await supabase
          .from('report_execution_history')
          .insert({
            report_configuration_id: queueItem.report_configuration_id,
            status: 'running',
            started_at: new Date().toISOString()
          })
          .select()
          .single()

        if (execError) throw execError

        // Generate the report
        const startTime = Date.now()
        const report = await reportGenerationService.generateReport(queueItem.report_configuration_id)
        const executionTime = Date.now() - startTime

        // Update execution history with success
        await supabase
          .from('report_execution_history')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            execution_time_ms: executionTime
          })
          .eq('id', execution.id)

        // Update queue status to completed
        await supabase
          .from('report_queue')
          .update({ 
            status: 'completed',
            execution_history_id: execution.id
          })
          .eq('id', queueItem.id)

        // Update configuration last run time
        await supabase
          .from('report_configurations')
          .update({
            last_run_at: new Date().toISOString()
          })
          .eq('id', queueItem.report_configuration_id)

        processed.push({
          queueId: queueItem.id,
          configurationId: queueItem.report_configuration_id,
          executionId: execution.id,
          status: 'completed'
        })
      } catch (error) {
        // Handle processing error
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        // Update queue status
        const shouldRetry = queueItem.attempts < queueItem.max_attempts
        await supabase
          .from('report_queue')
          .update({ 
            status: shouldRetry ? 'pending' : 'failed',
            error_message: errorMessage,
            next_attempt_at: shouldRetry 
              ? new Date(Date.now() + Math.pow(2, queueItem.attempts) * 60000).toISOString() // Exponential backoff
              : null
          })
          .eq('id', queueItem.id)

        processed.push({
          queueId: queueItem.id,
          configurationId: queueItem.report_configuration_id,
          status: 'failed',
          error: errorMessage
        })
      }
    }

    // Enqueue any scheduled reports that are due
    const { data: enqueuedCount } = await supabase
      .rpc('enqueue_scheduled_reports')

    return NextResponse.json({
      processed,
      enqueuedCount: enqueuedCount || 0,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}