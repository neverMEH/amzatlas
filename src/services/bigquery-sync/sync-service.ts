import { BigQuery } from '@google-cloud/bigquery'
import { createClient } from '@supabase/supabase-js'
import { getBigQueryConfig } from '../../config/bigquery.config'
import { getFileBigQueryClient } from '../../config/bigquery-file-auth.config'
import { getSupabaseConfig } from '../../config/supabase.config'

export interface SyncResult {
  success: boolean
  table: string
  rowsProcessed: number
  error?: string
  duration: number
}

export class BigQuerySyncService {
  private bigquery: BigQuery
  private supabase: any
  
  constructor() {
    // Use the file-based BigQuery client which is more reliable in production
    this.bigquery = getFileBigQueryClient()
    
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
      
      // Skip tables that shouldn't be synced from BigQuery
      const skipTables = ['brands', 'asin_brand_mapping', 'brand_hierarchy', 'sync_log', 'data_quality_checks']
      if (skipTables.includes(tableName)) {
        console.log(`Skipping ${tableName} - this table is not synced from BigQuery`)
        return {
          success: true,
          table: tableName,
          rowsProcessed: 0,
          duration: Date.now() - startTime
        }
      }
      
      // For search_query_performance, we need to ensure parent records exist first
      if (tableName === 'search_query_performance') {
        console.log('Syncing search_query_performance - ensuring parent records exist...')
        await this.ensureParentRecords(dateRange)
      } else if (tableName === 'asin_performance_data') {
        console.log('Syncing asin_performance_data - this will create parent records')
        // When syncing asin_performance_data, we'll create the parent records
        // that search_query_performance depends on
      }
      
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
      
      // Use config directly since supabase is typed as any
      const refreshConfig = config
      
      // Create audit log entry
      const { data: auditLog } = await this.supabase
        .from('refresh_audit_log')
        .insert({
          table_schema: refreshConfig.table_schema,
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
        let rows: any[] = []
        try {
          console.log('Starting BigQuery query execution...')
          const queryOptions = { 
            query,
            location: config.location || 'US'
          }
          console.log('Query options:', queryOptions)
          
          const startQueryTime = Date.now()
          ;[rows] = await this.bigquery.query(queryOptions)
          const queryDuration = Date.now() - startQueryTime
          
          console.log(`✅ BigQuery query completed in ${queryDuration}ms`)
          console.log(`Fetched ${rows.length} rows from BigQuery`)
          
          if (rows.length > 0) {
            console.log('Sample row columns:', Object.keys(rows[0]))
          }
        } catch (queryError: any) {
          console.error('❌ BigQuery query failed:')
          console.error('Query:', query)
          console.error('Error message:', queryError.message)
          console.error('Error code:', queryError.code)
          
          if (queryError.errors && queryError.errors.length > 0) {
            console.error('Detailed errors:', JSON.stringify(queryError.errors, null, 2))
          }
          if (queryError.response && queryError.response.body) {
            console.error('Response body:', queryError.response.body)
          }
          throw queryError
        }
        
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
          const { error: deleteError } = await this.supabase
            .from(tableName)
            .delete()
            .gte('created_at', '1900-01-01')
          
          if (deleteError) {
            throw new Error(`Failed to truncate table: ${deleteError.message}`)
          }
        }
        
        // Insert in batches
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize)
          
          // Transform data if needed
          let transformedBatch = this.transformData(tableName, batch)
          
          // For search_query_performance, we need to resolve parent IDs
          if (tableName === 'search_query_performance') {
            transformedBatch = await this.resolveParentIds(transformedBatch)
          }
          
          // Insert batch
          const { error: insertError } = await this.supabase
            .from(tableName)
            .insert(transformedBatch)
          
          if (insertError) {
            throw new Error(`Insert failed at batch ${i / batchSize}: ${insertError.message}`)
          }
          
          totalProcessed += batch.length
          console.log(`Processed ${totalProcessed}/${rows.length} rows`)
        }
        
        // Update audit log and config
        await this.updateAuditLog(auditLogId, 'success', totalProcessed)
        await this.updateRefreshConfig(refreshConfig.id)
        
        return {
          success: true,
          table: tableName,
          rowsProcessed: totalProcessed,
          duration: Date.now() - startTime
        }
        
      } catch (error) {
        await this.updateAuditLog(auditLogId, 'failed', 0, error instanceof Error ? error.message : 'Unknown error')
        throw error
      }
      
    } catch (error) {
      console.error(`Sync failed for ${tableName}:`, error)
      return {
        success: false,
        table: tableName,
        rowsProcessed: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      }
    }
  }
  
  private buildQuery(tableName: string, dateRange?: { start: string; end: string }): string {
    const config = getBigQueryConfig()
    const dataset = config.datasets.production
    
    console.log('BigQuery configuration:', {
      projectId: config.projectId,
      dataset: dataset,
      location: config.location,
      tableName: tableName
    })
    
    // ALL Supabase tables pull from the same BigQuery source table
    const bigQueryTable = 'seller-search_query_performance'
    
    // ALL data comes from the same BigQuery table, just transform it differently for each target
    // Simple query - just get the raw data and let transformData handle the rest
    const query = `
      SELECT *
      FROM \`${config.projectId}.${dataset}.${bigQueryTable}\`
      ${dateRange ? `WHERE DATE(\`Date\`) BETWEEN '${dateRange.start}' AND '${dateRange.end}'` : 'WHERE DATE(\`Date\`) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)'}
      LIMIT 10000
    `
    
    console.log('Query to execute:', query)
    return query
  }
  
  private async ensureParentRecords(dateRange?: { start: string; end: string }) {
    console.log('Ensuring parent ASIN records exist...')
    
    const config = getBigQueryConfig()
    const dataset = config.datasets.production
    const tableName = 'seller-search_query_performance'
    
    // Get unique ASINs for the date range
    let whereClause = ''
    if (dateRange) {
      whereClause = `WHERE DATE(\`Date\`) BETWEEN '${dateRange.start}' AND '${dateRange.end}'`
    } else {
      whereClause = `WHERE DATE(\`Date\`) >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)`
    }
    
    const query = `
      SELECT DISTINCT
        COALESCE(\`Parent ASIN\`, \`Child ASIN\`) as asin,
        DATE(\`Date\`) as date
      FROM \`${config.projectId}.${dataset}.${tableName}\`
      ${whereClause}
      AND (\`Parent ASIN\` IS NOT NULL OR \`Child ASIN\` IS NOT NULL)
    `
    
    console.log('Executing parent records query:', query)
    
    let rows: any[] = []
    try {
      [rows] = await this.bigquery.query({ query })
      console.log(`Found ${rows.length} unique ASIN/date combinations`)
    } catch (error: any) {
      console.error('Parent records query failed:', error.message)
      if (error.errors) {
        console.error('Error details:', JSON.stringify(error.errors, null, 2))
      }
      // Don't throw - continue with sync even if parent records fail
      return
    }
    
    if (rows.length === 0) return
    
    // Transform to parent records
    const parentRecords = rows.map((row: any) => {
      const dateValue = row.date?.value || row.date
      const dateStr = dateValue.split('T')[0]
      return {
        asin: row.asin,
        start_date: dateStr,
        end_date: dateStr
      }
    })
    
    // Insert in batches (without using onConflict since there's no unique constraint)
    const batchSize = 100
    for (let i = 0; i < parentRecords.length; i += batchSize) {
      const batch = parentRecords.slice(i, i + batchSize)
      
      // First check which records already exist
      const asins = batch.map(r => r.asin)
      const dates = batch.map(r => r.start_date)
      
      const { data: existing } = await this.supabase
        .from('asin_performance_data')
        .select('asin, start_date, end_date')
        .in('asin', asins)
        .in('start_date', dates)
      
      // Filter out existing records
      const existingKeys = new Set(
        (existing || []).map((e: any) => `${e.asin}_${e.start_date}_${e.end_date}`)
      )
      
      const newRecords = batch.filter(r => 
        !existingKeys.has(`${r.asin}_${r.start_date}_${r.end_date}`)
      )
      
      if (newRecords.length > 0) {
        const { error } = await this.supabase
          .from('asin_performance_data')
          .insert(newRecords)
          .select() // Return inserted records
        
        if (error) {
          console.error(`Error inserting parent records:`, error)
          // If it's a unique violation, that's OK - the record already exists
          if (!error.message?.includes('duplicate key')) {
            console.error('Non-duplicate error, this might be a problem')
          }
        } else {
          console.log(`Inserted ${newRecords.length} parent records`)
        }
      }
    }
    
    console.log('Parent records ensured')
  }
  
  private async resolveParentIds(records: any[]): Promise<any[]> {
    // Group by ASIN and date to minimize queries
    const lookupKeys = [...new Set(records.map(r => `${r._temp_asin}_${r._temp_date}`))]
    const lookupMap = new Map()
    
    // Batch lookup parent IDs
    for (let i = 0; i < lookupKeys.length; i += 50) {
      const batchKeys = lookupKeys.slice(i, i + 50)
      const conditions = batchKeys.map(key => {
        const [asin, date] = key.split('_')
        return { asin, start_date: date, end_date: date }
      })
      
      // Build dynamic query
      let query = this.supabase
        .from('asin_performance_data')
        .select('id, asin, start_date, end_date')
      
      // Add OR conditions
      conditions.forEach((cond, idx) => {
        if (idx === 0) {
          query = query
            .eq('asin', cond.asin)
            .eq('start_date', cond.start_date)
            .eq('end_date', cond.end_date)
        } else {
          query = query.or(`asin.eq.${cond.asin},start_date.eq.${cond.start_date},end_date.eq.${cond.end_date}`)
        }
      })
      
      const { data: parentRecords } = await query
      
      if (parentRecords) {
        parentRecords.forEach((parent: any) => {
          const key = `${parent.asin}_${parent.start_date}`
          lookupMap.set(key, parent.id)
        })
      }
    }
    
    // Map records to parent IDs
    return records.map(record => {
      const key = `${record._temp_asin}_${record._temp_date}`
      const parentId = lookupMap.get(key)
      
      if (!parentId) {
        console.warn(`No parent ID found for ${key}`)
        return null
      }
      
      // Remove temp fields and add parent ID
      const { _temp_asin, _temp_date, ...rest } = record
      return {
        ...rest,
        asin_performance_id: parentId
      }
    }).filter(r => r !== null)
  }

  private transformData(tableName: string, data: any[]): any[] {
    // Transform BigQuery data to match Supabase schema
    if (tableName === 'search_query_performance') {
      // We need to map the records to their parent IDs
      // This will be done in a separate step after transformation
      return data.map(row => {
        // Extract date value from BigQuery date object
        const dateValue = row.Date?.value || row.Date || new Date().toISOString()
        const dateStr = dateValue.split('T')[0] // Get just the date part
        
        // Use Parent ASIN as the main ASIN
        const asin = row['Parent ASIN'] || row['Child ASIN'] || 'UNKNOWN'
        
        return {
          // We'll set asin_performance_id later after looking up the parent record
          _temp_asin: asin,
          _temp_date: dateStr,
          search_query: row['Search Query'] || '',
          search_query_score: parseInt(row['Search Query Score']) || 0,
          search_query_volume: parseInt(row['Search Query Volume']) || 0,
          total_query_impression_count: parseInt(row['Total Query Impression Count']) || 0,
          asin_impression_count: parseInt(row['ASIN Impression Count']) || 0,
          asin_impression_share: parseFloat(row['ASIN Impression Share']) || 0,
          total_click_count: parseInt(row['Total Click Count']) || 0,
          total_click_rate: parseFloat(row['Total Click Rate']) || 0,
          asin_click_count: parseInt(row['ASIN Click Count']) || 0,
          asin_click_share: parseFloat(row['ASIN Click Share']) || 0,
          total_median_click_price: parseFloat(row['Total Median Click Price Amount']) || 0,
          asin_median_click_price: parseFloat(row['ASIN Median Click Price Amount']) || 0,
          total_same_day_shipping_click_count: parseInt(row['Total Same Day Shipping Click Count']) || 0,
          total_one_day_shipping_click_count: parseInt(row['Total One Day Shipping Click Count']) || 0,
          total_two_day_shipping_click_count: parseInt(row['Total Two Day Shipping Click Count']) || 0,
          total_cart_add_count: parseInt(row['Total Cart Add Count']) || 0,
          total_cart_add_rate: parseFloat(row['Total Cart Add Rate']) || 0,
          asin_cart_add_count: parseInt(row['ASIN Cart Add Count']) || 0,
          asin_cart_add_share: parseFloat(row['ASIN Cart Add Share']) || 0,
          total_median_cart_add_price: parseFloat(row['Total Median Cart Add Price Amount']) || 0,
          asin_median_cart_add_price: parseFloat(row['ASIN Median Cart Add Price Amount']) || 0,
          total_same_day_shipping_cart_add_count: parseInt(row['Total Same Day Shipping Cart Add Count']) || 0,
          total_one_day_shipping_cart_add_count: parseInt(row['Total One Day Shipping Cart Add Count']) || 0,
          total_two_day_shipping_cart_add_count: parseInt(row['Total Two Day Shipping Cart Add Count']) || 0,
          total_purchase_count: parseInt(row['Total Purchase Count']) || 0,
          total_purchase_rate: parseFloat(row['Total Purchase Rate']) || 0,
          asin_purchase_count: parseInt(row['ASIN Purchase Count']) || 0,
          asin_purchase_share: parseFloat(row['ASIN Purchase Share']) || 0,
          total_median_purchase_price: parseFloat(row['Total Median Purchase Price Amount']) || 0,
          asin_median_purchase_price: parseFloat(row['ASIN Median Purchase Price Amount']) || 0,
          total_same_day_shipping_purchase_count: parseInt(row['Total Same Day Shipping Purchase Count']) || 0,
          total_one_day_shipping_purchase_count: parseInt(row['Total One Day Shipping Purchase Count']) || 0,
          total_two_day_shipping_purchase_count: parseInt(row['Total Two Day Shipping Purchase Count']) || 0,
          // Standard fields
          asin,
          start_date: dateStr,
          end_date: dateStr,
          // Aggregated fields for summary
          impressions_sum: parseInt(row['ASIN Impression Count']) || 0,
          clicks_sum: parseInt(row['ASIN Click Count']) || 0,
          cart_adds_sum: parseInt(row['ASIN Cart Add Count']) || 0,
          purchases_sum: parseInt(row['ASIN Purchase Count']) || 0,
          median_price_purchase: parseFloat(row['ASIN Median Purchase Price Amount']) || 0
        }
      })
    }
    
    if (tableName === 'asin_performance_data') {
      // Extract unique ASIN/date combinations from raw BigQuery data
      // This creates parent records that search_query_performance can reference
      const uniqueRecords = new Map<string, any>()
      
      data.forEach(row => {
        // Get date from BigQuery format
        const dateValue = row.Date?.value || row.Date || row['Date']
        const dateStr = dateValue ? dateValue.split('T')[0] : new Date().toISOString().split('T')[0]
        
        // Get ASIN - prefer Parent ASIN if available
        const asin = row['Parent ASIN'] || row['ASIN'] || row['Child ASIN']
        
        if (asin && dateStr) {
          const key = `${asin}_${dateStr}_${dateStr}` // start_date and end_date are the same for daily data
          
          if (!uniqueRecords.has(key)) {
            uniqueRecords.set(key, {
              asin: asin,
              start_date: dateStr,
              end_date: dateStr
            })
          }
        }
      })
      
      return Array.from(uniqueRecords.values())
    }
    
    return data
  }
  
  private getConflictColumns(tableName: string): string {
    // No longer used since we're using INSERT instead of UPSERT
    // Keeping for potential future use
    const conflictColumns: Record<string, string> = {
      asin_performance_data: 'asin,start_date,end_date',
      search_query_performance: 'asin_performance_id,search_query',
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