import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createErrorResponse, createSuccessResponse } from '../_shared/utils.ts'

const FUNCTION_TIMEOUT = 540000 // 9 minutes (leaving 1 minute buffer)

serve(async (req) => {
  try {
    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Daily refresh orchestrator starting...')
    const startTime = Date.now()

    // Get tables that need refresh
    const { data: tablesToRefresh, error: configError } = await supabase
      .from('refresh_config')
      .select('*')
      .eq('is_enabled', true)
      .lte('next_refresh_at', new Date().toISOString())
      .order('priority', { ascending: false })

    if (configError) {
      return createErrorResponse('Failed to fetch refresh configs', configError)
    }

    if (!tablesToRefresh || tablesToRefresh.length === 0) {
      console.log('No tables need refresh at this time')
      return createSuccessResponse({ tablesProcessed: 0 }, 'No tables need refresh')
    }

    console.log(`Found ${tablesToRefresh.length} tables to refresh`)

    // Process tables in parallel batches
    const BATCH_SIZE = 3 // Process 3 tables at a time
    const results = []
    
    for (let i = 0; i < tablesToRefresh.length; i += BATCH_SIZE) {
      // Check if we're approaching timeout
      if (Date.now() - startTime > FUNCTION_TIMEOUT) {
        console.log('Approaching timeout, scheduling continuation...')
        // Schedule another run for remaining tables
        await supabase.functions.invoke('daily-refresh-orchestrator')
        break
      }

      const batch = tablesToRefresh.slice(i, i + BATCH_SIZE)
      console.log(`Processing batch ${i / BATCH_SIZE + 1}: ${batch.map(t => t.table_name).join(', ')}`)

      const batchPromises = batch.map(async (config) => {
        try {
          // Create audit log entry
          const { data: auditLog, error: auditError } = await supabase
            .from('refresh_audit_log')
            .insert({
              table_schema: config.table_schema,
              table_name: config.table_name,
              refresh_type: 'scheduled',
              status: 'in_progress',
              refresh_started_at: new Date().toISOString(),
              function_name: config.function_name || 'refresh-generic-table'
            })
            .select()
            .single()

          if (auditError) {
            console.error(`Failed to create audit log for ${config.table_name}:`, auditError)
            return { status: 'rejected', reason: auditError }
          }

          // Invoke specific refresh function
          const functionName = config.function_name || 'refresh-generic-table'
          console.log(`Invoking ${functionName} for ${config.table_name}`)

          const { data, error: invokeError } = await supabase.functions.invoke(functionName, {
            body: { config, auditLogId: auditLog.id }
          })

          if (invokeError) {
            throw invokeError
          }

          // Update next refresh time
          const nextRefreshAt = new Date()
          nextRefreshAt.setHours(nextRefreshAt.getHours() + config.refresh_frequency_hours)

          await supabase
            .from('refresh_config')
            .update({
              last_refresh_at: new Date().toISOString(),
              next_refresh_at: nextRefreshAt.toISOString()
            })
            .eq('id', config.id)

          return { status: 'fulfilled', value: data }
        } catch (error) {
          console.error(`Error refreshing ${config.table_name}:`, error)
          return { status: 'rejected', reason: error.message }
        }
      })

      const batchResults = await Promise.allSettled(batchPromises)
      results.push(...batchResults)
    }

    // Summary
    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    console.log(`Refresh completed: ${successful} successful, ${failed} failed`)

    // Trigger webhook processor to send notifications
    if (successful > 0 || failed > 0) {
      console.log('Triggering webhook processor...')
      await supabase.functions.invoke('webhook-processor').catch(err => 
        console.error('Failed to trigger webhook processor:', err)
      )
    }

    return createSuccessResponse({
      tablesProcessed: results.length,
      successful,
      failed,
      results: results.map(r => r.status)
    })

  } catch (error) {
    console.error('Orchestrator error:', error)
    return createErrorResponse('Orchestrator failed', error.message)
  }
})