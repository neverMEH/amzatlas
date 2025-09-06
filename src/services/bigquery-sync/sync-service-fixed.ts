import { BigQuery } from '@google-cloud/bigquery'
import { createClient } from '@supabase/supabase-js'
import { getBigQueryConfig } from '../../config/bigquery.config'
import { getSupabaseConfig } from '../../config/supabase.config'

export interface SyncResult {
  success: boolean
  table: string
  rowsProcessed: number
  error?: string
  duration: number
}

export class BigQuerySyncServiceFixed {
  private bigquery: BigQuery
  private supabase: any
  
  constructor() {
    const bigQueryConfig = getBigQueryConfig()
    this.bigquery = new BigQuery({
      projectId: bigQueryConfig.projectId,
      credentials: bigQueryConfig.credentials,
      location: bigQueryConfig.location || 'US'
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
  } = {}): Promise<SyncResult> {
    const startTime = Date.now()
    const { batchSize = 1000, dateRange, truncate = false } = options
    
    try {
      console.log(`Starting sync for table: ${tableName}`)
      
      // Build and execute BigQuery query
      const query = this.buildQuery(tableName, dateRange)
      console.log(`Executing query...`)
      
      const [rows] = await this.bigquery.query(query)
      console.log(`Fetched ${rows.length} rows from BigQuery`)
      
      if (rows.length === 0) {
        return {
          success: true,
          table: tableName,
          rowsProcessed: 0,
          duration: Date.now() - startTime
        }
      }
      
      // Process based on table type
      let processedRows = 0
      
      if (tableName === 'asin_performance_data') {
        processedRows = await this.syncAsinPerformanceData(rows, batchSize)
      } else if (tableName === 'search_query_performance') {
        processedRows = await this.syncSearchQueryPerformance(rows, batchSize)
      }
      
      return {
        success: true,
        table: tableName,
        rowsProcessed: processedRows,
        duration: Date.now() - startTime
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
    const bqTable = 'seller-search_query_performance'
    
    // Use backticks for column names with spaces
    if (tableName === 'asin_performance_data') {
      return `
        SELECT DISTINCT
          COALESCE(\`Parent ASIN\`, \`Child ASIN\`) as asin,
          DATE(\`Date\`) as date
        FROM \`${config.projectId}.${dataset}.${bqTable}\`
        ${dateRange ? `WHERE DATE(\`Date\`) BETWEEN '${dateRange.start}' AND '${dateRange.end}'` : ''}
        LIMIT 10000
      `
    }
    
    if (tableName === 'search_query_performance') {
      return `
        SELECT 
          \`Parent ASIN\` as parent_asin,
          \`Child ASIN\` as child_asin,
          DATE(\`Date\`) as date,
          \`Search Query\` as search_query,
          \`Search Query Score\` as search_query_score,
          \`Search Query Volume\` as search_query_volume,
          \`ASIN Impression Count\` as asin_impression_count,
          \`ASIN Impression Share\` as asin_impression_share,
          \`ASIN Click Count\` as asin_click_count,
          \`ASIN Click Share\` as asin_click_share,
          \`ASIN Cart Add Count\` as asin_cart_add_count,
          \`ASIN Cart Add Share\` as asin_cart_add_share,
          \`ASIN Purchase Count\` as asin_purchase_count,
          \`ASIN Purchase Share\` as asin_purchase_share,
          \`ASIN Median Purchase Price Amount\` as asin_median_purchase_price
        FROM \`${config.projectId}.${dataset}.${bqTable}\`
        ${dateRange ? `WHERE DATE(\`Date\`) BETWEEN '${dateRange.start}' AND '${dateRange.end}'` : ''}
        LIMIT 10000
      `
    }
    
    return `SELECT * FROM \`${config.projectId}.${dataset}.${bqTable}\` LIMIT 100`
  }
  
  private async syncAsinPerformanceData(rows: any[], batchSize: number): Promise<number> {
    console.log(`Syncing ${rows.length} ASIN performance records...`)
    let processed = 0
    
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      
      const records = batch.map(row => {
        // Handle BigQuery date objects
        const dateValue = row.date?.value || row.date
        const dateStr = typeof dateValue === 'string' ? dateValue.split('T')[0] : dateValue
        
        return {
          asin: row.asin,
          start_date: dateStr,
          end_date: dateStr
        }
      })
      
      // Upsert records
      const { error } = await this.supabase
        .from('asin_performance_data')
        .upsert(records, {
          onConflict: 'asin,start_date,end_date',
          ignoreDuplicates: true
        })
      
      if (error) {
        console.error(`Batch insert error:`, error)
        throw error
      }
      
      processed += batch.length
      console.log(`Processed ${processed}/${rows.length} records`)
    }
    
    return processed
  }
  
  private async syncSearchQueryPerformance(rows: any[], batchSize: number): Promise<number> {
    console.log(`Syncing ${rows.length} search query performance records...`)
    
    // First, ensure parent records exist
    const parentAsins = [...new Set(rows.map(r => r.parent_asin || r.child_asin))]
    const dates = [...new Set(rows.map(r => {
      const dateValue = r.date?.value || r.date
      return typeof dateValue === 'string' ? dateValue.split('T')[0] : dateValue
    }))]
    
    console.log(`Creating parent records for ${parentAsins.length} ASINs...`)
    
    for (const asin of parentAsins) {
      for (const date of dates) {
        await this.supabase
          .from('asin_performance_data')
          .upsert({
            asin,
            start_date: date,
            end_date: date
          }, {
            onConflict: 'asin,start_date,end_date',
            ignoreDuplicates: true
          })
      }
    }
    
    // Get parent IDs
    const { data: parentRecords } = await this.supabase
      .from('asin_performance_data')
      .select('id, asin, start_date, end_date')
    
    const parentMap = new Map()
    parentRecords?.forEach((p: any) => {
      const key = `${p.asin}_${p.start_date}`
      parentMap.set(key, p.id)
    })
    
    // Now sync the search query data
    let processed = 0
    
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      
      const records = batch.map(row => {
        const asin = row.parent_asin || row.child_asin
        // Handle date formatting
        const dateValue = row.date?.value || row.date
        const dateStr = typeof dateValue === 'string' ? dateValue.split('T')[0] : dateValue
        const parentKey = `${asin}_${dateStr}`
        const parentId = parentMap.get(parentKey)
        
        if (!parentId) {
          console.warn(`No parent ID found for ${parentKey}`)
          return null
        }
        
        return {
          asin_performance_id: parentId,
          search_query: row.search_query || '',
          search_query_score: parseInt(row.search_query_score) || 0,
          search_query_volume: parseInt(row.search_query_volume) || 0,
          asin_impression_count: parseInt(row.asin_impression_count) || 0,
          asin_impression_share: parseFloat(row.asin_impression_share) || 0,
          asin_click_count: parseInt(row.asin_click_count) || 0,
          asin_click_share: parseFloat(row.asin_click_share) || 0,
          asin_cart_add_count: parseInt(row.asin_cart_add_count) || 0,
          asin_cart_add_share: parseFloat(row.asin_cart_add_share) || 0,
          asin_purchase_count: parseInt(row.asin_purchase_count) || 0,
          asin_purchase_share: parseFloat(row.asin_purchase_share) || 0,
          asin_median_purchase_price: parseFloat(row.asin_median_purchase_price) || 0,
          // Required fields
          asin: asin,
          start_date: dateStr,
          end_date: dateStr,
          // Summary fields
          impressions_sum: parseInt(row.asin_impression_count) || 0,
          clicks_sum: parseInt(row.asin_click_count) || 0,
          cart_adds_sum: parseInt(row.asin_cart_add_count) || 0,
          purchases_sum: parseInt(row.asin_purchase_count) || 0,
          median_price_purchase: parseFloat(row.asin_median_purchase_price) || 0
        }
      }).filter(r => r !== null)
      
      if (records.length > 0) {
        const { error } = await this.supabase
          .from('search_query_performance')
          .upsert(records, {
            onConflict: 'asin_performance_id,search_query',
            ignoreDuplicates: true
          })
        
        if (error) {
          console.error(`Batch insert error:`, error)
          // Continue with next batch instead of throwing
        }
      }
      
      processed += batch.length
      console.log(`Processed ${processed}/${rows.length} records`)
    }
    
    return processed
  }
}