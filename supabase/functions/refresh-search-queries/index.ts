import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BigQuery } from 'https://esm.sh/@google-cloud/bigquery@7'
import { createErrorResponse, createSuccessResponse, logError } from '../_shared/utils.ts'

const FUNCTION_TIMEOUT = 300000 // 5 minutes
const BATCH_SIZE = 500 // Smaller batch for complex nested data

serve(async (req) => {
  const startTime = Date.now()
  let auditLogId: number | null = null

  try {
    const { config, auditLogId: providedAuditLogId } = await req.json()
    auditLogId = providedAuditLogId

    console.log('Refreshing search query performance data...')

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
      .eq('function_name', 'refresh-search-queries')
      .eq('table_schema', 'sqp')
      .eq('table_name', 'search_query_performance')
      .eq('status', 'active')
      .single()

    let offset = 0
    let processedRows = 0
    
    if (checkpoint) {
      offset = checkpoint.last_processed_row || 0
      processedRows = offset
      console.log(`Resuming from checkpoint: offset ${offset}`)
    }

    // BigQuery query for search query performance data with nested structure
    const query = `
      SELECT 
        PARSE_DATE('%Y-%m-%d', \`Start Date\`) as start_date,
        PARSE_DATE('%Y-%m-%d', \`End Date\`) as end_date,
        \`Child ASIN\` as asin,
        \`Search Query\` as search_query,
        \`Impressions\` as impressions,
        \`Clicks\` as clicks,
        \`CTR (%)\` as ctr_percentage,
        \`CPC ($)\` as cpc_dollars,
        \`Spend ($)\` as spend_dollars,
        \`Total Sales  ($)\` as total_sales_dollars,
        \`Total Orders (#)\` as total_orders,
        \`Total Units (#)\` as total_units,
        \`CVR (%)\` as cvr_percentage,
        \`Cart Adds\` as cart_adds,
        CAST(\`Search Impression Share (%)\` AS FLOAT64) as search_impression_share_percentage,
        CAST(\`Search Impression Rank (avg)\` AS FLOAT64) as search_impression_rank_avg,
        CAST(\`Click Share (%)\` AS FLOAT64) as click_share_percentage,
        CAST(\`Click Rank (avg)\` AS FLOAT64) as click_rank_avg
      FROM \`dataclient_amzatlas_agency_85.amz_atlas_product_data_search_query_performance_85\`
      WHERE \`Child ASIN\` IS NOT NULL 
        AND \`Search Query\` IS NOT NULL
      ORDER BY start_date DESC, asin, search_query
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
        message: 'Search query performance data refresh completed' 
      })
    }

    console.log(`Processing ${rows.length} rows (offset: ${offset})`)

    // Transform and prepare data for upsert
    const transformedData = rows.map(row => ({
      start_date: row.start_date?.value || row.start_date,
      end_date: row.end_date?.value || row.end_date,
      asin: row.asin,
      search_query: row.search_query,
      
      // Funnel metrics
      impressions: parseInt(row.impressions) || 0,
      clicks: parseInt(row.clicks) || 0,
      cart_adds: parseInt(row.cart_adds) || 0,
      purchases: parseInt(row.total_orders) || 0,
      
      // Performance metrics
      ctr_percentage: parseFloat(row.ctr_percentage) || 0,
      cpc_dollars: parseFloat(row.cpc_dollars) || 0,
      spend_dollars: parseFloat(row.spend_dollars) || 0,
      total_sales_dollars: parseFloat(row.total_sales_dollars) || 0,
      total_units: parseInt(row.total_units) || 0,
      cvr_percentage: parseFloat(row.cvr_percentage) || 0,
      
      // Market share metrics
      search_impression_share_percentage: row.search_impression_share_percentage || 0,
      search_impression_rank_avg: row.search_impression_rank_avg || 0,
      click_share_percentage: row.click_share_percentage || 0,
      click_rank_avg: row.click_rank_avg || 0,
      
      // Calculated metrics
      cart_add_rate: row.clicks > 0 ? ((row.cart_adds || 0) / row.clicks * 100) : 0,
      purchase_rate: row.cart_adds > 0 ? ((row.total_orders || 0) / row.cart_adds * 100) : 0,
      
      updated_at: new Date().toISOString()
    }))

    // Batch upsert to avoid conflicts
    const { error: upsertError } = await supabase
      .from('search_query_performance')
      .upsert(transformedData, { onConflict: 'start_date,end_date,asin,search_query' })

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
          function_name: 'refresh-search-queries',
          table_schema: 'sqp',
          table_name: 'search_query_performance',
          checkpoint_data: { offset: newOffset },
          last_processed_row: newOffset,
          status: 'active',
          updated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour
        }, { onConflict: 'function_name,table_schema,table_name,status' })

      // Continue processing by invoking self
      await supabase.functions.invoke('refresh-search-queries', {
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
      await supabase.functions.invoke('refresh-search-queries', {
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
      message: `Processed ${rows.length} search query performance records` 
    })

  } catch (error) {
    console.error('Search query performance refresh error:', error)
    
    if (auditLogId) {
      await logError(
        createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''),
        auditLogId,
        error.message
      )
    }
    
    return createErrorResponse('Search query performance refresh failed', error.message)
  }
})