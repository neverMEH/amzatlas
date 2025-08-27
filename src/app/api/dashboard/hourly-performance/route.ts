import { NextRequest, NextResponse } from 'next/server'
import { sqpDataService } from '@/services/dashboard/sqp-data-service'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    
    const performance = await sqpDataService.getHourlyPerformance(date)
    
    return NextResponse.json(performance)
  } catch (error) {
    console.error('Error fetching hourly performance:', error)
    return NextResponse.json(
      { error: 'Failed to fetch hourly performance' },
      { status: 500 }
    )
  }
}