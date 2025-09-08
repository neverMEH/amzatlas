import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { runDailySync } from '@/scripts/daily-sync'

// This endpoint can be called by Railway cron or external services
export async function GET(request: Request) {
  try {
    // Get headers
    const headersList = headers()
    const authHeader = headersList.get('authorization')
    
    // Verify authorization (optional - remove if using Railway internal cron)
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    console.log('Starting cron-triggered sync...')
    
    // Run the sync
    const result = await runDailySync()
    
    return NextResponse.json({
      success: true,
      message: 'Daily sync completed',
      stats: {
        duration: `${(result.endTime - result.startTime) / 1000}s`,
        parentRecordsInserted: result.parentRecordsInserted,
        searchQueriesInserted: result.searchQueriesInserted,
        totalRows: result.totalRows,
        errors: result.errors
      }
    })
    
  } catch (error: any) {
    console.error('Cron sync failed:', error)
    
    return NextResponse.json(
      {
        error: 'Sync failed',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Also support POST for flexibility
export async function POST(request: Request) {
  return GET(request)
}