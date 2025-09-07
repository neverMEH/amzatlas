# Edge Function Code Examples

This document provides example implementations for the Supabase Edge Functions detailed in @.agent-os/specs/2025-09-05-daily-bigquery-refresh/spec.md

> Created: 2025-09-05
> Version: 1.0.0

## Orchestrator Function: daily-refresh-orchestrator

```typescript
// supabase/functions/daily-refresh-orchestrator/index.ts
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
```

## Worker Function: refresh-asin-performance

```typescript
// supabase/functions/refresh-asin-performance/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { BigQuery } from "https://esm.sh/@google-cloud/bigquery@7"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { config, auditLogId } = await req.json()
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Initialize BigQuery
  const bigqueryCredentials = JSON.parse(Deno.env.get('GOOGLE_APPLICATION_CREDENTIALS_JSON') ?? '{}')
  const bigquery = new BigQuery({
    projectId: bigqueryCredentials.project_id,
    credentials: bigqueryCredentials
  })

  const startTime = Date.now()
  let rowsProcessed = 0
  let rowsInserted = 0
  let rowsUpdated = 0

  try {
    // Check for existing checkpoint
    const { data: checkpoint } = await supabase
      .from('sqp.refresh_checkpoints')
      .select('*')
      .eq('function_name', 'refresh-asin-performance')
      .eq('table_name', config.table_name)
      .eq('status', 'active')
      .single()

    let lastProcessedDate = checkpoint?.checkpoint_data?.last_processed_date
    
    if (!lastProcessedDate) {
      // Get last sync date from the table
      const { data: lastSync } = await supabase
        .from('sqp.asin_performance_data')
        .select('end_date')
        .order('end_date', { ascending: false })
        .limit(1)
        .single()
      
      lastProcessedDate = lastSync?.end_date || '2024-08-18'
    }

    console.log(`Starting sync from date: ${lastProcessedDate}`)

    // Query BigQuery for new data
    const query = `
      SELECT *
      FROM \`${Deno.env.get('BIGQUERY_PROJECT_ID')}.${Deno.env.get('BIGQUERY_DATASET')}.asin_performance_view\`
      WHERE end_date > @lastProcessedDate
      ORDER BY end_date
      LIMIT 5000
    `

    const [rows] = await bigquery.query({
      query,
      params: { lastProcessedDate },
      useLegacySql: false
    })

    console.log(`Retrieved ${rows.length} rows from BigQuery`)

    // Process in batches
    const batchSize = 500
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      
      // Transform and insert data
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
      rowsInserted += data?.filter(d => d.created_at === d.updated_at).length || 0
      rowsUpdated += data?.filter(d => d.created_at !== d.updated_at).length || 0

      // Update checkpoint every batch
      await supabase
        .from('sqp.refresh_checkpoints')
        .upsert({
          function_name: 'refresh-asin-performance',
          table_schema: config.table_schema,
          table_name: config.table_name,
          checkpoint_data: {
            last_processed_date: batch[batch.length - 1].end_date,
            batch_number: Math.floor(i / batchSize) + 1
          },
          last_processed_row: i + batch.length,
          total_rows: rows.length,
          status: 'active',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'function_name,table_schema,table_name,status'
        })

      // Check if we're approaching the 5-minute limit
      if (Date.now() - startTime > 4 * 60 * 1000) {
        console.log('Approaching time limit, scheduling continuation...')
        
        // Schedule another run
        await supabase.functions.invoke('refresh-asin-performance', {
          body: { config, auditLogId }
        })

        break
      }
    }

    // If completed, clean up checkpoint
    if (rowsProcessed === rows.length) {
      await supabase
        .from('sqp.refresh_checkpoints')
        .update({ status: 'completed' })
        .eq('function_name', 'refresh-asin-performance')
        .eq('table_name', config.table_name)
        .eq('status', 'active')
    }

    // Update audit log
    await supabase
      .from('sqp.refresh_audit_log')
      .update({
        status: rowsProcessed === rows.length ? 'success' : 'running',
        rows_processed: rowsProcessed,
        rows_inserted: rowsInserted,
        rows_updated: rowsUpdated,
        execution_time_ms: Date.now() - startTime,
        refresh_completed_at: rowsProcessed === rows.length ? new Date().toISOString() : null
      })
      .eq('id', auditLogId)

    return new Response(
      JSON.stringify({
        success: true,
        rowsProcessed,
        rowsInserted,
        rowsUpdated,
        completed: rowsProcessed === rows.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Refresh error:', error)
    
    // Update audit log with error
    await supabase
      .from('sqp.refresh_audit_log')
      .update({
        status: 'failed',
        error_message: error.message,
        error_details: { stack: error.stack },
        execution_time_ms: Date.now() - startTime,
        refresh_completed_at: new Date().toISOString()
      })
      .eq('id', auditLogId)

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function transformAsinPerformanceRow(row: any): any {
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
```

## Worker Function: refresh-search-queries

```typescript
// supabase/functions/refresh-search-queries/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { BigQuery } from "https://esm.sh/@google-cloud/bigquery@7"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { config, auditLogId } = await req.json()
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Initialize BigQuery
  const bigqueryCredentials = JSON.parse(Deno.env.get('GOOGLE_APPLICATION_CREDENTIALS_JSON') ?? '{}')
  const bigquery = new BigQuery({
    projectId: bigqueryCredentials.project_id,
    credentials: bigqueryCredentials
  })

  const startTime = Date.now()
  let rowsProcessed = 0

  try {
    // Check for checkpoint
    const { data: checkpoint } = await supabase
      .from('sqp.refresh_checkpoints')
      .select('*')
      .eq('function_name', 'refresh-search-queries')
      .eq('table_name', config.table_name)
      .eq('status', 'active')
      .single()

    let offset = checkpoint?.last_processed_row || 0

    // Query BigQuery with pagination
    const query = `
      SELECT *
      FROM \`${Deno.env.get('BIGQUERY_PROJECT_ID')}.${Deno.env.get('BIGQUERY_DATASET')}.search_queries_view\`
      ORDER BY start_date, asin, search_query
      LIMIT 3000 OFFSET ${offset}
    `

    const [rows] = await bigquery.query({
      query,
      useLegacySql: false
    })

    console.log(`Retrieved ${rows.length} search query rows from BigQuery`)

    if (rows.length === 0) {
      // No more data, mark as completed
      await supabase
        .from('sqp.refresh_checkpoints')
        .update({ status: 'completed' })
        .eq('function_name', 'refresh-search-queries')
        .eq('table_name', config.table_name)
        .eq('status', 'active')

      await supabase
        .from('sqp.refresh_audit_log')
        .update({
          status: 'success',
          rows_processed: rowsProcessed,
          execution_time_ms: Date.now() - startTime,
          refresh_completed_at: new Date().toISOString()
        })
        .eq('id', auditLogId)

      return new Response(
        JSON.stringify({ success: true, completed: true, rowsProcessed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process in smaller batches due to larger record size
    const batchSize = 200
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      
      // Transform and upsert data
      const transformedData = batch.map(transformSearchQueryRow)
      
      const { error } = await supabase
        .from('sqp.search_query_performance')
        .upsert(transformedData, {
          onConflict: 'start_date,end_date,asin,search_query',
          ignoreDuplicates: false
        })

      if (error) throw error

      rowsProcessed += batch.length

      // Update checkpoint
      await supabase
        .from('sqp.refresh_checkpoints')
        .upsert({
          function_name: 'refresh-search-queries',
          table_schema: config.table_schema,
          table_name: config.table_name,
          last_processed_row: offset + i + batch.length,
          total_rows: null, // Unknown for paginated queries
          status: 'active',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'function_name,table_schema,table_name,status'
        })

      // Check execution time limit
      if (Date.now() - startTime > 4 * 60 * 1000) {
        console.log('Approaching time limit, scheduling continuation...')
        
        // Schedule another run
        await supabase.functions.invoke('refresh-search-queries', {
          body: { config, auditLogId }
        })

        break
      }
    }

    // Update audit log
    await supabase
      .from('sqp.refresh_audit_log')
      .update({
        status: 'running',
        rows_processed: rowsProcessed,
        execution_time_ms: Date.now() - startTime
      })
      .eq('id', auditLogId)

    return new Response(
      JSON.stringify({
        success: true,
        rowsProcessed,
        completed: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Search queries refresh error:', error)
    
    await supabase
      .from('sqp.refresh_audit_log')
      .update({
        status: 'failed',
        error_message: error.message,
        execution_time_ms: Date.now() - startTime,
        refresh_completed_at: new Date().toISOString()
      })
      .eq('id', auditLogId)

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

function transformSearchQueryRow(row: any): any {
  return {
    start_date: row.start_date?.value || row.start_date,
    end_date: row.end_date?.value || row.end_date,
    asin: row.asin,
    search_query: row.search_query,
    impressions: row.impressions,
    clicks: row.clicks,
    cart_adds: row.cart_adds,
    purchases: row.purchases,
    units_sold: row.units_sold,
    sales: row.sales,
    ctr: row.ctr,
    cart_add_rate: row.cart_add_rate,
    purchase_rate: row.purchase_rate,
    units_sold_per_order: row.units_sold_per_order,
    sales_per_order: row.sales_per_order,
    market_impressions: row.market_impressions,
    market_clicks: row.market_clicks,
    market_cart_adds: row.market_cart_adds,
    market_purchases: row.market_purchases,
    impression_share: row.impression_share,
    click_share: row.click_share,
    cart_add_share: row.cart_add_share,
    purchase_share: row.purchase_share,
    median_price_impressions: row.median_price_impressions,
    median_price_clicks: row.median_price_clicks,
    median_price_cart_adds: row.median_price_cart_adds,
    median_price_purchases: row.median_price_purchases
  }
}
```

## Summary Tables Refresh Function

```typescript
// supabase/functions/refresh-summary-tables/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { config, auditLogId } = await req.json()
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const startTime = Date.now()

  try {
    console.log(`Refreshing summary table: ${config.table_name}`)

    // Execute the refresh query based on table type
    let refreshQuery = ''
    
    switch (config.table_name) {
      case 'weekly_summary':
        refreshQuery = `REFRESH MATERIALIZED VIEW sqp.weekly_summary`
        break
      case 'monthly_summary':
        refreshQuery = `REFRESH MATERIALIZED VIEW sqp.monthly_summary`
        break
      case 'quarterly_summary':
        refreshQuery = `REFRESH MATERIALIZED VIEW sqp.quarterly_summary`
        break
      case 'yearly_summary':
        refreshQuery = `REFRESH MATERIALIZED VIEW sqp.yearly_summary`
        break
      case 'search_performance_summary':
        refreshQuery = `REFRESH MATERIALIZED VIEW public.search_performance_summary`
        break
      default:
        throw new Error(`Unknown summary table: ${config.table_name}`)
    }

    // Execute refresh
    const { error } = await supabase.rpc('execute_sql', { sql: refreshQuery })
    
    if (error) throw error

    console.log(`Successfully refreshed ${config.table_name}`)

    // Update audit log
    await supabase
      .from('sqp.refresh_audit_log')
      .update({
        status: 'success',
        execution_time_ms: Date.now() - startTime,
        refresh_completed_at: new Date().toISOString(),
        notes: `Materialized view refreshed successfully`
      })
      .eq('id', auditLogId)

    return new Response(
      JSON.stringify({
        success: true,
        tableName: config.table_name,
        executionTime: Date.now() - startTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error(`Summary table refresh error for ${config.table_name}:`, error)
    
    await supabase
      .from('sqp.refresh_audit_log')
      .update({
        status: 'failed',
        error_message: error.message,
        execution_time_ms: Date.now() - startTime,
        refresh_completed_at: new Date().toISOString()
      })
      .eq('id', auditLogId)

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
```

## Scheduling Configuration

```typescript
// supabase/functions/_shared/cron-config.ts
export const CRON_SCHEDULES = {
  'daily-refresh-orchestrator': '0 2 * * *',  // 2 AM UTC daily
  'cleanup-expired-checkpoints': '0 * * * *', // Every hour
  'refresh-materialized-views': '0 3 * * *'   // 3 AM UTC daily
}

export const FUNCTION_TIMEOUTS = {
  'daily-refresh-orchestrator': 300000,  // 5 minutes
  'refresh-asin-performance': 300000,    // 5 minutes
  'refresh-search-queries': 300000,      // 5 minutes
  'refresh-summary-tables': 60000        // 1 minute
}
```

## Error Handling Utilities

```typescript
// supabase/functions/_shared/error-handler.ts
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: {
    functionName: string,
    supabase: any,
    auditLogId?: number
  }
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    console.error(`${context.functionName} error:`, error)
    
    if (context.auditLogId) {
      await context.supabase
        .from('sqp.refresh_audit_log')
        .update({
          status: 'failed',
          error_message: error.message,
          error_details: { 
            stack: error.stack,
            function: context.functionName 
          },
          refresh_completed_at: new Date().toISOString()
        })
        .eq('id', context.auditLogId)
    }
    
    throw error
  }
}

export function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing required Supabase environment variables')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

export function createBigQueryClient() {
  const credentials = Deno.env.get('GOOGLE_APPLICATION_CREDENTIALS_JSON')
  
  if (!credentials) {
    throw new Error('Missing BigQuery credentials')
  }
  
  const parsedCredentials = JSON.parse(credentials)
  
  return new BigQuery({
    projectId: parsedCredentials.project_id,
    credentials: parsedCredentials
  })
}
```

## Checkpoint Management

```typescript
// supabase/functions/_shared/checkpoint-manager.ts
export interface CheckpointData {
  last_processed_date?: string
  last_processed_row?: number
  batch_number?: number
  total_batches?: number
}

export class CheckpointManager {
  constructor(private supabase: any, private functionName: string) {}

  async getCheckpoint(tableName: string): Promise<CheckpointData | null> {
    const { data } = await this.supabase
      .from('sqp.refresh_checkpoints')
      .select('*')
      .eq('function_name', this.functionName)
      .eq('table_name', tableName)
      .eq('status', 'active')
      .single()

    return data?.checkpoint_data || null
  }

  async updateCheckpoint(
    tableName: string, 
    checkpointData: CheckpointData,
    lastProcessedRow?: number
  ): Promise<void> {
    await this.supabase
      .from('sqp.refresh_checkpoints')
      .upsert({
        function_name: this.functionName,
        table_schema: 'sqp',
        table_name: tableName,
        checkpoint_data: checkpointData,
        last_processed_row: lastProcessedRow,
        status: 'active',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'function_name,table_schema,table_name,status'
      })
  }

  async completeCheckpoint(tableName: string): Promise<void> {
    await this.supabase
      .from('sqp.refresh_checkpoints')
      .update({ status: 'completed' })
      .eq('function_name', this.functionName)
      .eq('table_name', tableName)
      .eq('status', 'active')
  }
}
```

## Deployment Configuration

```typescript
// supabase/functions/_shared/deployment.ts
export const EDGE_FUNCTION_CONFIG = {
  'daily-refresh-orchestrator': {
    timeout: 300,
    memory: 256,
    maxConcurrency: 1
  },
  'refresh-asin-performance': {
    timeout: 300,
    memory: 512,
    maxConcurrency: 2
  },
  'refresh-search-queries': {
    timeout: 300,
    memory: 512,
    maxConcurrency: 2
  },
  'refresh-summary-tables': {
    timeout: 60,
    memory: 256,
    maxConcurrency: 5
  }
}

// Environment variables required for all functions
export const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS_JSON',
  'BIGQUERY_PROJECT_ID',
  'BIGQUERY_DATASET'
]
```