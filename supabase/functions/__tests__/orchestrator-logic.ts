// Orchestrator logic extracted for testability

export async function handleRefreshOrchestration(supabase: any) {
  try {
    // Query tables due for refresh
    const { data: tablesToRefresh, error } = await supabase
      .from('sqp.refresh_config')
      .select('*')
      .eq('is_enabled', true)
      .lte('next_refresh_at', new Date().toISOString())
      .order('priority', { ascending: false })

    if (error) {
      return { error: error.message }
    }

    return { tablesToRefresh: tablesToRefresh || [] }
  } catch (error) {
    return { error: error.message }
  }
}

export async function createAuditLogEntry(supabase: any, config: any) {
  const { data, error } = await supabase
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

  if (error) throw error
  return data
}

export function getFunctionNameForTable(tableName: string): string {
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

export async function invokeRefreshFunction(
  supabase: any, 
  config: any, 
  auditLogId: number
) {
  const functionName = getFunctionNameForTable(config.table_name)
  
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: { 
        config,
        auditLogId
      }
    })

    if (error) {
      // Update audit log with error
      await supabase
        .from('sqp.refresh_audit_log')
        .update({
          status: 'failed',
          error_message: error.message,
          refresh_completed_at: new Date().toISOString()
        })
        .eq('id', auditLogId)
      
      return { error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    return { error: error.message }
  }
}

export async function updateNextRefreshTime(supabase: any, config: any) {
  const nextTime = calculateNextRefreshTime(
    new Date(), 
    config.refresh_frequency_hours
  )

  await supabase
    .from('sqp.refresh_config')
    .update({ 
      last_refresh_at: new Date().toISOString(),
      next_refresh_at: nextTime.toISOString()
    })
    .eq('id', config.id)
}

export function calculateNextRefreshTime(
  currentTime: Date, 
  frequencyHours: number
): Date {
  return new Date(currentTime.getTime() + frequencyHours * 60 * 60 * 1000)
}

export async function processTableRefreshes(supabase: any, tables: any[]) {
  const refreshPromises = tables.map(async (config) => {
    const auditLog = await createAuditLogEntry(supabase, config)
    const result = await invokeRefreshFunction(supabase, config, auditLog.id)
    
    if (!result.error) {
      await updateNextRefreshTime(supabase, config)
    }
    
    return result
  })

  return Promise.allSettled(refreshPromises)
}

export function handleCORS(request: any) {
  return new Response('ok', { 
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
    }
  })
}

export function formatResponse(results: any[]) {
  return {
    success: true,
    tablesProcessed: results.length,
    results: results.map(r => r.status)
  }
}

export function formatErrorResponse(error: Error) {
  return {
    success: false,
    error: error.message
  }
}