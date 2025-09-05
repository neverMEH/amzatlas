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
      .eq('function_name', 'refresh-search-queries')
      .eq('table_name', config.table_name)
      .eq('status', 'active')
      .single()

    let pageToken = checkpoint?.checkpoint_data?.page_token
    let lastProcessedKey = checkpoint?.checkpoint_data?.last_processed_key
    
    if (!lastProcessedKey) {
      // Get last sync info from the table
      const { data: lastSync } = await supabase
        .from('sqp.search_query_performance')
        .select('asin, search_query, end_date')
        .order('end_date', { ascending: false })
        .order('asin', { ascending: false })
        .order('search_query', { ascending: false })
        .limit(1)
        .single()
      
      lastProcessedKey = lastSync ? 
        `${lastSync.end_date}|${lastSync.asin}|${lastSync.search_query}` : 
        '2024-08-18||'
    }

    console.log(`Starting sync from key: ${lastProcessedKey}`)
    const [lastDate, lastAsin, lastQuery] = lastProcessedKey.split('|')

    // Query BigQuery for new data with pagination support
    const query = `
      WITH ranked_data AS (
        SELECT 
          *,
          CONCAT(CAST(end_date AS STRING), '|', asin, '|', search_query) as composite_key
        FROM \`${Deno.env.get('BIGQUERY_PROJECT_ID')}.${
          Deno.env.get('BIGQUERY_DATASET')
        }.search_query_performance_view\`
        WHERE CONCAT(CAST(end_date AS STRING), '|', asin, '|', search_query) > @lastProcessedKey
        ORDER BY end_date, asin, search_query
      )
      SELECT * FROM ranked_data
      LIMIT ${BATCH_SIZES.largeTable}
    `

    const [rows] = await bigquery.query({
      query,
      params: { lastProcessedKey },
      useLegacySql: false,
      pageToken: pageToken
    })

    console.log(`Retrieved ${rows.length} rows from BigQuery`)

    // Process in batches
    const batchSize = 1000 // Larger batch for search queries
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      
      // Transform nested data structure
      const transformedData = batch.map(row => ({
        start_date: row.start_date?.value || row.start_date,
        end_date: row.end_date?.value || row.end_date,
        asin: row.asin,
        search_query: row.search_query,
        // Funnel metrics
        query_impressions: row.funnel_metrics?.impressions || row.query_impressions,
        query_clicks: row.funnel_metrics?.clicks || row.query_clicks,
        query_cart_adds: row.funnel_metrics?.cart_adds || row.query_cart_adds,
        query_purchases: row.funnel_metrics?.purchases || row.query_purchases,
        // Market share
        impressions_share: row.market_share?.impressions_share || row.impressions_share,
        clicks_share: row.market_share?.clicks_share || row.clicks_share,
        cart_add_share: row.market_share?.cart_add_share || row.cart_add_share,
        purchase_share: row.market_share?.purchase_share || row.purchase_share,
        // Ranking
        search_frequency_rank: row.search_frequency_rank,
        // Conversion rates
        click_through_rate: row.funnel_metrics?.click_through_rate || row.click_through_rate,
        cart_add_rate: row.funnel_metrics?.cart_add_rate || row.cart_add_rate,
        conversion_rate: row.funnel_metrics?.conversion_rate || row.conversion_rate,
        // Additional metrics
        same_day_shipping_clicks_share: row.delivery_speed?.same_day_shipping_clicks_share,
        one_day_shipping_clicks_share: row.delivery_speed?.one_day_shipping_clicks_share,
        two_day_shipping_clicks_share: row.delivery_speed?.two_day_shipping_clicks_share
      }))
      
      const { data, error } = await supabase
        .from('sqp.search_query_performance')
        .upsert(transformedData, {
          onConflict: 'start_date,end_date,asin,search_query',
          ignoreDuplicates: false
        })
        .select()

      if (error) throw error

      rowsProcessed += batch.length
      rowsInserted += data?.filter(d => 
        new Date(d.created_at).getTime() === new Date(d.updated_at).getTime()
      ).length || 0
      rowsUpdated += data?.filter(d => 
        new Date(d.created_at).getTime() !== new Date(d.updated_at).getTime()
      ).length || 0

      // Update checkpoint with last processed key
      const lastRow = batch[batch.length - 1]
      const newLastKey = `${lastRow.end_date}|${lastRow.asin}|${lastRow.search_query}`
      
      await supabase
        .from('sqp.refresh_checkpoints')
        .upsert({
          function_name: 'refresh-search-queries',
          table_schema: config.table_schema,
          table_name: config.table_name,
          checkpoint_data: {
            last_processed_key: newLastKey,
            page_token: rows.pageToken,
            batch_number: Math.floor(i / batchSize) + 1,
            rows_in_batch: batch.length
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
        await supabase.functions.invoke('refresh-search-queries', {
          body: { config, auditLogId }
        })

        break
      }
    }

    // If completed this page and there's more data, continue
    if (rowsProcessed === rows.length && rows.pageToken) {
      console.log('Page complete, scheduling next page...')
      await supabase.functions.invoke('refresh-search-queries', {
        body: { config, auditLogId }
      })
    } else if (rowsProcessed === rows.length && !rows.pageToken) {
      // All done, clean up checkpoint
      await supabase
        .from('sqp.refresh_checkpoints')
        .update({ status: 'completed' })
        .eq('function_name', 'refresh-search-queries')
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
      hasMore: !!rows.pageToken,
      completed: rowsProcessed === rows.length && !rows.pageToken
    }
  }, {
    functionName: 'refresh-search-queries',
    supabase,
    auditLogId,
    tableName: config.table_name
  })

  if ('error' in result) {
    return createErrorResponse(result.error)
  }

  return createSuccessResponse(result)
})