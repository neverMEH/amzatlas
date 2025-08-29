import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const searchParams = request.nextUrl.searchParams
    
    const brandId = searchParams.get('brandId')
    const weeks = parseInt(searchParams.get('weeks') || '12')
    const minImpressions = parseInt(searchParams.get('minImpressions') || '100')
    const trendType = searchParams.get('trendType') // emerging, declining, stable, volatile, etc.
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Use the analyze_keyword_trends function
    const { data, error } = await supabase.rpc('analyze_keyword_trends', {
      p_brand_id: brandId || null,
      p_weeks: weeks,
      p_min_impressions: minImpressions
    })

    if (error) {
      console.error('Error analyzing keyword trends:', error)
      return NextResponse.json(
        { error: 'Failed to analyze keyword trends' },
        { status: 500 }
      )
    }

    let filteredData = data || []

    // Filter by trend type if specified
    if (trendType) {
      filteredData = filteredData.filter((d: any) => d.o_trend_classification === trendType)
    }

    // Apply pagination
    const paginatedData = filteredData.slice(offset, offset + limit)

    // Calculate summary statistics
    const summary = {
      totalKeywords: filteredData.length,
      trendDistribution: {} as Record<string, number>,
      avgVolatility: 0,
      avgTrendStrength: 0,
      topPerformers: [] as any[],
      needsAttention: [] as any[]
    }

    // Calculate trend distribution
    filteredData.forEach((item: any) => {
      const trend = item.o_trend_classification
      summary.trendDistribution[trend] = (summary.trendDistribution[trend] || 0) + 1
    })

    // Calculate averages
    if (filteredData.length > 0) {
      summary.avgVolatility = filteredData.reduce((sum: number, d: any) => sum + (d.o_volatility_score || 0), 0) / filteredData.length
      summary.avgTrendStrength = filteredData.reduce((sum: number, d: any) => sum + (d.o_trend_strength || 0), 0) / filteredData.length
      
      // Get top performers (emerging with high impressions)
      summary.topPerformers = filteredData
        .filter((d: any) => d.o_trend_classification === 'emerging' || d.o_trend_classification === 'surging')
        .sort((a: any, b: any) => b.o_current_week_impressions - a.o_current_week_impressions)
        .slice(0, 5)
        .map((d: any) => ({
          asin: d.o_asin,
          searchQuery: d.o_search_query,
          trend: d.o_trend_classification,
          currentImpressions: d.o_current_week_impressions,
          avgImpressions: d.o_avg_weekly_impressions,
          momentum: d.o_momentum_score
        }))

      // Get keywords needing attention (declining/plummeting with high base)
      summary.needsAttention = filteredData
        .filter((d: any) => 
          (d.o_trend_classification === 'declining' || d.o_trend_classification === 'plummeting') &&
          d.o_avg_weekly_impressions > 1000
        )
        .sort((a: any, b: any) => a.o_momentum_score - b.o_momentum_score)
        .slice(0, 5)
        .map((d: any) => ({
          asin: d.o_asin,
          searchQuery: d.o_search_query,
          trend: d.o_trend_classification,
          currentImpressions: d.o_current_week_impressions,
          avgImpressions: d.o_avg_weekly_impressions,
          momentum: d.o_momentum_score,
          weeksOfDecline: Math.floor(Math.abs(d.o_momentum_score) * d.o_weeks_of_data)
        }))
    }

    return NextResponse.json({
      filters: {
        brandId,
        weeks,
        minImpressions,
        trendType
      },
      pagination: {
        limit,
        offset,
        total: filteredData.length,
        hasMore: filteredData.length > offset + limit
      },
      summary,
      data: paginatedData
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}