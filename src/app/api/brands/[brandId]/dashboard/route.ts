import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSparklineData, calculateComparison } from '@/lib/utils/sparkline'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'

interface DashboardParams {
  params: {
    brandId: string
  }
}

export async function GET(
  request: NextRequest,
  { params }: DashboardParams
) {
  try {
    const { brandId } = params
    const searchParams = request.nextUrl.searchParams
    
    // Parse date parameters
    const dateFrom = searchParams.get('date_from') || format(subDays(new Date(), 30), 'yyyy-MM-dd')
    const dateTo = searchParams.get('date_to') || format(new Date(), 'yyyy-MM-dd')
    const comparisonDateFrom = searchParams.get('comparison_date_from')
    const comparisonDateTo = searchParams.get('comparison_date_to')
    
    const productLimit = parseInt(searchParams.get('product_limit') || '50', 10)
    const queryLimit = parseInt(searchParams.get('query_limit') || '50', 10)
    
    const supabase = createClient()
    
    // Fetch brand information
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, display_name')
      .eq('id', brandId)
      .single()
    
    if (brandError || !brand) {
      return NextResponse.json(
        { error: { code: 'BRAND_NOT_FOUND', message: 'Brand not found' } },
        { status: 404 }
      )
    }
    
    // Fetch ASINs for this brand
    const { data: brandAsins, error: asinsError } = await supabase
      .from('asin_brand_mapping')
      .select('asin')
      .eq('brand_id', brandId)
    
    if (asinsError) {
      throw asinsError
    }
    
    const asinList = brandAsins?.map(ba => ba.asin) || []
    
    if (asinList.length === 0) {
      // Return empty dashboard data if no ASINs
      return NextResponse.json({
        data: {
          kpis: {
            impressions: { value: 0, trend: [], comparison: null },
            clicks: { value: 0, trend: [], comparison: null },
            cartAdds: { value: 0, trend: [], comparison: null },
            purchases: { value: 0, trend: [], comparison: null },
          },
          products: [],
          searchQueries: [],
        },
        meta: {
          brand: { id: brand.id, display_name: brand.display_name },
          dateRange: { from: dateFrom, to: dateTo },
        },
      })
    }
    
    // Fetch aggregated KPIs for current period
    const { data: currentKpis, error: kpisError } = await supabase
      .from('search_performance_summary')
      .select('impressions, clicks, cart_adds, purchases')
      .in('asin', asinList)
      .gte('start_date', dateFrom)
      .lte('end_date', dateTo)
    
    if (kpisError) {
      throw kpisError
    }
    
    // Aggregate KPI totals
    const kpiTotals = (currentKpis || []).reduce(
      (acc, row) => ({
        impressions: acc.impressions + (row.impressions || 0),
        clicks: acc.clicks + (row.clicks || 0),
        cartAdds: acc.cartAdds + (row.cart_adds || 0),
        purchases: acc.purchases + (row.purchases || 0),
      }),
      { impressions: 0, clicks: 0, cartAdds: 0, purchases: 0 }
    )
    
    // Fetch daily data for sparkline trends
    const { data: dailyData, error: dailyError } = await supabase
      .from('daily_sqp_data')
      .select('date, impressions, clicks, cart_adds, purchases')
      .in('asin', asinList)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: true })
    
    if (dailyError) {
      throw dailyError
    }
    
    // Aggregate daily data by date
    const dailyAggregates = (dailyData || []).reduce((acc, row) => {
      const date = row.date
      if (!acc[date]) {
        acc[date] = { impressions: 0, clicks: 0, cartAdds: 0, purchases: 0 }
      }
      acc[date].impressions += row.impressions || 0
      acc[date].clicks += row.clicks || 0
      acc[date].cartAdds += row.cart_adds || 0
      acc[date].purchases += row.purchases || 0
      return acc
    }, {} as Record<string, any>)
    
    // Generate sparkline data (20 points)
    const dates = Object.keys(dailyAggregates).sort()
    const impressionsTrend = generateSparklineData(
      dates.map(d => ({ date: d, value: dailyAggregates[d].impressions })),
      20
    )
    const clicksTrend = generateSparklineData(
      dates.map(d => ({ date: d, value: dailyAggregates[d].clicks })),
      20
    )
    const cartAddsTrend = generateSparklineData(
      dates.map(d => ({ date: d, value: dailyAggregates[d].cartAdds })),
      20
    )
    const purchasesTrend = generateSparklineData(
      dates.map(d => ({ date: d, value: dailyAggregates[d].purchases })),
      20
    )
    
    // Handle comparison period if provided
    let comparison = null
    if (comparisonDateFrom && comparisonDateTo) {
      const { data: comparisonKpis } = await supabase
        .from('search_performance_summary')
        .select('impressions, clicks, cart_adds, purchases')
        .in('asin', asinList)
        .gte('start_date', comparisonDateFrom)
        .lte('end_date', comparisonDateTo)
      
      const comparisonTotals = (comparisonKpis || []).reduce(
        (acc, row) => ({
          impressions: acc.impressions + (row.impressions || 0),
          clicks: acc.clicks + (row.clicks || 0),
          cartAdds: acc.cartAdds + (row.cart_adds || 0),
          purchases: acc.purchases + (row.purchases || 0),
        }),
        { impressions: 0, clicks: 0, cartAdds: 0, purchases: 0 }
      )
      
      comparison = {
        impressions: calculateComparison(kpiTotals.impressions, comparisonTotals.impressions),
        clicks: calculateComparison(kpiTotals.clicks, comparisonTotals.clicks),
        cartAdds: calculateComparison(kpiTotals.cartAdds, comparisonTotals.cartAdds),
        purchases: calculateComparison(kpiTotals.purchases, comparisonTotals.purchases),
      }
    }
    
    // Fetch product performance data
    const { data: products, error: productsError } = await supabase
      .from('asin_performance_by_brand')
      .select('*')
      .eq('brand_id', brandId)
      .order('impressions', { ascending: false })
      .limit(productLimit)
    
    if (productsError) {
      throw productsError
    }
    
    // Format products data
    const formattedProducts = (products || []).map((product, index) => ({
      id: product.asin,
      name: product.product_title || product.asin,
      childAsin: product.asin,
      image: `/api/products/${product.asin}/image`,
      impressions: product.impressions || 0,
      impressionsComparison: comparison ? comparison.impressions : null,
      clicks: product.clicks || 0,
      clicksComparison: comparison ? comparison.clicks : null,
      cartAdds: product.cart_adds || 0,
      cartAddsComparison: comparison ? comparison.cartAdds : null,
      purchases: product.purchases || 0,
      purchasesComparison: comparison ? comparison.purchases : null,
      ctr: `${product.click_through_rate?.toFixed(1) || 0}%`,
      ctrComparison: null,
      cvr: `${product.conversion_rate?.toFixed(1) || 0}%`,
      cvrComparison: null,
      impressionShare: `${product.impression_share?.toFixed(0) || 0}%`,
      impressionShareComparison: null,
      cvrShare: `${product.cvr_share?.toFixed(0) || 0}%`,
      cvrShareComparison: null,
      ctrShare: `${product.ctr_share?.toFixed(0) || 0}%`,
      ctrShareComparison: null,
      cartAddShare: `${product.cart_add_share?.toFixed(0) || 0}%`,
      cartAddShareComparison: null,
      purchaseShare: `${product.purchase_share?.toFixed(0) || 0}%`,
      purchaseShareComparison: null,
    }))
    
    // Fetch search query performance
    const { data: searchQueries, error: queriesError } = await supabase
      .from('brand_search_query_metrics')
      .select('*')
      .eq('brand_id', brandId)
      .order('impressions', { ascending: false })
      .limit(queryLimit)
    
    if (queriesError) {
      throw queriesError
    }
    
    // Format search queries data
    const formattedQueries = (searchQueries || []).map((query, index) => ({
      id: index + 1,
      query: query.search_query,
      impressions: query.impressions || 0,
      impressionsComparison: comparison ? comparison.impressions : null,
      clicks: query.clicks || 0,
      clicksComparison: comparison ? comparison.clicks : null,
      cartAdds: query.cart_adds || 0,
      cartAddsComparison: comparison ? comparison.cartAdds : null,
      purchases: query.purchases || 0,
      purchasesComparison: comparison ? comparison.purchases : null,
      ctr: `${query.ctr?.toFixed(1) || 0}%`,
      ctrComparison: null,
      cvr: `${query.cvr?.toFixed(1) || 0}%`,
      cvrComparison: null,
      impressionShare: `${query.impression_share?.toFixed(0) || 0}%`,
      impressionShareComparison: null,
      cvrShare: `${query.cvr_share?.toFixed(0) || 0}%`,
      cvrShareComparison: null,
      ctrShare: `${query.ctr_share?.toFixed(0) || 0}%`,
      ctrShareComparison: null,
      cartAddShare: `${query.cart_add_share?.toFixed(0) || 0}%`,
      cartAddShareComparison: null,
      purchaseShare: `${query.purchase_share?.toFixed(0) || 0}%`,
      purchaseShareComparison: null,
    }))
    
    // Build response
    const response = {
      data: {
        kpis: {
          impressions: {
            value: kpiTotals.impressions,
            trend: impressionsTrend,
            comparison: comparison?.impressions,
          },
          clicks: {
            value: kpiTotals.clicks,
            trend: clicksTrend,
            comparison: comparison?.clicks,
          },
          cartAdds: {
            value: kpiTotals.cartAdds,
            trend: cartAddsTrend,
            comparison: comparison?.cartAdds,
          },
          purchases: {
            value: kpiTotals.purchases,
            trend: purchasesTrend,
            comparison: comparison?.purchases,
          },
        },
        products: formattedProducts,
        searchQueries: formattedQueries,
      },
      meta: {
        brand: {
          id: brand.id,
          display_name: brand.display_name,
        },
        dateRange: {
          from: dateFrom,
          to: dateTo,
        },
        comparisonDateRange: comparisonDateFrom && comparisonDateTo
          ? {
              from: comparisonDateFrom,
              to: comparisonDateTo,
            }
          : null,
      },
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in brand dashboard API:', error)
    return NextResponse.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch dashboard data' } },
      { status: 500 }
    )
  }
}