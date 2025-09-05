import { BigQuery } from '@google-cloud/bigquery'
import { createClient } from '@supabase/supabase-js'
import { getBigQueryConfig } from '@/config/bigquery.config'
import { getSupabaseConfig } from '@/config/supabase.config'

export interface SyncResult {
  success: boolean
  table: string
  rowsProcessed: number
  error?: string
  duration: number
}

export class BigQuerySyncService {
  private bigquery: BigQuery
  private supabase: ReturnType<typeof createClient>
  
  constructor() {
    const bigQueryConfig = getBigQueryConfig()
    this.bigquery = new BigQuery({
      projectId: bigQueryConfig.projectId,
      credentials: bigQueryConfig.credentials,
    })
    
    const supabaseConfig = getSupabaseConfig()
    this.supabase = createClient(
      supabaseConfig.url,
      supabaseConfig.serviceRoleKey || supabaseConfig.anonKey
    )
  }
  
  async syncTable(tableName: string, options: {
    batchSize?: number
    dateRange?: { start: string; end: string }
    truncate?: boolean
    tableSchema?: string
  } = {}): Promise<SyncResult> {
    const startTime = Date.now()
    const { batchSize = 1000, dateRange, truncate = false, tableSchema = 'sqp' } = options
    
    try {
      console.log(`Starting sync for table: ${tableSchema}.${tableName}`)
      
      // Get table configuration
      const { data: config, error: configError } = await this.supabase
        .from('refresh_config')
        .select('*')
        .eq('table_schema', tableSchema)
        .eq('table_name', tableName)
        .single()
        
      if (configError || !config) {
        throw new Error(`Table configuration not found for ${tableName}`)
      }
      
      // Create audit log entry
      const { data: auditLog } = await this.supabase
        .from('refresh_audit_log')
        .insert({
          table_schema: config.table_schema,
          table_name: tableName,
          status: 'in_progress',
          refresh_started_at: new Date().toISOString(),
          refresh_type: 'api_sync'
        })
        .select()
        .single()
      
      const auditLogId = auditLog?.id
      
      try {
        // Build BigQuery query based on table type
        const query = this.buildQuery(tableName, dateRange)
        console.log(`Executing query: ${query}`)
        
        // Execute BigQuery query
        const [rows] = await this.bigquery.query({ query })
        console.log(`Fetched ${rows.length} rows from BigQuery`)
        
        if (rows.length === 0) {
          await this.updateAuditLog(auditLogId, 'success', 0)
          return {
            success: true,
            table: tableName,
            rowsProcessed: 0,
            duration: Date.now() - startTime
          }
        }
        
        // Process data in batches
        let totalProcessed = 0
        
        if (truncate) {
          // Clear existing data
          console.log(`Truncating existing data in ${tableName}`)
          await this.supabase
            .from(tableName)
            .delete()
            .gte('created_at', '1900-01-01')
        }
        
        // Insert in batches
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize)
          
          // Transform data if needed
          const transformedBatch = this.transformData(tableName, batch)
          
          // Insert batch
          const { error: insertError } = await this.supabase
            .from(tableName)
            .upsert(transformedBatch, { 
              onConflict: this.getConflictColumns(tableName) 
            })
          
          if (insertError) {
            throw new Error(`Insert failed at batch ${i / batchSize}: ${insertError.message}`)
          }
          
          totalProcessed += batch.length
          console.log(`Processed ${totalProcessed}/${rows.length} rows`)
        }
        
        // Update audit log and config
        await this.updateAuditLog(auditLogId, 'success', totalProcessed)
        await this.updateRefreshConfig(config.id)
        
        return {
          success: true,
          table: tableName,
          rowsProcessed: totalProcessed,
          duration: Date.now() - startTime
        }
        
      } catch (error) {
        await this.updateAuditLog(auditLogId, 'failed', 0, error.message)
        throw error
      }
      
    } catch (error) {
      console.error(`Sync failed for ${tableName}:`, error)
      return {
        success: false,
        table: tableName,
        rowsProcessed: 0,
        error: error.message,
        duration: Date.now() - startTime
      }
    }
  }
  
  private buildQuery(tableName: string, dateRange?: { start: string; end: string }): string {
    const config = getBigQueryConfig()
    const dataset = config.datasets.production
    
    // Base query for each table type
    const queries: Record<string, string> = {
      asin_performance_data: `
        SELECT 
          ASIN as asin,
          "Start Date" as start_date,
          "End Date" as end_date,
          "Child ASIN" as child_asin,
          ARRAY_AGG(
            STRUCT(
              "Search Query" as search_query,
              "Impressions" as impressions,
              "Clicks" as clicks,
              "Cart Adds" as cart_adds,
              "Purchases" as purchases
            )
          ) as search_query_performance
        FROM \`${config.projectId}.${dataset}.search_query_performance\`
        ${dateRange ? `WHERE DATE("End Date") BETWEEN '${dateRange.start}' AND '${dateRange.end}'` : ''}
        GROUP BY ASIN, "Start Date", "End Date", "Child ASIN"
        LIMIT 1000
      `,
      
      search_query_performance: `
        SELECT *
        FROM \`${config.projectId}.${dataset}.search_query_performance\`
        ${dateRange ? `WHERE DATE("End Date") BETWEEN '${dateRange.start}' AND '${dateRange.end}'` : 'WHERE DATE("End Date") >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)'}
        LIMIT 10000
      `,
      
      daily_sqp_data: `
        SELECT 
          ASIN as asin,
          DATE("End Date") as date,
          SUM(CAST("Impressions" AS INT64)) as impressions,
          SUM(CAST("Clicks" AS INT64)) as clicks,
          SUM(CAST("Cart Adds" AS INT64)) as cart_adds,
          SUM(CAST("Purchases" AS INT64)) as purchases
        FROM \`${config.projectId}.${dataset}.search_query_performance\`
        ${dateRange ? `WHERE DATE("End Date") BETWEEN '${dateRange.start}' AND '${dateRange.end}'` : 'WHERE DATE("End Date") >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)'}
        GROUP BY ASIN, date
      `
    }
    
    return queries[tableName] || `SELECT * FROM \`${config.projectId}.${dataset}.${tableName}\` LIMIT 1000`
  }
  
  private transformData(tableName: string, data: any[]): any[] {
    // Transform BigQuery data to match Supabase schema
    if (tableName === 'search_query_performance') {
      return data.map(row => ({
        asin_performance_data_id: `${row.ASIN}_${row['Start Date']}_${row['End Date']}`,
        search_query: row['Search Query'],
        impressions: parseInt(row.Impressions) || 0,
        clicks: parseInt(row.Clicks) || 0,
        cart_adds: parseInt(row['Cart Adds']) || 0,
        purchases: parseInt(row.Purchases) || 0,
        // Calculate derived metrics
        click_through_rate: row.Impressions > 0 ? (row.Clicks / row.Impressions) * 100 : 0,
        cart_add_rate: row.Clicks > 0 ? (row['Cart Adds'] / row.Clicks) * 100 : 0,
        purchase_rate: row.Clicks > 0 ? (row.Purchases / row.Clicks) * 100 : 0,
        start_date: row['Start Date'],
        end_date: row['End Date']
      }))
    }
    
    if (tableName === 'asin_performance_data') {
      return data.map(row => ({
        asin: row.asin,
        start_date: row.start_date,
        end_date: row.end_date,
        child_asin: row.child_asin,
        // Aggregate metrics from nested data
        total_impressions: row.search_query_performance?.reduce((sum: number, sq: any) => sum + sq.impressions, 0) || 0,
        total_clicks: row.search_query_performance?.reduce((sum: number, sq: any) => sum + sq.clicks, 0) || 0,
        total_cart_adds: row.search_query_performance?.reduce((sum: number, sq: any) => sum + sq.cart_adds, 0) || 0,
        total_purchases: row.search_query_performance?.reduce((sum: number, sq: any) => sum + sq.purchases, 0) || 0,
      }))
    }
    
    return data
  }
  
  private getConflictColumns(tableName: string): string {
    const conflictColumns: Record<string, string> = {
      asin_performance_data: 'asin,start_date,end_date',
      search_query_performance: 'asin_performance_data_id,search_query',
      daily_sqp_data: 'asin,date'
    }
    
    return conflictColumns[tableName] || 'id'
  }
  
  private async updateAuditLog(
    id: number | undefined, 
    status: string, 
    rowsProcessed: number, 
    errorMessage?: string
  ) {
    if (!id) return
    
    await this.supabase
      .from('refresh_audit_log')
      .update({
        status,
        refresh_completed_at: new Date().toISOString(),
        rows_processed: rowsProcessed,
        error_message: errorMessage
      })
      .eq('id', id)
  }
  
  private async updateRefreshConfig(configId: number) {
    const nextRefresh = new Date()
    nextRefresh.setHours(nextRefresh.getHours() + 24) // Default 24 hours
    
    await this.supabase
      .from('refresh_config')
      .update({
        last_refresh_at: new Date().toISOString(),
        next_refresh_at: nextRefresh.toISOString()
      })
      .eq('id', configId)
  }
}