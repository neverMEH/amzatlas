import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    console.log('Starting daily refresh orchestration...')

    // 1. Get tables due for refresh
    const { data: tablesToRefresh, error: configError } = await supabase
      .from('sqp.refresh_config')
      .select('*')
      .eq('is_enabled', true)
      .lte('next_refresh_at', new Date().toISOString())
      .order('priority', { ascending: false })

    if (configError) throw configError

    console.log(`Found ${tablesToRefresh?.length || 0} tables to refresh`)

    // 2. Process each table based on type
    const refreshPromises = tablesToRefresh?.map(async (config) => {
      const functionName = getFunctionNameForTable(config.table_name)
      
      // Create audit log entry
      const { data: auditLog } = await supabase
        .from('sqp.refresh_audit_log')
        .insert({
          refresh_config_id: config.id,
          table_schema: config.table_schema,
          table_name: config.table_name,
          refresh_started_at: new Date().toISOString(),
          status: 'running'
        })
        .select()
        .single()

      try {
        // Invoke appropriate refresh function
        const response = await supabase.functions.invoke(functionName, {
          body: { 
            config,
            auditLogId: auditLog?.id 
          }
        })

        if (!response.error) {
          // Update next refresh time
          await supabase
            .from('sqp.refresh_config')
            .update({ 
              last_refresh_at: new Date().toISOString(),
              next_refresh_at: new Date(Date.now() + config.refresh_frequency_hours * 60 * 60 * 1000).toISOString()
            })
            .eq('id', config.id)
        }

        return response
      } catch (error) {
        console.error(`Error refreshing ${config.table_name}:`, error)
        
        // Update audit log with error
        await supabase
          .from('sqp.refresh_audit_log')
          .update({
            status: 'failed',
            error_message: error.message,
            refresh_completed_at: new Date().toISOString()
          })
          .eq('id', auditLog?.id)

        return { error: error.message }
      }
    }) || []

    // Wait for all refreshes to complete
    const results = await Promise.allSettled(refreshPromises)
    
    return new Response(
      JSON.stringify({
        success: true,
        tablesProcessed: results.length,
        results: results.map(r => r.status)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Orchestrator error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function getFunctionNameForTable(tableName: string): string {
  const functionMap: Record<string, string> = {
    'asin_performance_data': 'refresh-asin-performance',
    'search_query_performance': 'refresh-search-queries',
    'search_performance_summary': 'refresh-summary-tables',
    'weekly_summary': 'refresh-summary-tables',
    'monthly_summary': 'refresh-summary-tables',
    'quarterly_summary': 'refresh-summary-tables',
    'yearly_summary': 'refresh-summary-tables',
    'daily_sqp_data': 'refresh-daily-sqp'
  }
  
  return functionMap[tableName] || 'refresh-generic-table'
}