import { NextRequest, NextResponse } from 'next/server'
import { sqpDataService } from '@/services/dashboard/sqp-data-service'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const weeks = parseInt(searchParams.get('weeks') || '12', 10)
    
    const trends = await sqpDataService.getROITrends(weeks)
    
    return NextResponse.json(trends)
  } catch (error) {
    console.error('Error fetching ROI trends:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ROI trends' },
      { status: 500 }
    )
  }
}