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

    // Use RPC function to get period comparison data
    const { data, error } = await supabase.rpc('get_period_comparison', {
      p_comparison_type: comparisonType,
      p_brand_id: brandId,
      p_asin: asin,
      p_search_query: searchQuery,
      p_limit: limit,
      p_offset: offset
    })

    if (error) {
      console.error('Error fetching period comparison:', error)
      
      // Fallback: Return empty data structure
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
          total: 0,
          hasMore: false
        },
        summary: {
          totalRecords: 0,
          avgImpressionChange: 0,
          avgCvrChange: 0,
          avgRevenueChange: 0,
          improvedCount: 0,
          declinedCount: 0,
          stableCount: 0
        },
        data: []
      })
    }

    // Process the data
    const results = data || []
    
    // Calculate summary statistics
    const summary = {
      totalRecords: results.length,
      avgImpressionChange: 0,
      avgCvrChange: 0,
      avgRevenueChange: 0,
      improvedCount: 0,
      declinedCount: 0,
      stableCount: 0
    }

    if (results.length > 0) {
      const validData = results.filter((d: any) => d.impressions_change_pct !== null)
      
      if (validData.length > 0) {
        summary.avgImpressionChange = validData.reduce((sum: number, d: any) => sum + (d.impressions_change_pct || 0), 0) / validData.length
        summary.avgCvrChange = validData.reduce((sum: number, d: any) => sum + (d.cvr_change_pct || 0), 0) / validData.length
        summary.avgRevenueChange = validData.reduce((sum: number, d: any) => sum + (d.revenue_change_pct || 0), 0) / validData.length
        
        summary.improvedCount = validData.filter((d: any) => d.impressions_change_pct > 5).length
        summary.declinedCount = validData.filter((d: any) => d.impressions_change_pct < -5).length
        summary.stableCount = validData.filter((d: any) => Math.abs(d.impressions_change_pct) <= 5).length
      }
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
        total: results.length,
        hasMore: results.length === limit
      },
      summary,
      data: results
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}