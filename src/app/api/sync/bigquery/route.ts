import { NextRequest, NextResponse } from 'next/server'
import { BigQuerySyncService } from '@/services/bigquery-sync/sync-service'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfig } from '@/config/supabase.config'

// This runs in Node.js environment where BigQuery client works properly
export async function POST(request: NextRequest) {
  try {
    // Verify authorization - check for service role key in Bearer token
    const authHeader = request.headers.get('authorization')
    const supabaseConfig = getSupabaseConfig()
    const expectedToken = supabaseConfig.serviceRoleKey
    
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.substring(7) !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      tableName, 
      tableSchema = 'sqp',
      options = {}
    } = body

    if (!tableName) {
      return NextResponse.json({ error: 'tableName is required' }, { status: 400 })
    }

    console.log(`Starting BigQuery sync for ${tableSchema}.${tableName}`)

    // Initialize sync service
    const syncService = new BigQuerySyncService()
    
    // Perform sync
    const result = await syncService.syncTable(tableName, {
      ...options,
      tableSchema
    })

    if (!result.success) {
      return NextResponse.json(
        { 
          error: 'Sync failed',
          details: result.error,
          table: result.table,
          duration: result.duration
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${result.rowsProcessed} rows`,
      table: result.table,
      rowsProcessed: result.rowsProcessed,
      duration: result.duration
    })

  } catch (error) {
    console.error('BigQuery sync error:', error)
    return NextResponse.json(
      { 
        error: 'Sync failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check sync status
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'BigQuery sync endpoint is available',
    usage: 'POST to this endpoint with { tableName: "table_name" } to sync data'
  })
}