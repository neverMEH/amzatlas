import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { BigQuery } from "https://esm.sh/@google-cloud/bigquery@7"
import { 
  withErrorHandling, 
  logPerformanceMetrics,
  createSuccessResponse,
  createErrorResponse
} from "../_shared/error-handler.ts"
import { BATCH_SIZES, FUNCTION_TIMEOUTS } from "../_shared/cron-config.ts"

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
  let rowsInserted = 0
  let rowsUpdated = 0

  const result = await withErrorHandling(async () => {
    // Check for existing checkpoint
    const { data: checkpoint } = await supabase
      .from('sqp.refresh_checkpoints')
      .select('*')
      .eq('function_name', 'refresh-asin-performance')
      .eq('table_name', config.table_name)
      .eq('status', 'active')
      .single()

    let lastProcessedDate = checkpoint?.checkpoint_data?.last_processed_date
    
    if (!lastProcessedDate) {
      // Get last sync date from the table
      const { data: lastSync } = await supabase
        .from('sqp.asin_performance_data')
        .select('end_date')
        .order('end_date', { ascending: false })
        .limit(1)
        .single()
      
      lastProcessedDate = lastSync?.end_date || '2024-08-18'
    }

    console.log(`Starting sync from date: ${lastProcessedDate}`)

    // Query BigQuery for new data
    const query = `
      SELECT *
      FROM \`${Deno.env.get('BIGQUERY_PROJECT_ID')}.${
        Deno.env.get('BIGQUERY_DATASET')
      }.asin_performance_view\`
      WHERE end_date > @lastProcessedDate
      ORDER BY end_date
      LIMIT ${BATCH_SIZES.default}
    `

    const [rows] = await bigquery.query({
      query,
      params: { lastProcessedDate },
      useLegacySql: false
    })

    console.log(`Retrieved ${rows.length} rows from BigQuery`)

    // Process in batches
    const batchSize = 500
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      
      // Transform data
      const transformedData = batch.map(row => ({
        start_date: row.start_date?.value || row.start_date,
        end_date: row.end_date?.value || row.end_date,
        asin: row.asin,
        parent_asin: row.parent_asin,
        brand: row.brand,
        product_title: row.product_title,
        market_impressions: row.market_impressions,
        market_clicks: row.market_clicks,
        market_cart_adds: row.market_cart_adds,
        market_purchases: row.market_purchases,
        asin_impressions: row.asin_impressions,
        asin_clicks: row.asin_clicks,
        asin_cart_adds: row.asin_cart_adds,
        asin_purchases: row.asin_purchases,
        market_price_median: row.market_price_median,
        asin_price_median: row.asin_price_median
      }))
      
      const { data, error } = await supabase
        .from('sqp.asin_performance_data')
        .upsert(transformedData, {
          onConflict: 'start_date,end_date,asin',
          ignoreDuplicates: false
        })
        .select()

      if (error) throw error

      rowsProcessed += batch.length
      // Track inserts vs updates based on response
      rowsInserted += data?.filter(d => 
        new Date(d.created_at).getTime() === new Date(d.updated_at).getTime()
      ).length || 0
      rowsUpdated += data?.filter(d => 
        new Date(d.created_at).getTime() !== new Date(d.updated_at).getTime()
      ).length || 0

      // Update checkpoint every batch
      await supabase
        .from('sqp.refresh_checkpoints')
        .upsert({
          function_name: 'refresh-asin-performance',
          table_schema: config.table_schema,
          table_name: config.table_name,
          checkpoint_data: {
            last_processed_date: batch[batch.length - 1].end_date,
            batch_number: Math.floor(i / batchSize) + 1
          },
          last_processed_row: i + batch.length,
          total_rows: rows.length,
          status: 'active',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'function_name,table_schema,table_name,status'
        })

      // Check if we're approaching the time limit
      if (Date.now() - startTime > FUNCTION_TIMEOUTS.tableRefresh) {
        console.log('Approaching time limit, scheduling continuation...')
        
        // Schedule another run
        await supabase.functions.invoke('refresh-asin-performance', {
          body: { config, auditLogId }
        })

        break
      }
    }

    // If completed, clean up checkpoint
    if (rowsProcessed === rows.length) {
      await supabase
        .from('sqp.refresh_checkpoints')
        .update({ status: 'completed' })
        .eq('function_name', 'refresh-asin-performance')
        .eq('table_name', config.table_name)
        .eq('status', 'active')
    }

    // Update audit log with success
    await logPerformanceMetrics(supabase, auditLogId, {
      rowsProcessed,
      rowsInserted,
      rowsUpdated,
      syncMetadata: { startTime }
    })

    return {
      rowsProcessed,
      rowsInserted,
      rowsUpdated,
      completed: rowsProcessed === rows.length
    }
  }, {
    functionName: 'refresh-asin-performance',
    supabase,
    auditLogId,
    tableName: config.table_name
  })

  if ('error' in result) {
    return createErrorResponse(result.error)
  }

  return createSuccessResponse(result)
})