import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BigQuery } from 'https://esm.sh/@google-cloud/bigquery@7'
import { createErrorResponse, createSuccessResponse, logError } from '../_shared/utils.ts'

const FUNCTION_TIMEOUT = 300000 // 5 minutes
const BATCH_SIZE = 1000

serve(async (req) => {
  const startTime = Date.now()
  let auditLogId: number | null = null

  try {
    const { config, auditLogId: providedAuditLogId } = await req.json()
    auditLogId = providedAuditLogId

    console.log('Refreshing ASIN performance data...')

    // Create clients
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Initialize BigQuery
    const credentials = JSON.parse(Deno.env.get('GOOGLE_APPLICATION_CREDENTIALS_JSON') ?? '{}')
    const bigquery = new BigQuery({
      projectId: credentials.project_id,
      credentials: credentials,
      location: 'US'
    })

    // Check for existing checkpoint
    const { data: checkpoint } = await supabase
      .from('refresh_checkpoints')
      .select('*')
      .eq('function_name', 'refresh-asin-performance')
      .eq('table_schema', 'sqp')
      .eq('table_name', 'asin_performance_data')
      .eq('status', 'active')
      .single()

    let offset = 0
    let processedRows = 0
    
    if (checkpoint) {
      offset = checkpoint.last_processed_row || 0
      processedRows = offset
      console.log(`Resuming from checkpoint: offset ${offset}`)
    }

    // BigQuery query for ASIN performance data
    const query = `
      SELECT DISTINCT
        PARSE_DATE('%Y-%m-%d', \`Start Date\`) as start_date,
        PARSE_DATE('%Y-%m-%d', \`End Date\`) as end_date,
        \`Child ASIN\` as asin,
        \`Product Name\` as product_name,
        \`Brand\` as brand
      FROM \`dataclient_amzatlas_agency_85.amz_atlas_product_data_search_query_performance_85\`
      WHERE \`Child ASIN\` IS NOT NULL
      ORDER BY start_date DESC, asin
      LIMIT ${BATCH_SIZE}
      OFFSET ${offset}
    `

    const [job] = await bigquery.createQueryJob({
      query,
      location: 'US',
    })

    console.log(`BigQuery job started: ${job.id}`)
    
    const [rows] = await job.getQueryResults()
    
    if (!rows || rows.length === 0) {
      console.log('No more data to process')
      
      // Clean up checkpoint
      if (checkpoint) {
        await supabase
          .from('refresh_checkpoints')
          .update({ status: 'completed' })
          .eq('id', checkpoint.id)
      }

      // Update audit log
      if (auditLogId) {
        await supabase
          .from('refresh_audit_log')
          .update({
            status: 'success',
            rows_processed: processedRows,
            execution_time_ms: Date.now() - startTime,
            refresh_completed_at: new Date().toISOString()
          })
          .eq('id', auditLogId)
      }

      return createSuccessResponse({ 
        rowsProcessed: processedRows,
        message: 'ASIN performance data refresh completed' 
      })
    }

    console.log(`Processing ${rows.length} rows (offset: ${offset})`)

    // Transform and upsert data
    const transformedData = rows.map(row => ({
      start_date: row.start_date?.value || row.start_date,
      end_date: row.end_date?.value || row.end_date,
      asin: row.asin,
      product_name: row.product_name,
      brand: row.brand,
      updated_at: new Date().toISOString()
    }))

    // Batch upsert to avoid conflicts
    const { error: upsertError } = await supabase
      .from('asin_performance_data')
      .upsert(transformedData, { onConflict: 'start_date,end_date,asin' })

    if (upsertError) {
      throw new Error(`Upsert failed: ${upsertError.message}`)
    }

    processedRows += rows.length
    const newOffset = offset + rows.length

    // Check if we're approaching timeout
    if (Date.now() - startTime > FUNCTION_TIMEOUT - 30000) { // 30s buffer
      console.log('Approaching timeout, saving checkpoint...')
      
      // Create or update checkpoint
      await supabase
        .from('refresh_checkpoints')
        .upsert({
          function_name: 'refresh-asin-performance',
          table_schema: 'sqp',
          table_name: 'asin_performance_data',
          checkpoint_data: { offset: newOffset },
          last_processed_row: newOffset,
          status: 'active',
          updated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour
        }, { onConflict: 'function_name,table_schema,table_name,status' })

      // Continue processing by invoking self
      await supabase.functions.invoke('refresh-asin-performance', {
        body: { config, auditLogId }
      })

      return createSuccessResponse({ 
        rowsProcessed: processedRows,
        message: 'Checkpoint saved, continuing in new invocation' 
      })
    }

    // Continue processing more batches
    if (rows.length === BATCH_SIZE) {
      // More data available, continue
      await supabase.functions.invoke('refresh-asin-performance', {
        body: { config, auditLogId }
      })
    } else {
      // Final batch completed
      if (checkpoint) {
        await supabase
          .from('refresh_checkpoints')
          .update({ status: 'completed' })
          .eq('id', checkpoint.id)
      }

      if (auditLogId) {
        await supabase
          .from('refresh_audit_log')
          .update({
            status: 'success',
            rows_processed: processedRows,
            rows_inserted: processedRows, // For this function, processed = inserted
            execution_time_ms: Date.now() - startTime,
            bigquery_job_id: job.id,
            refresh_completed_at: new Date().toISOString()
          })
          .eq('id', auditLogId)
      }
    }

    return createSuccessResponse({ 
      rowsProcessed: processedRows,
      jobId: job.id,
      message: `Processed ${rows.length} ASIN performance records` 
    })

  } catch (error) {
    console.error('ASIN performance refresh error:', error)
    
    if (auditLogId) {
      await logError(
        createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''),
        auditLogId,
        error.message
      )
    }
    
    return createErrorResponse('ASIN performance refresh failed', error.message)
  }
})