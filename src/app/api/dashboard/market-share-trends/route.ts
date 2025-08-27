import { NextRequest, NextResponse } from 'next/server'
import { sqpDataService } from '@/services/dashboard/sqp-data-service'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const weeks = parseInt(searchParams.get('weeks') || '12', 10)
    
    const trends = await sqpDataService.getMarketShareTrends(weeks)
    
    return NextResponse.json(trends)
  } catch (error) {
    console.error('Error fetching market share trends:', error)
    return NextResponse.json(
      { error: 'Failed to fetch market share trends' },
      { status: 500 }
    )
  }
}