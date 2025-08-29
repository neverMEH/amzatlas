import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const searchParams = request.nextUrl.searchParams
    
    const brandId = searchParams.get('brandId')
    const asin = searchParams.get('asin')
    const searchQuery = searchParams.get('searchQuery')
    const windowSize = parseInt(searchParams.get('windowSize') || '6')
    const weeks = parseInt(searchParams.get('weeks') || '12')

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - (weeks * 7))

    // Build query for the materialized view
    let query = supabase
      .from('keyword_rolling_averages')
      .select('*')
      .gte('week_start', startDate.toISOString())
      .lte('week_start', endDate.toISOString())
      .order('week_start', { ascending: true })

    if (brandId) {
      query = query.eq('brand_id', brandId)
    }
    if (asin) {
      query = query.eq('asin', asin)
    }
    if (searchQuery) {
      query = query.eq('search_query', searchQuery)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching rolling averages:', error)
      return NextResponse.json(
        { error: 'Failed to fetch rolling averages' },
        { status: 500 }
      )
    }

    // Group data by search query for analysis
    const queryGroups = new Map()
    
    data?.forEach((row: any) => {
      const key = `${row.asin}::${row.search_query}`
      if (!queryGroups.has(key)) {
        queryGroups.set(key, {
          asin: row.asin,
          brandId: row.brand_id,
          searchQuery: row.search_query,
          dataPoints: []
        })
      }
      
      queryGroups.get(key).dataPoints.push({
        weekStart: row.week_start,
        impressions: row.impressions,
        clicks: row.clicks,
        cartAdds: row.cart_adds,
        purchases: row.purchases,
        ctr: row.ctr,
        cartAddRate: row.cart_add_rate,
        cvr: row.cvr,
        rollingAvgImpressions: row.rolling_avg_impressions,
        rollingAvgClicks: row.rolling_avg_clicks,
        rollingAvgPurchases: row.rolling_avg_purchases,
        rollingAvgCtr: row.rolling_avg_ctr,
        rollingAvgCvr: row.rolling_avg_cvr,
        impressionsTrend: row.impressions_trend,
        clicksTrend: row.clicks_trend,
        purchasesTrend: row.purchases_trend
      })
    })

    // Analyze each query group
    const analyzedData = Array.from(queryGroups.values()).map((group: any) => {
      const recentData = group.dataPoints.slice(-4)
      const allData = group.dataPoints
      
      // Calculate recent performance vs rolling average
      const recentPerformance = recentData.reduce((acc: any, point: any) => ({
        avgImpressions: acc.avgImpressions + point.impressions / recentData.length,
        avgRollingImpressions: acc.avgRollingImpressions + point.rollingAvgImpressions / recentData.length,
        avgCvr: acc.avgCvr + point.cvr / recentData.length,
        avgRollingCvr: acc.avgRollingCvr + point.rollingAvgCvr / recentData.length
      }), {
        avgImpressions: 0,
        avgRollingImpressions: 0,
        avgCvr: 0,
        avgRollingCvr: 0
      })

      // Determine trend direction from regression slopes
      const latestTrend = recentData[recentData.length - 1] || {}
      const trendDirection = 
        latestTrend.impressionsTrend > 0 ? 'increasing' :
        latestTrend.impressionsTrend < 0 ? 'decreasing' :
        'stable'

      // Calculate momentum (recent vs average)
      const momentum = recentPerformance.avgRollingImpressions > 0
        ? ((recentPerformance.avgImpressions - recentPerformance.avgRollingImpressions) / recentPerformance.avgRollingImpressions) * 100
        : 0

      return {
        ...group,
        analysis: {
          trendDirection,
          momentum,
          recentVsAverage: {
            impressions: recentPerformance.avgImpressions - recentPerformance.avgRollingImpressions,
            impressionsPercent: momentum,
            cvr: recentPerformance.avgCvr - recentPerformance.avgRollingCvr,
            cvrPercent: recentPerformance.avgRollingCvr > 0
              ? ((recentPerformance.avgCvr - recentPerformance.avgRollingCvr) / recentPerformance.avgRollingCvr) * 100
              : 0
          },
          latestMetrics: latestTrend,
          volatility: calculateVolatility(allData.map((d: any) => d.impressions))
        }
      }
    })

    // Sort by absolute momentum (biggest movers)
    analyzedData.sort((a: any, b: any) => Math.abs(b.analysis.momentum) - Math.abs(a.analysis.momentum))

    return NextResponse.json({
      filters: {
        brandId,
        asin,
        searchQuery,
        windowSize,
        weeks
      },
      summary: {
        totalQueries: analyzedData.length,
        increasing: analyzedData.filter((d: any) => d.analysis.trendDirection === 'increasing').length,
        decreasing: analyzedData.filter((d: any) => d.analysis.trendDirection === 'decreasing').length,
        stable: analyzedData.filter((d: any) => d.analysis.trendDirection === 'stable').length,
        highMomentum: analyzedData.filter((d: any) => Math.abs(d.analysis.momentum) > 20).length
      },
      data: analyzedData
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function calculateVolatility(values: number[]): number {
  if (values.length < 2) return 0
  
  const mean = values.reduce((sum: number, val: number) => sum + val, 0) / values.length
  const variance = values.reduce((sum: number, val: number) => sum + Math.pow(val - mean, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)
  
  return mean > 0 ? (stdDev / mean) : 0
}