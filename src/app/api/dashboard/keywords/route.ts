import { NextRequest, NextResponse } from 'next/server'
import { sqpDataService } from '@/services/dashboard/sqp-data-service'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    
    const keywords = await sqpDataService.getTopKeywords(limit)
    
    return NextResponse.json(keywords)
  } catch (error) {
    console.error('Error fetching keywords:', error)
    return NextResponse.json(
      { error: 'Failed to fetch keywords' },
      { status: 500 }
    )
  }
}