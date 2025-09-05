import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { BigQuery } from "https://esm.sh/@google-cloud/bigquery@7"
import { 
  withErrorHandling, 
  logPerformanceMetrics,
  createSuccessResponse,
  createErrorResponse
} from "../_shared/error-handler.ts"
import { BATCH_SIZES } from "../_shared/cron-config.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { config, auditLogId } = await req.json()
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Initialize BigQuery
  const bigqueryCredentials = JSON.parse(
    Deno.env.get('GOOGLE_APPLICATION_CREDENTIALS_JSON') ?? '{}'
  )
  const bigquery = new BigQuery({
    projectId: bigqueryCredentials.project_id,
    credentials: bigqueryCredentials
  })

  const startTime = Date.now()
  let rowsProcessed = 0

  const result = await withErrorHandling(async () => {
    const tableName = config.table_name
    console.log(`Generic refresh for table: ${tableName}`)

    // Get table schema to understand structure
    const { data: columns, error: schemaError } = await supabase
      .rpc('get_table_columns', { 
        schema_name: config.table_schema, 
        table_name: tableName 
      })

    if (schemaError) throw schemaError

    // Find date column for incremental sync
    const dateColumns = columns?.filter((col: any) => 
      col.column_name.includes('date') || 
      col.column_name.includes('_at')
    ) || []
    
    const primaryDateColumn = dateColumns.find((col: any) => 
      col.column_name === 'end_date'
    ) || dateColumns[0]

    if (!primaryDateColumn) {
      throw new Error(`No date column found for incremental sync in ${tableName}`)
    }

    // Get last sync date
    const { data: lastSync } = await supabase
      .from(`${config.table_schema}.${tableName}`)
      .select(primaryDateColumn.column_name)
      .order(primaryDateColumn.column_name, { ascending: false })
      .limit(1)
      .single()
    
    const lastSyncDate = lastSync?.[primaryDateColumn.column_name] || '2024-08-18'

    // Query BigQuery - assuming matching table name
    const query = `
      SELECT *
      FROM \`${Deno.env.get('BIGQUERY_PROJECT_ID')}.${
        Deno.env.get('BIGQUERY_DATASET')
      }.${tableName}\`
      WHERE ${primaryDateColumn.column_name} > @lastSyncDate
      ORDER BY ${primaryDateColumn.column_name}
      LIMIT ${BATCH_SIZES.default}
    `

    const [rows] = await bigquery.query({
      query,
      params: { lastSyncDate },
      useLegacySql: false
    })

    console.log(`Retrieved ${rows.length} rows from BigQuery`)

    if (rows.length > 0) {
      // Transform rows to handle BigQuery date objects
      const transformedRows = rows.map((row: any) => {
        const transformed: any = {}
        
        for (const [key, value] of Object.entries(row)) {
          // Handle BigQuery date/timestamp objects
          if (value && typeof value === 'object' && 'value' in value) {
            transformed[key] = value.value
          } else {
            transformed[key] = value
          }
        }
        
        return transformed
      })

      // Batch upsert
      const batchSize = 1000
      for (let i = 0; i < transformedRows.length; i += batchSize) {
        const batch = transformedRows.slice(i, i + batchSize)
        
        const { error } = await supabase
          .from(`${config.table_schema}.${tableName}`)
          .upsert(batch, {
            ignoreDuplicates: false
          })

        if (error) throw error
        rowsProcessed += batch.length
      }
    }

    // Update audit log
    await logPerformanceMetrics(supabase, auditLogId, {
      rowsProcessed,
      rowsInserted: rowsProcessed, // Simplified for generic handler
      rowsUpdated: 0,
      syncMetadata: { startTime }
    })

    return {
      tableName,
      rowsProcessed,
      lastSyncDate,
      newLastSyncDate: rows.length > 0 ? 
        rows[rows.length - 1][primaryDateColumn.column_name] : 
        lastSyncDate
    }
  }, {
    functionName: 'refresh-generic-table',
    supabase,
    auditLogId,
    tableName: config.table_name
  })

  if ('error' in result) {
    return createErrorResponse(result.error)
  }

  return createSuccessResponse(result)
})