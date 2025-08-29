import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const searchParams = request.nextUrl.searchParams
    
    const brandId = searchParams.get('brandId')
    const asin = searchParams.get('asin')
    const metric = searchParams.get('metric') || 'impressions'
    const periods = parseInt(searchParams.get('periods') || '12')

    // Validate metric
    const validMetrics = ['impressions', 'clicks', 'purchases', 'revenue', 'cvr', 'ctr']
    if (!validMetrics.includes(metric)) {
      return NextResponse.json(
        { error: 'Invalid metric. Must be one of: impressions, clicks, purchases, revenue, cvr, ctr' },
        { status: 400 }
      )
    }

    // Fetch weekly data for trend analysis
    let query = supabase
      .from('search_query_performance')
      .select(`
        asin,
        start_date,
        end_date,
        impressions_sum,
        clicks_sum,
        cart_adds_sum,
        purchases_sum,
        median_price_purchase,
        asin_brand_mapping!inner(brand_id)
      `)
      .order('start_date', { ascending: false })
      .limit(periods * 7) // Approximate days for the period

    if (brandId) {
      query = query.eq('asin_brand_mapping.brand_id', brandId)
    }
    if (asin) {
      query = query.eq('asin', asin)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching trend data:', error)
      return NextResponse.json(
        { error: 'Failed to fetch trend data' },
        { status: 500 }
      )
    }

    // Group data by week
    const weeklyData = new Map()
    
    data?.forEach(row => {
      const weekStart = new Date(row.start_date)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Start of week
      const weekKey = weekStart.toISOString().split('T')[0]
      
      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, {
          week: weekKey,
          impressions: 0,
          clicks: 0,
          cartAdds: 0,
          purchases: 0,
          revenue: 0
        })
      }
      
      const week = weeklyData.get(weekKey)
      week.impressions += row.impressions_sum || 0
      week.clicks += row.clicks_sum || 0
      week.cartAdds += row.cart_adds_sum || 0
      week.purchases += row.purchases_sum || 0
      week.revenue += (row.purchases_sum || 0) * (row.median_price_purchase || 0)
    })

    // Convert to array and sort
    const sortedWeeks = Array.from(weeklyData.values())
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-periods)

    // Calculate period-over-period changes
    const trends = sortedWeeks.map((week, index) => {
      const prevWeek = index > 0 ? sortedWeeks[index - 1] : null
      
      const ctr = week.impressions > 0 ? (week.clicks / week.impressions) * 100 : 0
      const cvr = week.clicks > 0 ? (week.purchases / week.clicks) * 100 : 0
      
      const metricValues = {
        impressions: week.impressions,
        clicks: week.clicks,
        purchases: week.purchases,
        revenue: week.revenue,
        cvr,
        ctr
      }
      
      const currentValue = metricValues[metric]
      let changePercent = null
      let changeAbsolute = null
      
      if (prevWeek) {
        const prevCtr = prevWeek.impressions > 0 ? (prevWeek.clicks / prevWeek.impressions) * 100 : 0
        const prevCvr = prevWeek.clicks > 0 ? (prevWeek.purchases / prevWeek.clicks) * 100 : 0
        
        const prevMetricValues = {
          impressions: prevWeek.impressions,
          clicks: prevWeek.clicks,
          purchases: prevWeek.purchases,
          revenue: prevWeek.revenue,
          cvr: prevCvr,
          ctr: prevCtr
        }
        
        const prevValue = prevMetricValues[metric]
        
        if (prevValue > 0) {
          changePercent = ((currentValue - prevValue) / prevValue) * 100
          changeAbsolute = currentValue - prevValue
        }
      }
      
      return {
        period: week.week,
        value: currentValue,
        changePercent,
        changeAbsolute,
        ...week,
        ctr,
        cvr
      }
    })

    // Calculate moving averages
    const movingAvgWindow = 4
    const trendsWithMA = trends.map((trend, index) => {
      if (index < movingAvgWindow - 1) {
        return { ...trend, movingAverage: null }
      }
      
      const windowValues = trends
        .slice(index - movingAvgWindow + 1, index + 1)
        .map(t => t.value)
      
      const movingAverage = windowValues.reduce((sum, val) => sum + val, 0) / windowValues.length
      
      return { ...trend, movingAverage }
    })

    // Calculate overall trend direction
    const recentTrends = trends.slice(-6)
    const avgRecentChange = recentTrends
      .filter(t => t.changePercent !== null)
      .reduce((sum, t) => sum + t.changePercent!, 0) / recentTrends.length

    const trendDirection = 
      avgRecentChange > 5 ? 'growing' :
      avgRecentChange < -5 ? 'declining' :
      'stable'

    return NextResponse.json({
      metric,
      periods: trends.length,
      trendDirection,
      avgChange: avgRecentChange,
      data: trendsWithMA
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}