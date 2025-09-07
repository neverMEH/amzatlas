import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { brandId: string } }
) {
  try {
    const supabase = createClient()
    const { brandId } = params
    const searchParams = request.nextUrl.searchParams
    const includePerformance = searchParams.get('includePerformance') === 'true'
    const sortBy = searchParams.get('sortBy') || 'asin'
    const order = searchParams.get('order') || 'asc'

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(brandId)) {
      return NextResponse.json(
        { error: 'Invalid brand ID format' },
        { status: 400 }
      )
    }

    // Use the get_brand_asins function
    const { data, error } = await supabase.rpc('get_brand_asins', {
      p_brand_id: brandId
    })

    if (error) {
      console.error('Error fetching brand ASINs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch brand ASINs' },
        { status: 500 }
      )
    }

    let asins = data || []

    // If performance data is requested, fetch additional metrics
    if (includePerformance && asins.length > 0) {
      const asinList = asins.map((item: any) => item.asin)
      
      const { data: performanceData, error: perfError } = await supabase
        .from('search_query_performance')
        .select(`
          asin,
          impressions_sum,
          clicks_sum,
          purchases_sum,
          median_price_purchase
        `)
        .in('asin', asinList)
        .gte('start_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('asin')

      if (!perfError && performanceData) {
        // Aggregate performance data by ASIN
        const performanceMap = new Map()
        
        performanceData.forEach((row: any) => {
          if (!performanceMap.has(row.asin)) {
            performanceMap.set(row.asin, {
              total_impressions: 0,
              total_clicks: 0,
              total_purchases: 0,
              total_revenue: 0
            })
          }
          
          const existing = performanceMap.get(row.asin)
          existing.total_impressions += row.impressions_sum || 0
          existing.total_clicks += row.clicks_sum || 0
          existing.total_purchases += row.purchases_sum || 0
          existing.total_revenue += (row.purchases_sum || 0) * (row.median_price_purchase || 0)
        })

        // Merge performance data with ASINs
        asins = asins.map((item: any) => ({
          ...item,
          ...(performanceMap.get(item.asin) || {})
        }))
      }
    }

    // Sort results
    const sortField = {
      'asin': 'asin',
      'title': 'product_title',
      'impressions': 'total_impressions',
      'revenue': 'total_revenue'
    }[sortBy] || 'asin'

    asins.sort((a: any, b: any) => {
      const aVal = a[sortField] || 0
      const bVal = b[sortField] || 0
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      
      return order === 'asc' ? aVal - bVal : bVal - aVal
    })

    return NextResponse.json({ 
      brandId,
      asins,
      count: asins.length
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}