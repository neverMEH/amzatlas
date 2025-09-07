import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const asin = searchParams.get('asin')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const includeMetrics = searchParams.get('includeMetrics') === 'true'

    // Validate required parameters
    if (!asin) {
      return NextResponse.json({ error: 'ASIN parameter is required' }, { status: 400 })
    }

    const supabase = createClient()

    // Build query - include metrics if requested
    const selectFields = includeMetrics 
      ? `search_query,
         asin_impression_count,
         asin_click_count,
         asin_cart_add_count,
         asin_purchase_count,
         total_query_impression_count,
         total_purchase_count`
      : 'search_query, asin_impression_count'

    let query = supabase
      .from('search_query_performance')
      .select(selectFields)
      .eq('asin', asin)
      .gt('asin_impression_count', 0)

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

    if (includeMetrics) {
      // Aggregate metrics by keyword when includeMetrics is true
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
            cartAdds: existing.cartAdds + (row.asin_cart_add_count || 0),
            purchases: existing.purchases + (row.asin_purchase_count || 0),
            totalPurchases: existing.totalPurchases + (row.total_purchase_count || 0)
          })
        })
      }

      // Calculate KPIs and format response
      const keywords = Array.from(keywordMetrics.entries())
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
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 200)

      return NextResponse.json({
        keywords,
        totalKeywords: keywordMetrics.size,
        dateRange: { start: startDate, end: endDate }
      })
    } else {
      // Original response format for backward compatibility
      const keywordMap = new Map<string, number>()
      
      if (data) {
        data.forEach((row: any) => {
          const keyword = row.search_query
          const impressions = row.asin_impression_count || 0
          keywordMap.set(keyword, (keywordMap.get(keyword) || 0) + impressions)
        })
      }

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
    }
  } catch (error) {
    console.error('Error in asin-keywords API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}