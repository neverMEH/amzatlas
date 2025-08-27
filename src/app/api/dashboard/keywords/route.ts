import { NextRequest, NextResponse } from 'next/server'
import { sqpDataService } from '@/services/dashboard/sqp-data-service'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const type = searchParams.get('type') || 'top'
    
    let keywords
    switch (type) {
      case 'zero-purchase':
        keywords = await sqpDataService.getZeroPurchaseKeywords(limit)
        break
      case 'rising':
        keywords = await sqpDataService.getRisingKeywords(limit)
        break
      case 'negative-roi':
        keywords = await sqpDataService.getNegativeROIKeywords(limit)
        break
      case 'top':
      default:
        keywords = await sqpDataService.getTopKeywords(limit)
        break
    }
    
    return NextResponse.json(keywords)
  } catch (error) {
    console.error('Error fetching keywords:', error)
    return NextResponse.json(
      { error: 'Failed to fetch keywords' },
      { status: 500 }
    )
  }
}