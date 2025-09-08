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

    // If we have a brandId, get stats from the brand_performance_summary
    if (brandId) {
      const { data: brandStats, error: brandError } = await supabase
        .from('brand_performance_summary')
        .select('*')
        .eq('brand_id', brandId)
        .single()

      if (brandError && brandError.code !== 'PGRST116') {
        console.error('Error fetching brand performance summary:', brandError)
      }

      if (brandStats) {
        const stats = {
          totals: {
            impressions: brandStats.total_impressions || 0,
            clicks: brandStats.total_clicks || 0,
            cart_adds: brandStats.total_cart_adds || 0,
            purchases: brandStats.total_purchases || 0,
            revenue: brandStats.estimated_revenue || 0
          },
          averages: {
            ctr: brandStats.avg_ctr || 0,
            cart_add_rate: brandStats.avg_cart_add_rate || 0,
            cvr: brandStats.avg_cvr || 0,
            price: brandStats.avg_price || 0
          }
        }

        return NextResponse.json(stats)
      }
    }

    // Otherwise, get stats from search_performance_summary
    let query = supabase
      .from('search_performance_summary')
      .select(`
        total_query_impression_count,
        asin_click_count,
        asin_cart_add_count,
        asin_purchase_count,
        asin_median_purchase_price,
        asin
      `)
      .gte('start_date', startDate.toISOString())
      .lte('end_date', endDate.toISOString())

    // If brandId is provided, we need to join with asin_brand_mapping
    if (brandId) {
      // First get the ASINs for this brand
      const { data: brandAsins } = await supabase
        .from('asin_brand_mapping')
        .select('asin')
        .eq('brand_id', brandId)

      const asins = brandAsins?.map(ba => ba.asin) || []
      if (asins.length > 0) {
        query = query.in('asin', asins)
      } else {
        // No ASINs for this brand
        return NextResponse.json({
          totals: {
            impressions: 0,
            clicks: 0,
            cart_adds: 0,
            purchases: 0,
            revenue: 0
          },
          averages: {
            ctr: 0,
            cart_add_rate: 0,
            cvr: 0,
            price: 0
          }
        })
      }
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching brand stats:', error)
      return NextResponse.json(
        { error: 'Failed to fetch brand statistics' },
        { status: 500 }
      )
    }

    // Calculate totals and averages
    const stats = {
      totals: {
        impressions: data?.reduce((sum: number, d: any) => sum + (d.total_query_impression_count || 0), 0) || 0,
        clicks: data?.reduce((sum: number, d: any) => sum + (d.asin_click_count || 0), 0) || 0,
        cart_adds: data?.reduce((sum: number, d: any) => sum + (d.asin_cart_add_count || 0), 0) || 0,
        purchases: data?.reduce((sum: number, d: any) => sum + (d.asin_purchase_count || 0), 0) || 0,
        revenue: data?.reduce((sum: number, d: any) => sum + ((d.asin_purchase_count || 0) * (d.asin_median_purchase_price || 0)), 0) || 0
      },
      averages: {
        ctr: 0,
        cart_add_rate: 0,
        cvr: 0,
        price: 0
      }
    }

    // Calculate averages
    const totalPrices = data?.reduce((sum: number, d: any) => sum + (d.asin_median_purchase_price || 0), 0) || 0
    const priceCount = data?.filter((d: any) => d.asin_median_purchase_price > 0).length || 0
    
    stats.averages.price = priceCount > 0 ? totalPrices / priceCount : 0
    
    if (stats.totals.impressions > 0) {
      stats.averages.ctr = (stats.totals.clicks / stats.totals.impressions) * 100
    }
    
    if (stats.totals.clicks > 0) {
      stats.averages.cart_add_rate = (stats.totals.cart_adds / stats.totals.clicks) * 100
      stats.averages.cvr = (stats.totals.purchases / stats.totals.clicks) * 100
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error in brand stats API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}