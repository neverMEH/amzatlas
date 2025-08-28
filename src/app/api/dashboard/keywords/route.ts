import { NextRequest, NextResponse } from 'next/server'
import { sqpSupabaseService } from '@/services/dashboard/sqp-supabase-service'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const type = searchParams.get('type') || 'top'
    
    let keywords
    switch (type) {
      case 'zero-purchase':
        keywords = await sqpSupabaseService.getZeroPurchaseKeywords(limit)
        break
      case 'rising':
        keywords = await sqpSupabaseService.getRisingKeywords(limit)
        break
      case 'negative-roi':
        keywords = await sqpSupabaseService.getNegativeROIKeywords(limit)
        break
      case 'top':
      default:
        keywords = await sqpSupabaseService.getTopKeywords(limit)
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