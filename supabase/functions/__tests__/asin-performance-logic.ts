// Logic for ASIN performance data refresh - extracted for testability

export async function checkForExistingCheckpoint(supabase: any, tableName: string) {
  const { data, error } = await supabase
    .from('sqp.refresh_checkpoints')
    .select('*')
    .eq('function_name', 'refresh-asin-performance')
    .eq('table_name', tableName)
    .eq('status', 'active')
    .single()

  return data?.checkpoint_data || null
}

export async function saveCheckpoint(
  supabase: any, 
  tableName: string, 
  checkpointData: any
) {
  const { error } = await supabase
    .from('sqp.refresh_checkpoints')
    .upsert({
      function_name: 'refresh-asin-performance',
      table_schema: 'sqp',
      table_name: tableName,
      checkpoint_data: checkpointData,
      status: 'active',
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'function_name,table_schema,table_name,status'
    })

  if (error) throw error
}

export async function completeCheckpoint(supabase: any, tableName: string) {
  await supabase
    .from('sqp.refresh_checkpoints')
    .update({ status: 'completed' })
    .eq('function_name', 'refresh-asin-performance')
    .eq('table_name', tableName)
    .eq('status', 'active')
}

export async function fetchNewDataFromBigQuery(
  bigquery: any, 
  lastProcessedDate: string,
  batchSize: number = 5000
) {
  const query = `
    SELECT *
    FROM \`${process.env.BIGQUERY_PROJECT_ID || Deno.env.get('BIGQUERY_PROJECT_ID')}.${
      process.env.BIGQUERY_DATASET || Deno.env.get('BIGQUERY_DATASET')
    }.asin_performance_view\`
    WHERE end_date > @lastProcessedDate
    ORDER BY end_date
    LIMIT ${batchSize}
  `

  const [rows] = await bigquery.query({
    query,
    params: { lastProcessedDate },
    useLegacySql: false
  })

  return rows
}

export function transformAsinPerformanceRow(row: any): any {
  return {
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
  }
}

export async function processBatch(
  supabase: any, 
  rows: any[], 
  batchSize: number = 500
) {
  let rowsProcessed = 0
  let rowsInserted = 0
  let rowsUpdated = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const transformedData = batch.map(transformAsinPerformanceRow)
    
    const { data, error } = await supabase
      .from('sqp.asin_performance_data')
      .upsert(transformedData, {
        onConflict: 'start_date,end_date,asin',
        ignoreDuplicates: false
      })
      .select()

    if (error) throw error

    rowsProcessed += batch.length
    // In real implementation, we'd check created_at vs updated_at to determine insert vs update
    rowsInserted += data?.length || 0
  }

  return { rowsProcessed, rowsInserted, rowsUpdated }
}

export async function processBatchWithCheckpoint(
  supabase: any,
  rows: any[],
  batchSize: number,
  batchNumber: number
) {
  const result = await processBatch(supabase, rows, batchSize)
  
  // Save checkpoint after processing
  const lastRow = rows[rows.length - 1]
  await saveCheckpoint(supabase, 'asin_performance_data', {
    last_processed_date: lastRow.end_date,
    batch_number: batchNumber,
    rows_processed: result.rowsProcessed
  })

  return result
}

export function isApproachingTimeLimit(
  startTime: number, 
  limitMs: number = 240000 // 4 minutes
): boolean {
  const elapsed = Date.now() - startTime
  return elapsed > limitMs - 30000 // 30 seconds buffer
}

export async function scheduleContinuation(
  supabase: any,
  config: any,
  auditLogId: number
) {
  console.log('Scheduling continuation of refresh...')
  await supabase.functions.invoke('refresh-asin-performance', {
    body: { config, auditLogId }
  })
}

export async function updateAuditLogError(
  supabase: any,
  auditLogId: number,
  error: any
) {
  await supabase
    .from('sqp.refresh_audit_log')
    .update({
      status: 'failed',
      error_message: error.message,
      refresh_completed_at: new Date().toISOString()
    })
    .eq('id', auditLogId)
}

export async function getLastSyncDate(supabase: any): Promise<string> {
  const { data } = await supabase
    .from('sqp.asin_performance_data')
    .select('end_date')
    .order('end_date', { ascending: false })
    .limit(1)
    .single()

  return data?.end_date || '2024-08-18' // Default start date
}

export async function logPerformanceMetrics(
  supabase: any,
  auditLogId: number,
  metrics: {
    rowsProcessed: number
    rowsInserted: number
    rowsUpdated: number
    startTime: number
  }
) {
  const executionTimeMs = Date.now() - metrics.startTime
  
  await supabase
    .from('sqp.refresh_audit_log')
    .update({
      rows_processed: metrics.rowsProcessed,
      rows_inserted: metrics.rowsInserted,
      rows_updated: metrics.rowsUpdated,
      execution_time_ms: executionTimeMs,
      status: 'success',
      refresh_completed_at: new Date().toISOString()
    })
    .eq('id', auditLogId)
}