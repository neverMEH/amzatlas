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

    // Map comparison type to view name
    const viewMap: Record<string, string> = {
      'week': 'week_over_week_comparison',
      'month': 'month_over_month_comparison',
      'quarter': 'quarter_over_quarter_comparison',
      'year': 'year_over_year_comparison'
    }

    const viewName = viewMap[comparisonType]

    // Build query
    let query = supabase
      .from(viewName)
      .select('*', { count: 'exact' })

    // Apply filters
    if (brandId) {
      query = query.eq('brand_id', brandId)
    }
    if (asin) {
      query = query.eq('asin', asin)
    }
    if (searchQuery) {
      query = query.ilike('search_query', `%${searchQuery}%`)
    }

    // Order by absolute change to show most significant changes
    query = query
      .order('abs(impressions_change_pct)', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching period comparison:', error)
      return NextResponse.json(
        { error: 'Failed to fetch period comparison data' },
        { status: 500 }
      )
    }

    // Calculate summary statistics
    const summary = {
      totalRecords: count || 0,
      avgImpressionChange: 0,
      avgCvrChange: 0,
      avgRevenueChange: 0,
      improvedCount: 0,
      declinedCount: 0,
      stableCount: 0
    }

    if (data && data.length > 0) {
      const validData = data.filter(d => d.impressions_change_pct !== null)
      
      summary.avgImpressionChange = validData.reduce((sum, d) => sum + (d.impressions_change_pct || 0), 0) / validData.length
      summary.avgCvrChange = validData.reduce((sum, d) => sum + (d.cvr_change_pct || 0), 0) / validData.length
      summary.avgRevenueChange = validData.reduce((sum, d) => sum + (d.revenue_change_pct || 0), 0) / validData.length
      
      summary.improvedCount = validData.filter(d => d.impressions_change_pct > 5).length
      summary.declinedCount = validData.filter(d => d.impressions_change_pct < -5).length
      summary.stableCount = validData.filter(d => Math.abs(d.impressions_change_pct) <= 5).length
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
        total: count || 0,
        hasMore: (count || 0) > offset + limit
      },
      summary,
      data: data || []
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}