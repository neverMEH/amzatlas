import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { BigQuery } from 'https://esm.sh/@google-cloud/bigquery@7'
import { createErrorResponse, createSuccessResponse, logError } from '../_shared/utils.ts'

const FUNCTION_TIMEOUT = 300000 // 5 minutes
const BATCH_SIZE = 500

serve(async (req) => {
  const startTime = Date.now()
  let auditLogId: number | null = null

  try {
    const { config, auditLogId: providedAuditLogId } = await req.json()
    auditLogId = providedAuditLogId

    console.log(`Refreshing generic table: ${config.table_schema}.${config.table_name}`)

    // Create clients
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get table schema dynamically
    const { data: tableColumns, error: columnsError } = await supabase
      .rpc('get_table_columns', {
        schema_name: config.table_schema,
        table_name: config.table_name
      })

    if (columnsError || !tableColumns || tableColumns.length === 0) {
      throw new Error(`Could not get table columns: ${columnsError?.message || 'No columns found'}`)
    }

    console.log(`Found ${tableColumns.length} columns for ${config.table_name}`)

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
      .eq('function_name', 'refresh-generic-table')
      .eq('table_schema', config.table_schema)
      .eq('table_name', config.table_name)
      .eq('status', 'active')
      .single()

    let offset = 0
    let processedRows = 0
    
    if (checkpoint) {
      offset = checkpoint.last_processed_row || 0
      processedRows = offset
      console.log(`Resuming from checkpoint: offset ${offset}`)
    }

    // Build dynamic query based on table type and custom sync params
    let query: string

    if (config.table_name === 'search_performance_summary') {
      // Special case for materialized view - refresh instead of sync
      const { error: refreshError } = await supabase.rpc('refresh_materialized_view', {
        view_name: `${config.table_schema}.${config.table_name}`
      })

      if (refreshError) {
        throw new Error(`Failed to refresh materialized view: ${refreshError.message}`)
      }

      // Get row count
      const { data: rowCount, error: countError } = await supabase
        .rpc('get_table_row_count', {
          schema_name: config.table_schema,
          table_name: config.table_name
        })

      if (auditLogId) {
        await supabase
          .from('refresh_audit_log')
          .update({
            status: 'success',
            rows_processed: rowCount || 0,
            execution_time_ms: Date.now() - startTime,
            refresh_completed_at: new Date().toISOString(),
            sync_metadata: { table_type: 'materialized_view', refresh_type: 'concurrent' }
          })
          .eq('id', auditLogId)
      }

      return createSuccessResponse({ 
        rowCount: rowCount || 0,
        executionTimeMs: Date.now() - startTime,
        message: `Successfully refreshed materialized view ${config.table_name}` 
      })
    }

    // For regular tables, determine appropriate BigQuery source based on table name
    const bigqueryTable = 'dataclient_amzatlas_agency_85.amz_atlas_product_data_search_query_performance_85'
    
    // Build column mappings
    const columnMappings: Record<string, string> = {
      'start_date': `PARSE_DATE('%Y-%m-%d', \`Start Date\`)`,
      'end_date': `PARSE_DATE('%Y-%m-%d', \`End Date\`)`,
      'asin': `\`Child ASIN\``,
      'product_name': `\`Product Name\``,
      'brand': `\`Brand\``,
      'search_query': `\`Search Query\``,
      'impressions': `CAST(\`Impressions\` AS INT64)`,
      'clicks': `CAST(\`Clicks\` AS INT64)`,
      'cart_adds': `CAST(\`Cart Adds\` AS INT64)`,
      'purchases': `CAST(\`Total Orders (#)\` AS INT64)`,
      'ctr_percentage': `CAST(\`CTR (%)\` AS FLOAT64)`,
      'cvr_percentage': `CAST(\`CVR (%)\` AS FLOAT64)`,
      'cpc_dollars': `CAST(\`CPC ($)\` AS FLOAT64)`,
      'spend_dollars': `CAST(\`Spend ($)\` AS FLOAT64)`,
      'total_sales_dollars': `CAST(\`Total Sales  ($)\` AS FLOAT64)`,
      'total_units': `CAST(\`Total Units (#)\` AS INT64)`,
      'search_impression_share_percentage': `CAST(\`Search Impression Share (%)\` AS FLOAT64)`,
      'click_share_percentage': `CAST(\`Click Share (%)\` AS FLOAT64)`,
      'search_impression_rank_avg': `CAST(\`Search Impression Rank (avg)\` AS FLOAT64)`,
      'click_rank_avg': `CAST(\`Click Rank (avg)\` AS FLOAT64)`
    }

    // Build SELECT clause dynamically
    const selectColumns = tableColumns
      .filter(col => col.column_name !== 'id' && col.column_name !== 'created_at' && col.column_name !== 'updated_at')
      .map(col => {
        const mapping = columnMappings[col.column_name]
        return mapping ? `${mapping} as ${col.column_name}` : `NULL as ${col.column_name}`
      })
      .join(',\n        ')

    query = `
      SELECT 
        ${selectColumns}
      FROM \`${bigqueryTable}\`
      WHERE \`Child ASIN\` IS NOT NULL
      ORDER BY \`Start Date\` DESC, \`Child ASIN\`
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
        message: `Generic table refresh completed for ${config.table_name}` 
      })
    }

    console.log(`Processing ${rows.length} rows (offset: ${offset})`)

    // Transform data - handle BigQuery date objects
    const transformedData = rows.map(row => {
      const transformed: Record<string, any> = {}
      
      for (const col of tableColumns) {
        const value = row[col.column_name]
        
        // Handle BigQuery date objects
        if (value && typeof value === 'object' && value.value) {
          transformed[col.column_name] = value.value
        } else {
          transformed[col.column_name] = value
        }
      }
      
      // Add timestamps
      transformed.updated_at = new Date().toISOString()
      if (!transformed.created_at) {
        transformed.created_at = new Date().toISOString()
      }
      
      return transformed
    })

    // Determine conflict columns for upsert
    const conflictColumns = ['start_date', 'end_date', 'asin']
    if (config.table_name === 'search_query_performance') {
      conflictColumns.push('search_query')
    }

    // Batch upsert to avoid conflicts
    const { error: upsertError } = await supabase
      .from(`${config.table_schema}.${config.table_name}`)
      .upsert(transformedData, { onConflict: conflictColumns.join(',') })

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
          function_name: 'refresh-generic-table',
          table_schema: config.table_schema,
          table_name: config.table_name,
          checkpoint_data: { offset: newOffset },
          last_processed_row: newOffset,
          status: 'active',
          updated_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hour
        }, { onConflict: 'function_name,table_schema,table_name,status' })

      // Continue processing by invoking self
      await supabase.functions.invoke('refresh-generic-table', {
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
      await supabase.functions.invoke('refresh-generic-table', {
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
      message: `Processed ${rows.length} records for ${config.table_name}` 
    })

  } catch (error) {
    console.error(`Generic table refresh error for ${config?.table_name}:`, error)
    
    if (auditLogId) {
      await logError(
        createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''),
        auditLogId,
        error.message
      )
    }
    
    return createErrorResponse('Generic table refresh failed', error.message)
  }
})