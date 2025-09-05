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

// Map of table names to their refresh strategies
const REFRESH_STRATEGIES: Record<string, {
  type: 'materialized_view' | 'aggregation'
  viewName?: string
  aggregationQuery?: string
}> = {
  'search_performance_summary': {
    type: 'materialized_view',
    viewName: 'sqp.search_performance_summary'
  },
  'weekly_summary': {
    type: 'aggregation',
    aggregationQuery: `
      INSERT INTO sqp.weekly_summary (
        week_start, week_end, asin, total_impressions, total_clicks,
        total_cart_adds, total_purchases, avg_ctr, avg_cart_add_rate, avg_cvr
      )
      SELECT 
        DATE_TRUNC('week', end_date) as week_start,
        DATE_TRUNC('week', end_date) + INTERVAL '6 days' as week_end,
        asin,
        SUM(asin_impressions) as total_impressions,
        SUM(asin_clicks) as total_clicks,
        SUM(asin_cart_adds) as total_cart_adds,
        SUM(asin_purchases) as total_purchases,
        AVG(CASE WHEN asin_impressions > 0 
            THEN asin_clicks::FLOAT / asin_impressions ELSE 0 END) as avg_ctr,
        AVG(CASE WHEN asin_clicks > 0 
            THEN asin_cart_adds::FLOAT / asin_clicks ELSE 0 END) as avg_cart_add_rate,
        AVG(CASE WHEN asin_impressions > 0 
            THEN asin_purchases::FLOAT / asin_impressions ELSE 0 END) as avg_cvr
      FROM sqp.asin_performance_data
      WHERE end_date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE_TRUNC('week', end_date), asin
      ON CONFLICT (week_start, asin) 
      DO UPDATE SET
        total_impressions = EXCLUDED.total_impressions,
        total_clicks = EXCLUDED.total_clicks,
        total_cart_adds = EXCLUDED.total_cart_adds,
        total_purchases = EXCLUDED.total_purchases,
        avg_ctr = EXCLUDED.avg_ctr,
        avg_cart_add_rate = EXCLUDED.avg_cart_add_rate,
        avg_cvr = EXCLUDED.avg_cvr,
        updated_at = CURRENT_TIMESTAMP
    `
  },
  'monthly_summary': {
    type: 'aggregation',
    aggregationQuery: `
      INSERT INTO sqp.monthly_summary (
        month_start, month_end, asin, total_impressions, total_clicks,
        total_cart_adds, total_purchases, avg_ctr, avg_cart_add_rate, avg_cvr
      )
      SELECT 
        DATE_TRUNC('month', end_date) as month_start,
        (DATE_TRUNC('month', end_date) + INTERVAL '1 month - 1 day')::DATE as month_end,
        asin,
        SUM(asin_impressions) as total_impressions,
        SUM(asin_clicks) as total_clicks,
        SUM(asin_cart_adds) as total_cart_adds,
        SUM(asin_purchases) as total_purchases,
        AVG(CASE WHEN asin_impressions > 0 
            THEN asin_clicks::FLOAT / asin_impressions ELSE 0 END) as avg_ctr,
        AVG(CASE WHEN asin_clicks > 0 
            THEN asin_cart_adds::FLOAT / asin_clicks ELSE 0 END) as avg_cart_add_rate,
        AVG(CASE WHEN asin_impressions > 0 
            THEN asin_purchases::FLOAT / asin_impressions ELSE 0 END) as avg_cvr
      FROM sqp.asin_performance_data
      WHERE end_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
      GROUP BY DATE_TRUNC('month', end_date), asin
      ON CONFLICT (month_start, asin) 
      DO UPDATE SET
        total_impressions = EXCLUDED.total_impressions,
        total_clicks = EXCLUDED.total_clicks,
        total_cart_adds = EXCLUDED.total_cart_adds,
        total_purchases = EXCLUDED.total_purchases,
        avg_ctr = EXCLUDED.avg_ctr,
        avg_cart_add_rate = EXCLUDED.avg_cart_add_rate,
        avg_cvr = EXCLUDED.avg_cvr,
        updated_at = CURRENT_TIMESTAMP
    `
  },
  'quarterly_summary': {
    type: 'aggregation',
    aggregationQuery: `
      INSERT INTO sqp.quarterly_summary (
        quarter_start, quarter_end, asin, total_impressions, total_clicks,
        total_cart_adds, total_purchases, avg_ctr, avg_cart_add_rate, avg_cvr
      )
      SELECT 
        DATE_TRUNC('quarter', end_date) as quarter_start,
        (DATE_TRUNC('quarter', end_date) + INTERVAL '3 months - 1 day')::DATE as quarter_end,
        asin,
        SUM(asin_impressions) as total_impressions,
        SUM(asin_clicks) as total_clicks,
        SUM(asin_cart_adds) as total_cart_adds,
        SUM(asin_purchases) as total_purchases,
        AVG(CASE WHEN asin_impressions > 0 
            THEN asin_clicks::FLOAT / asin_impressions ELSE 0 END) as avg_ctr,
        AVG(CASE WHEN asin_clicks > 0 
            THEN asin_cart_adds::FLOAT / asin_clicks ELSE 0 END) as avg_cart_add_rate,
        AVG(CASE WHEN asin_impressions > 0 
            THEN asin_purchases::FLOAT / asin_impressions ELSE 0 END) as avg_cvr
      FROM sqp.asin_performance_data
      WHERE end_date >= DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '3 months')
      GROUP BY DATE_TRUNC('quarter', end_date), asin
      ON CONFLICT (quarter_start, asin) 
      DO UPDATE SET
        total_impressions = EXCLUDED.total_impressions,
        total_clicks = EXCLUDED.total_clicks,
        total_cart_adds = EXCLUDED.total_cart_adds,
        total_purchases = EXCLUDED.total_purchases,
        avg_ctr = EXCLUDED.avg_ctr,
        avg_cart_add_rate = EXCLUDED.avg_cart_add_rate,
        avg_cvr = EXCLUDED.avg_cvr,
        updated_at = CURRENT_TIMESTAMP
    `
  },
  'yearly_summary': {
    type: 'aggregation',
    aggregationQuery: `
      INSERT INTO sqp.yearly_summary (
        year, asin, total_impressions, total_clicks,
        total_cart_adds, total_purchases, avg_ctr, avg_cart_add_rate, avg_cvr
      )
      SELECT 
        EXTRACT(YEAR FROM end_date)::INTEGER as year,
        asin,
        SUM(asin_impressions) as total_impressions,
        SUM(asin_clicks) as total_clicks,
        SUM(asin_cart_adds) as total_cart_adds,
        SUM(asin_purchases) as total_purchases,
        AVG(CASE WHEN asin_impressions > 0 
            THEN asin_clicks::FLOAT / asin_impressions ELSE 0 END) as avg_ctr,
        AVG(CASE WHEN asin_clicks > 0 
            THEN asin_cart_adds::FLOAT / asin_clicks ELSE 0 END) as avg_cart_add_rate,
        AVG(CASE WHEN asin_impressions > 0 
            THEN asin_purchases::FLOAT / asin_impressions ELSE 0 END) as avg_cvr
      FROM sqp.asin_performance_data
      WHERE end_date >= DATE_TRUNC('year', CURRENT_DATE)
      GROUP BY EXTRACT(YEAR FROM end_date), asin
      ON CONFLICT (year, asin) 
      DO UPDATE SET
        total_impressions = EXCLUDED.total_impressions,
        total_clicks = EXCLUDED.total_clicks,
        total_cart_adds = EXCLUDED.total_cart_adds,
        total_purchases = EXCLUDED.total_purchases,
        avg_ctr = EXCLUDED.avg_ctr,
        avg_cart_add_rate = EXCLUDED.avg_cart_add_rate,
        avg_cvr = EXCLUDED.avg_cvr,
        updated_at = CURRENT_TIMESTAMP
    `
  }
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
    const tableName = config.table_name
    const strategy = REFRESH_STRATEGIES[tableName]

    if (!strategy) {
      throw new Error(`No refresh strategy defined for table: ${tableName}`)
    }

    console.log(`Refreshing ${tableName} using ${strategy.type} strategy`)

    let rowsAffected = 0

    if (strategy.type === 'materialized_view' && strategy.viewName) {
      // Refresh materialized view
      const { data, error } = await supabase.rpc('refresh_materialized_view', {
        view_name: strategy.viewName
      })

      if (error) throw error
      
      // Get row count from the view
      const { count } = await supabase
        .from(strategy.viewName)
        .select('*', { count: 'exact', head: true })
      
      rowsAffected = count || 0
      console.log(`Materialized view ${strategy.viewName} refreshed with ${rowsAffected} rows`)
      
    } else if (strategy.type === 'aggregation' && strategy.aggregationQuery) {
      // Execute aggregation query
      const { data, error } = await supabase.rpc('execute_sql', {
        sql: strategy.aggregationQuery
      })

      if (error) throw error
      
      // Get affected row count
      const { count } = await supabase
        .from(`sqp.${tableName}`)
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', new Date(Date.now() - 60000).toISOString()) // Updated in last minute
      
      rowsAffected = count || 0
      console.log(`Aggregation table ${tableName} updated with ${rowsAffected} rows`)
    }

    // Update audit log
    await supabase
      .from('sqp.refresh_audit_log')
      .update({
        rows_processed: rowsAffected,
        execution_time_ms: Date.now() - startTime,
        status: 'success',
        refresh_completed_at: new Date().toISOString()
      })
      .eq('id', auditLogId)

    return {
      tableName,
      strategy: strategy.type,
      rowsAffected,
      executionTimeMs: Date.now() - startTime
    }
  }, {
    functionName: 'refresh-summary-tables',
    supabase,
    auditLogId,
    tableName: config.table_name
  })

  if ('error' in result) {
    return createErrorResponse(result.error)
  }

  return createSuccessResponse(result)
})

// Helper RPC function that needs to be created in the database
const createRefreshMaterializedViewFunction = `
CREATE OR REPLACE FUNCTION refresh_materialized_view(view_name TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY ' || view_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`