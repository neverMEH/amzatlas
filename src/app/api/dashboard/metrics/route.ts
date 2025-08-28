import { NextRequest, NextResponse } from 'next/server'
import { sqpSupabaseService } from '@/services/dashboard/sqp-supabase-service'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    
    if (!start || !end) {
      return NextResponse.json(
        { error: 'Missing date range parameters' },
        { status: 400 }
      )
    }
    
    const dateRange = {
      start: new Date(start),
      end: new Date(end),
    }
    
    const metrics = await sqpSupabaseService.getPurchaseMetrics(dateRange)
    
    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error fetching metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}