import { NextRequest, NextResponse } from 'next/server'
import { sqpDataService } from '@/services/dashboard/sqp-data-service'

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
    
    const metrics = await sqpDataService.getPurchaseMetrics(dateRange)
    
    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error fetching metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}