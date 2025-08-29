import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const searchParams = request.nextUrl.searchParams
    
    // Parameters
    const comparisonType = searchParams.get('type') || 'week'
    const brandId = searchParams.get('brandId')
    const asin = searchParams.get('asin')
    const searchQuery = searchParams.get('searchQuery')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Validate comparison type
    const validTypes = ['week', 'month', 'quarter', 'year']
    if (!validTypes.includes(comparisonType)) {
      return NextResponse.json(
        { error: 'Invalid comparison type. Must be one of: week, month, quarter, year' },
        { status: 400 }
      )
    }

    // For now, use search_query_performance table directly
    // TODO: Implement proper period comparison views
    const { data: performanceData, error } = await supabase
      .from('search_query_performance')
      .select(`
        *,
        asin_brand_mapping:asin_performance_data!inner(
          asin_brand_mapping!inner(
            brand_id
          )
        )
      `)
      .order('impressions_sum', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching period comparison:', error)
      return NextResponse.json(
        { error: 'Failed to fetch period comparison data' },
        { status: 500 }
      )
    }

    // Transform data to include change metrics (placeholder for now)
    const data = performanceData || []
    const transformedData = data.map((item: any) => ({
      ...item,
      impressions_change_pct: 0,
      cvr_change_pct: 0,
      revenue_change_pct: 0,
      previous_impressions: item.impressions_sum,
      current_impressions: item.impressions_sum,
      previous_cvr: 0,
      current_cvr: 0,
      previous_revenue: 0,
      current_revenue: 0
    }))

    // Calculate summary statistics
    const summary = {
      totalRecords: transformedData.length,
      avgImpressionChange: 0,
      avgCvrChange: 0,
      avgRevenueChange: 0,
      improvedCount: 0,
      declinedCount: 0,
      stableCount: 0
    }

    return NextResponse.json({
      comparisonType,
      filters: {
        brandId,
        asin,
        searchQuery
      },
      pagination: {
        limit,
        offset,
        total: transformedData.length,
        hasMore: false
      },
      summary,
      data: transformedData
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}