import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const asin = searchParams.get('asin')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Validate required parameters
    if (!asin) {
      return NextResponse.json({ error: 'ASIN parameter is required' }, { status: 400 })
    }

    const supabase = createClient()

    // Build query
    let query = supabase
      .from('search_query_performance')
      .select('search_query, asin_impression_count')
      .eq('asin', asin)
      .gt('asin_impression_count', 0)
      .order('asin_impression_count', { ascending: false })

    // Apply date filters if provided
    if (startDate && endDate) {
      query = query
        .gte('start_date', startDate)
        .lte('start_date', endDate)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching keywords:', error)
      return NextResponse.json({ error: 'Failed to fetch keywords' }, { status: 500 })
    }

    // Aggregate keywords and their total impressions
    const keywordMap = new Map<string, number>()
    
    if (data) {
      data.forEach((row: any) => {
        const keyword = row.search_query
        const impressions = row.asin_impression_count || 0
        keywordMap.set(keyword, (keywordMap.get(keyword) || 0) + impressions)
      })
    }

    // Sort by impressions and get top 100
    const sortedKeywords = Array.from(keywordMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([keyword, impressions]) => ({
        keyword,
        impressions
      }))

    return NextResponse.json({
      keywords: sortedKeywords,
      totalCount: keywordMap.size
    })
  } catch (error) {
    console.error('Error in asin-keywords API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}