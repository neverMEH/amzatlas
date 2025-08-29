import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const searchParams = request.nextUrl.searchParams
    const brandId = searchParams.get('brandId')
    const dateRange = searchParams.get('dateRange') || '30d'
    
    // Calculate date range
    const endDate = new Date()
    let startDate = new Date()
    
    switch (dateRange) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7)
        break
      case '30d':
        startDate.setDate(startDate.getDate() - 30)
        break
      case '90d':
        startDate.setDate(startDate.getDate() - 90)
        break
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1)
        break
      default:
        startDate.setDate(startDate.getDate() - 30)
    }

    // Build query
    let query = supabase
      .from('search_query_performance')
      .select(`
        asin,
        impressions_sum,
        clicks_sum,
        cart_adds_sum,
        purchases_sum,
        median_price_purchase,
        asin_brand_mapping!inner(brand_id)
      `)
      .gte('start_date', startDate.toISOString())
      .lte('end_date', endDate.toISOString())

    if (brandId) {
      query = query.eq('asin_brand_mapping.brand_id', brandId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching brand stats:', error)
      return NextResponse.json(
        { error: 'Failed to fetch brand statistics' },
        { status: 500 }
      )
    }

    // Calculate aggregate statistics
    const stats: any = {
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        label: dateRange
      },
      brandId,
      totals: {
        asins: new Set(data?.map(d => d.asin) || []).size,
        impressions: data?.reduce((sum: number, d: any) => sum + (d.impressions_sum || 0), 0) || 0,
        clicks: data?.reduce((sum: number, d: any) => sum + (d.clicks_sum || 0), 0) || 0,
        cartAdds: data?.reduce((sum: number, d: any) => sum + (d.cart_adds_sum || 0), 0) || 0,
        purchases: data?.reduce((sum: number, d: any) => sum + (d.purchases_sum || 0), 0) || 0,
        revenue: data?.reduce((sum: number, d: any) => sum + ((d.purchases_sum || 0) * (d.median_price_purchase || 0)), 0) || 0
      },
      averages: {
        ctr: 0,
        cartAddRate: 0,
        cartToPurchaseRate: 0,
        cvr: 0,
        revenuePerAsin: 0,
        pricePerPurchase: 0
      }
    }

    // Calculate rates
    if (stats.totals.impressions > 0) {
      stats.averages.ctr = (stats.totals.clicks / stats.totals.impressions) * 100
    }
    if (stats.totals.clicks > 0) {
      stats.averages.cartAddRate = (stats.totals.cartAdds / stats.totals.clicks) * 100
      stats.averages.cvr = (stats.totals.purchases / stats.totals.clicks) * 100
    }
    if (stats.totals.cartAdds > 0) {
      stats.averages.cartToPurchaseRate = (stats.totals.purchases / stats.totals.cartAdds) * 100
    }
    if (stats.totals.asins > 0) {
      stats.averages.revenuePerAsin = stats.totals.revenue / stats.totals.asins
    }
    if (stats.totals.purchases > 0) {
      stats.averages.pricePerPurchase = stats.totals.revenue / stats.totals.purchases
    }

    // Fetch brand-level comparisons if no specific brand selected
    if (!brandId) {
      const { data: brandComparison } = await supabase
        .from('brand_performance_summary')
        .select('brand_id, brand_name, total_revenue, avg_cvr')
        .order('total_revenue', { ascending: false })
        .limit(10)

      stats['topBrands'] = brandComparison || []
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}