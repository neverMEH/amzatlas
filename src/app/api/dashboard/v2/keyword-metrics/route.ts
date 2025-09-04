import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface KeywordKPI {
  keyword: string
  impressions: number
  clicks: number
  cartAdds: number
  purchases: number
  ctr: number
  cvr: number
  cartAddRate: number
  purchaseShare: number
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const asin = searchParams.get('asin')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Validate required parameters
    if (!asin || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'ASIN, startDate, and endDate parameters are required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Query for keyword performance metrics
    const { data, error } = await supabase
      .from('search_query_performance')
      .select(`
        search_query,
        asin_impression_count,
        asin_click_count,
        asin_add_to_cart_count,
        asin_purchase_count,
        total_impression_count,
        total_purchase_count
      `)
      .eq('asin', asin)
      .gte('start_date', startDate)
      .lte('start_date', endDate)
      .gt('asin_impression_count', 0)

    if (error) {
      console.error('Error fetching keyword metrics:', error)
      return NextResponse.json({ error: 'Failed to fetch keyword metrics' }, { status: 500 })
    }

    // Aggregate metrics by keyword
    const keywordMetrics = new Map<string, {
      impressions: number
      clicks: number
      cartAdds: number
      purchases: number
      totalPurchases: number
    }>()

    if (data) {
      data.forEach((row: any) => {
        const keyword = row.search_query
        const existing = keywordMetrics.get(keyword) || {
          impressions: 0,
          clicks: 0,
          cartAdds: 0,
          purchases: 0,
          totalPurchases: 0
        }

        keywordMetrics.set(keyword, {
          impressions: existing.impressions + (row.asin_impression_count || 0),
          clicks: existing.clicks + (row.asin_click_count || 0),
          cartAdds: existing.cartAdds + (row.asin_add_to_cart_count || 0),
          purchases: existing.purchases + (row.asin_purchase_count || 0),
          totalPurchases: existing.totalPurchases + (row.total_purchase_count || 0)
        })
      })
    }

    // Calculate KPIs and format response
    const keywords: KeywordKPI[] = Array.from(keywordMetrics.entries())
      .map(([keyword, metrics]) => ({
        keyword,
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        cartAdds: metrics.cartAdds,
        purchases: metrics.purchases,
        ctr: metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0,
        cvr: metrics.clicks > 0 ? (metrics.purchases / metrics.clicks) * 100 : 0,
        cartAddRate: metrics.clicks > 0 ? (metrics.cartAdds / metrics.clicks) * 100 : 0,
        purchaseShare: metrics.totalPurchases > 0 ? (metrics.purchases / metrics.totalPurchases) * 100 : 0
      }))
      .sort((a, b) => b.impressions - a.impressions) // Sort by impressions by default
      .slice(0, 200) // Return top 200 keywords

    return NextResponse.json({
      keywords,
      totalKeywords: keywordMetrics.size,
      dateRange: { start: startDate, end: endDate }
    })
  } catch (error) {
    console.error('Error in keyword-metrics API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}