import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { 
  withErrorHandling, 
  createSuccessResponse,
  createErrorResponse
} from "../_shared/error-handler.ts"

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

  const startTime = Date.now()

  const result = await withErrorHandling(async () => {
    console.log('Refreshing daily SQP data aggregation...')

    // Create daily aggregation from asin_performance_data
    const aggregationQuery = `
      INSERT INTO sqp.daily_sqp_data (
        date,
        asin,
        parent_asin,
        brand,
        product_title,
        impressions,
        clicks,
        cart_adds,
        purchases,
        click_through_rate,
        cart_add_rate,
        conversion_rate,
        impressions_share,
        clicks_share,
        purchases_share
      )
      SELECT 
        end_date as date,
        asin,
        parent_asin,
        brand,
        product_title,
        asin_impressions as impressions,
        asin_clicks as clicks,
        asin_cart_adds as cart_adds,
        asin_purchases as purchases,
        CASE WHEN asin_impressions > 0 
          THEN asin_clicks::FLOAT / asin_impressions 
          ELSE 0 
        END as click_through_rate,
        CASE WHEN asin_clicks > 0 
          THEN asin_cart_adds::FLOAT / asin_clicks 
          ELSE 0 
        END as cart_add_rate,
        CASE WHEN asin_impressions > 0 
          THEN asin_purchases::FLOAT / asin_impressions 
          ELSE 0 
        END as conversion_rate,
        CASE WHEN market_impressions > 0 
          THEN asin_impressions::FLOAT / market_impressions 
          ELSE 0 
        END as impressions_share,
        CASE WHEN market_clicks > 0 
          THEN asin_clicks::FLOAT / market_clicks 
          ELSE 0 
        END as clicks_share,
        CASE WHEN market_purchases > 0 
          THEN asin_purchases::FLOAT / market_purchases 
          ELSE 0 
        END as purchases_share
      FROM sqp.asin_performance_data
      WHERE end_date >= CURRENT_DATE - INTERVAL '7 days'
        AND end_date = start_date + INTERVAL '6 days' -- Weekly data
      ON CONFLICT (date, asin) 
      DO UPDATE SET
        parent_asin = EXCLUDED.parent_asin,
        brand = EXCLUDED.brand,
        product_title = EXCLUDED.product_title,
        impressions = EXCLUDED.impressions,
        clicks = EXCLUDED.clicks,
        cart_adds = EXCLUDED.cart_adds,
        purchases = EXCLUDED.purchases,
        click_through_rate = EXCLUDED.click_through_rate,
        cart_add_rate = EXCLUDED.cart_add_rate,
        conversion_rate = EXCLUDED.conversion_rate,
        impressions_share = EXCLUDED.impressions_share,
        clicks_share = EXCLUDED.clicks_share,
        purchases_share = EXCLUDED.purchases_share,
        updated_at = CURRENT_TIMESTAMP
    `

    // Execute aggregation
    const { error } = await supabase.rpc('execute_sql', {
      sql: aggregationQuery
    })

    if (error) throw error

    // Get count of affected rows
    const { count } = await supabase
      .from('sqp.daily_sqp_data')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', new Date(Date.now() - 300000).toISOString()) // Last 5 minutes

    const rowsProcessed = count || 0

    // Update audit log
    await supabase
      .from('sqp.refresh_audit_log')
      .update({
        rows_processed: rowsProcessed,
        execution_time_ms: Date.now() - startTime,
        status: 'success',
        refresh_completed_at: new Date().toISOString()
      })
      .eq('id', auditLogId)

    return {
      tableName: 'daily_sqp_data',
      rowsProcessed,
      executionTimeMs: Date.now() - startTime
    }
  }, {
    functionName: 'refresh-daily-sqp',
    supabase,
    auditLogId,
    tableName: config.table_name
  })

  if ('error' in result) {
    return createErrorResponse(result.error)
  }

  return createSuccessResponse(result)
})