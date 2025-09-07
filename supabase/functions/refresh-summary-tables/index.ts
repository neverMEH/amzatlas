import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createErrorResponse, createSuccessResponse, logError } from '../_shared/utils.ts'

const FUNCTION_TIMEOUT = 300000 // 5 minutes

serve(async (req) => {
  const startTime = Date.now()
  let auditLogId: number | null = null

  try {
    const { config, auditLogId: providedAuditLogId } = await req.json()
    auditLogId = providedAuditLogId

    console.log(`Refreshing summary table: ${config.table_name}`)

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const tableName = config.table_name

    // Define the SQL to refresh each summary table
    const summaryRefreshQueries: Record<string, string> = {
      weekly_summary: `
        INSERT INTO sqp.weekly_summary (
          week_start_date, week_end_date, asin, search_query,
          total_impressions, total_clicks, total_cart_adds, total_purchases,
          avg_ctr, avg_cvr, avg_cart_add_rate, avg_purchase_rate,
          total_spend, total_sales, avg_cpc, total_units,
          avg_impression_share, avg_click_share, 
          avg_impression_rank, avg_click_rank,
          created_at, updated_at
        )
        SELECT 
          DATE_TRUNC('week', start_date)::date as week_start_date,
          (DATE_TRUNC('week', start_date) + INTERVAL '6 days')::date as week_end_date,
          asin,
          search_query,
          SUM(impressions) as total_impressions,
          SUM(clicks) as total_clicks,
          SUM(cart_adds) as total_cart_adds,
          SUM(purchases) as total_purchases,
          AVG(ctr_percentage) as avg_ctr,
          AVG(cvr_percentage) as avg_cvr,
          AVG(cart_add_rate) as avg_cart_add_rate,
          AVG(purchase_rate) as avg_purchase_rate,
          SUM(spend_dollars) as total_spend,
          SUM(total_sales_dollars) as total_sales,
          AVG(cpc_dollars) as avg_cpc,
          SUM(total_units) as total_units,
          AVG(search_impression_share_percentage) as avg_impression_share,
          AVG(click_share_percentage) as avg_click_share,
          AVG(search_impression_rank_avg) as avg_impression_rank,
          AVG(click_rank_avg) as avg_click_rank,
          NOW() as created_at,
          NOW() as updated_at
        FROM sqp.search_query_performance
        WHERE start_date >= CURRENT_DATE - INTERVAL '8 weeks'
        GROUP BY DATE_TRUNC('week', start_date), asin, search_query
        ON CONFLICT (week_start_date, week_end_date, asin, search_query) 
        DO UPDATE SET
          total_impressions = EXCLUDED.total_impressions,
          total_clicks = EXCLUDED.total_clicks,
          total_cart_adds = EXCLUDED.total_cart_adds,
          total_purchases = EXCLUDED.total_purchases,
          avg_ctr = EXCLUDED.avg_ctr,
          avg_cvr = EXCLUDED.avg_cvr,
          avg_cart_add_rate = EXCLUDED.avg_cart_add_rate,
          avg_purchase_rate = EXCLUDED.avg_purchase_rate,
          total_spend = EXCLUDED.total_spend,
          total_sales = EXCLUDED.total_sales,
          avg_cpc = EXCLUDED.avg_cpc,
          total_units = EXCLUDED.total_units,
          avg_impression_share = EXCLUDED.avg_impression_share,
          avg_click_share = EXCLUDED.avg_click_share,
          avg_impression_rank = EXCLUDED.avg_impression_rank,
          avg_click_rank = EXCLUDED.avg_click_rank,
          updated_at = NOW()
      `,
      
      monthly_summary: `
        INSERT INTO sqp.monthly_summary (
          month_start_date, month_end_date, asin, search_query,
          total_impressions, total_clicks, total_cart_adds, total_purchases,
          avg_ctr, avg_cvr, avg_cart_add_rate, avg_purchase_rate,
          total_spend, total_sales, avg_cpc, total_units,
          avg_impression_share, avg_click_share, 
          avg_impression_rank, avg_click_rank,
          created_at, updated_at
        )
        SELECT 
          DATE_TRUNC('month', start_date)::date as month_start_date,
          (DATE_TRUNC('month', start_date) + INTERVAL '1 month' - INTERVAL '1 day')::date as month_end_date,
          asin,
          search_query,
          SUM(impressions) as total_impressions,
          SUM(clicks) as total_clicks,
          SUM(cart_adds) as total_cart_adds,
          SUM(purchases) as total_purchases,
          AVG(ctr_percentage) as avg_ctr,
          AVG(cvr_percentage) as avg_cvr,
          AVG(cart_add_rate) as avg_cart_add_rate,
          AVG(purchase_rate) as avg_purchase_rate,
          SUM(spend_dollars) as total_spend,
          SUM(total_sales_dollars) as total_sales,
          AVG(cpc_dollars) as avg_cpc,
          SUM(total_units) as total_units,
          AVG(search_impression_share_percentage) as avg_impression_share,
          AVG(click_share_percentage) as avg_click_share,
          AVG(search_impression_rank_avg) as avg_impression_rank,
          AVG(click_rank_avg) as avg_click_rank,
          NOW() as created_at,
          NOW() as updated_at
        FROM sqp.search_query_performance
        WHERE start_date >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', start_date), asin, search_query
        ON CONFLICT (month_start_date, month_end_date, asin, search_query) 
        DO UPDATE SET
          total_impressions = EXCLUDED.total_impressions,
          total_clicks = EXCLUDED.total_clicks,
          total_cart_adds = EXCLUDED.total_cart_adds,
          total_purchases = EXCLUDED.total_purchases,
          avg_ctr = EXCLUDED.avg_ctr,
          avg_cvr = EXCLUDED.avg_cvr,
          avg_cart_add_rate = EXCLUDED.avg_cart_add_rate,
          avg_purchase_rate = EXCLUDED.avg_purchase_rate,
          total_spend = EXCLUDED.total_spend,
          total_sales = EXCLUDED.total_sales,
          avg_cpc = EXCLUDED.avg_cpc,
          total_units = EXCLUDED.total_units,
          avg_impression_share = EXCLUDED.avg_impression_share,
          avg_click_share = EXCLUDED.avg_click_share,
          avg_impression_rank = EXCLUDED.avg_impression_rank,
          avg_click_rank = EXCLUDED.avg_click_rank,
          updated_at = NOW()
      `,

      quarterly_summary: `
        INSERT INTO sqp.quarterly_summary (
          quarter_start_date, quarter_end_date, asin, search_query,
          total_impressions, total_clicks, total_cart_adds, total_purchases,
          avg_ctr, avg_cvr, avg_cart_add_rate, avg_purchase_rate,
          total_spend, total_sales, avg_cpc, total_units,
          avg_impression_share, avg_click_share, 
          avg_impression_rank, avg_click_rank,
          created_at, updated_at
        )
        SELECT 
          DATE_TRUNC('quarter', start_date)::date as quarter_start_date,
          (DATE_TRUNC('quarter', start_date) + INTERVAL '3 months' - INTERVAL '1 day')::date as quarter_end_date,
          asin,
          search_query,
          SUM(impressions) as total_impressions,
          SUM(clicks) as total_clicks,
          SUM(cart_adds) as total_cart_adds,
          SUM(purchases) as total_purchases,
          AVG(ctr_percentage) as avg_ctr,
          AVG(cvr_percentage) as avg_cvr,
          AVG(cart_add_rate) as avg_cart_add_rate,
          AVG(purchase_rate) as avg_purchase_rate,
          SUM(spend_dollars) as total_spend,
          SUM(total_sales_dollars) as total_sales,
          AVG(cpc_dollars) as avg_cpc,
          SUM(total_units) as total_units,
          AVG(search_impression_share_percentage) as avg_impression_share,
          AVG(click_share_percentage) as avg_click_share,
          AVG(search_impression_rank_avg) as avg_impression_rank,
          AVG(click_rank_avg) as avg_click_rank,
          NOW() as created_at,
          NOW() as updated_at
        FROM sqp.search_query_performance
        WHERE start_date >= CURRENT_DATE - INTERVAL '2 years'
        GROUP BY DATE_TRUNC('quarter', start_date), asin, search_query
        ON CONFLICT (quarter_start_date, quarter_end_date, asin, search_query) 
        DO UPDATE SET
          total_impressions = EXCLUDED.total_impressions,
          total_clicks = EXCLUDED.total_clicks,
          total_cart_adds = EXCLUDED.total_cart_adds,
          total_purchases = EXCLUDED.total_purchases,
          avg_ctr = EXCLUDED.avg_ctr,
          avg_cvr = EXCLUDED.avg_cvr,
          avg_cart_add_rate = EXCLUDED.avg_cart_add_rate,
          avg_purchase_rate = EXCLUDED.avg_purchase_rate,
          total_spend = EXCLUDED.total_spend,
          total_sales = EXCLUDED.total_sales,
          avg_cpc = EXCLUDED.avg_cpc,
          total_units = EXCLUDED.total_units,
          avg_impression_share = EXCLUDED.avg_impression_share,
          avg_click_share = EXCLUDED.avg_click_share,
          avg_impression_rank = EXCLUDED.avg_impression_rank,
          avg_click_rank = EXCLUDED.avg_click_rank,
          updated_at = NOW()
      `,

      yearly_summary: `
        INSERT INTO sqp.yearly_summary (
          year_start_date, year_end_date, asin, search_query,
          total_impressions, total_clicks, total_cart_adds, total_purchases,
          avg_ctr, avg_cvr, avg_cart_add_rate, avg_purchase_rate,
          total_spend, total_sales, avg_cpc, total_units,
          avg_impression_share, avg_click_share, 
          avg_impression_rank, avg_click_rank,
          created_at, updated_at
        )
        SELECT 
          DATE_TRUNC('year', start_date)::date as year_start_date,
          (DATE_TRUNC('year', start_date) + INTERVAL '1 year' - INTERVAL '1 day')::date as year_end_date,
          asin,
          search_query,
          SUM(impressions) as total_impressions,
          SUM(clicks) as total_clicks,
          SUM(cart_adds) as total_cart_adds,
          SUM(purchases) as total_purchases,
          AVG(ctr_percentage) as avg_ctr,
          AVG(cvr_percentage) as avg_cvr,
          AVG(cart_add_rate) as avg_cart_add_rate,
          AVG(purchase_rate) as avg_purchase_rate,
          SUM(spend_dollars) as total_spend,
          SUM(total_sales_dollars) as total_sales,
          AVG(cpc_dollars) as avg_cpc,
          SUM(total_units) as total_units,
          AVG(search_impression_share_percentage) as avg_impression_share,
          AVG(click_share_percentage) as avg_click_share,
          AVG(search_impression_rank_avg) as avg_impression_rank,
          AVG(click_rank_avg) as avg_click_rank,
          NOW() as created_at,
          NOW() as updated_at
        FROM sqp.search_query_performance
        WHERE start_date >= CURRENT_DATE - INTERVAL '3 years'
        GROUP BY DATE_TRUNC('year', start_date), asin, search_query
        ON CONFLICT (year_start_date, year_end_date, asin, search_query) 
        DO UPDATE SET
          total_impressions = EXCLUDED.total_impressions,
          total_clicks = EXCLUDED.total_clicks,
          total_cart_adds = EXCLUDED.total_cart_adds,
          total_purchases = EXCLUDED.total_purchases,
          avg_ctr = EXCLUDED.avg_ctr,
          avg_cvr = EXCLUDED.avg_cvr,
          avg_cart_add_rate = EXCLUDED.avg_cart_add_rate,
          avg_purchase_rate = EXCLUDED.avg_purchase_rate,
          total_spend = EXCLUDED.total_spend,
          total_sales = EXCLUDED.total_sales,
          avg_cpc = EXCLUDED.avg_cpc,
          total_units = EXCLUDED.total_units,
          avg_impression_share = EXCLUDED.avg_impression_share,
          avg_click_share = EXCLUDED.avg_click_share,
          avg_impression_rank = EXCLUDED.avg_impression_rank,
          avg_click_rank = EXCLUDED.avg_click_rank,
          updated_at = NOW()
      `
    }

    const refreshQuery = summaryRefreshQueries[tableName]
    
    if (!refreshQuery) {
      throw new Error(`No refresh query defined for table: ${tableName}`)
    }

    console.log(`Executing refresh for ${tableName}...`)

    // Execute the refresh using the execute_sql helper function
    const { error: refreshError } = await supabase.rpc('execute_sql', {
      sql: refreshQuery
    })

    if (refreshError) {
      throw new Error(`Failed to refresh ${tableName}: ${refreshError.message}`)
    }

    // Get the updated row count
    const { data: rowCount, error: countError } = await supabase
      .rpc('get_table_row_count', {
        schema_name: 'sqp',
        table_name: tableName
      })

    if (countError) {
      console.warn(`Could not get row count for ${tableName}:`, countError)
    }

    // Update audit log
    if (auditLogId) {
      await supabase
        .from('refresh_audit_log')
        .update({
          status: 'success',
          rows_processed: rowCount || 0,
          execution_time_ms: Date.now() - startTime,
          refresh_completed_at: new Date().toISOString(),
          sync_metadata: { table_type: 'summary', refresh_type: 'aggregate' }
        })
        .eq('id', auditLogId)
    }

    return createSuccessResponse({ 
      rowCount: rowCount || 0,
      executionTimeMs: Date.now() - startTime,
      message: `Successfully refreshed ${tableName}` 
    })

  } catch (error) {
    console.error(`Summary table refresh error for ${config?.table_name}:`, error)
    
    if (auditLogId) {
      await logError(
        createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''),
        auditLogId,
        error.message
      )
    }
    
    return createErrorResponse('Summary table refresh failed', error.message)
  }
})