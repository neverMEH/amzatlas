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

    console.log('Refreshing daily SQP data...')

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
      .eq('function_name', 'refresh-daily-sqp')
      .eq('table_schema', 'sqp')
      .eq('table_name', 'daily_sqp_data')
      .eq('status', 'active')
      .single()

    let offset = 0
    let processedRows = 0
    
    if (checkpoint) {
      offset = checkpoint.last_processed_row || 0
      processedRows = offset
      console.log(`Resuming from checkpoint: offset ${offset}`)
    }

    // BigQuery query for daily SQP data aggregation
    const query = `
      SELECT 
        PARSE_DATE('%Y-%m-%d', \`Start Date\`) as report_date,
        \`Child ASIN\` as asin,
        COUNT(DISTINCT \`Search Query\`) as unique_search_queries,
        SUM(CAST(\`Impressions\` AS INT64)) as total_impressions,
        SUM(CAST(\`Clicks\` AS INT64)) as total_clicks,
        SUM(CAST(\`Cart Adds\` AS INT64)) as total_cart_adds,
        SUM(CAST(\`Total Orders (#)\` AS INT64)) as total_purchases,
        AVG(CAST(\`CTR (%)\` AS FLOAT64)) as avg_ctr,
        AVG(CAST(\`CVR (%)\` AS FLOAT64)) as avg_cvr,
        SUM(CAST(\`Spend ($)\` AS FLOAT64)) as total_spend,
        SUM(CAST(\`Total Sales  ($)\` AS FLOAT64)) as total_sales,
        AVG(CAST(\`CPC ($)\` AS FLOAT64)) as avg_cpc,
        SUM(CAST(\`Total Units (#)\` AS INT64)) as total_units,
        AVG(CAST(\`Search Impression Share (%)\` AS FLOAT64)) as avg_impression_share,
        AVG(CAST(\`Click Share (%)\` AS FLOAT64)) as avg_click_share,
        AVG(CAST(\`Search Impression Rank (avg)\` AS FLOAT64)) as avg_impression_rank,
        AVG(CAST(\`Click Rank (avg)\` AS FLOAT64)) as avg_click_rank
      FROM \`dataclient_amzatlas_agency_85.amz_atlas_product_data_search_query_performance_85\`
      WHERE \`Child ASIN\` IS NOT NULL 
        AND \`Start Date\` IS NOT NULL
      GROUP BY 
        PARSE_DATE('%Y-%m-%d', \`Start Date\`), 
        \`Child ASIN\`
      ORDER BY report_date DESC, asin
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
        message: 'Daily SQP data refresh completed' 
      })
    }

    console.log(`Processing ${rows.length} rows (offset: ${offset})`)

    // Transform and prepare data for upsert
    const transformedData = rows.map(row => ({
      report_date: row.report_date?.value || row.report_date,
      asin: row.asin,
      unique_search_queries: parseInt(row.unique_search_queries) || 0,
      total_impressions: parseInt(row.total_impressions) || 0,
      total_clicks: parseInt(row.total_clicks) || 0,
      total_cart_adds: parseInt(row.total_cart_adds) || 0,
      total_purchases: parseInt(row.total_purchases) || 0,
      avg_ctr: parseFloat(row.avg_ctr) || 0,
      avg_cvr: parseFloat(row.avg_cvr) || 0,
      total_spend: parseFloat(row.total_spend) || 0,
      total_sales: parseFloat(row.total_sales) || 0,
      avg_cpc: parseFloat(row.avg_cpc) || 0,
      total_units: parseInt(row.total_units) || 0,
      avg_impression_share: parseFloat(row.avg_impression_share) || 0,
      avg_click_share: parseFloat(row.avg_click_share) || 0,
      avg_impression_rank: parseFloat(row.avg_impression_rank) || 0,
      avg_click_rank: parseFloat(row.avg_click_rank) || 0,
      
      // Calculate derived metrics
      cart_add_rate: row.total_clicks > 0 ? ((row.total_cart_adds || 0) / row.total_clicks * 100) : 0,
      purchase_rate: row.total_cart_adds > 0 ? ((row.total_purchases || 0) / row.total_cart_adds * 100) : 0,
      roi_percentage: row.total_spend > 0 ? ((row.total_sales || 0) / row.total_spend * 100) : 0,
      
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))

    // Batch upsert to avoid conflicts
    const { error: upsertError } = await supabase
      .from('daily_sqp_data')
      .upsert(transformedData, { onConflict: 'report_date,asin' })

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
          function_name: 'refresh-daily-sqp',
          table_schema: 'sqp',
          table_name: 'daily_sqp_data',
          checkpoint_data: { offset: newOffset },
          last_processed_row: newOffset,
          status: 'active',
          updated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour
        }, { onConflict: 'function_name,table_schema,table_name,status' })

      // Continue processing by invoking self
      await supabase.functions.invoke('refresh-daily-sqp', {
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
      await supabase.functions.invoke('refresh-daily-sqp', {
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
      message: `Processed ${rows.length} daily SQP records` 
    })

  } catch (error) {
    console.error('Daily SQP refresh error:', error)
    
    if (auditLogId) {
      await logError(
        createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''),
        auditLogId,
        error.message
      )
    }
    
    return createErrorResponse('Daily SQP refresh failed', error.message)
  }
})