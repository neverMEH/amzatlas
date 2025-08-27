import { NextRequest, NextResponse } from 'next/server'
import { sqpSupabaseService } from '@/services/dashboard/sqp-supabase-service'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const weeks = parseInt(searchParams.get('weeks') || '12', 10)
    
    const trends = await sqpSupabaseService.getPurchaseTrends(weeks)
    
    return NextResponse.json(trends)
  } catch (error) {
    console.error('Error fetching trends:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trends' },
      { status: 500 }
    )
  }
}