import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateComparison } from '@/lib/utils/sparkline'
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
    
    const asinList = brandAsins?.map((ba: { asin: string }) => ba.asin) || []
    
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
    
    // Fetch aggregated KPIs for current period - WITH CORRECT COLUMN NAMES
    const { data: currentKpis, error: kpisError } = await supabase
      .from('search_performance_summary')
      .select('asin, total_impressions, total_clicks, total_cart_adds, total_purchases')
      .in('asin', asinList)
      .gte('start_date', dateFrom)
      .lte('end_date', dateTo)
    
    if (kpisError) {
      throw kpisError
    }
    
    // Aggregate KPI totals
    const kpiTotals = (currentKpis || []).reduce(
      (acc: { impressions: number; clicks: number; cartAdds: number; purchases: number }, row: any) => ({
        impressions: acc.impressions + (parseInt(row.total_impressions) || 0),
        clicks: acc.clicks + (parseInt(row.total_clicks) || 0),
        cartAdds: acc.cartAdds + (parseInt(row.total_cart_adds) || 0),
        purchases: acc.purchases + (parseInt(row.total_purchases) || 0),
      }),
      { impressions: 0, clicks: 0, cartAdds: 0, purchases: 0 }
    )
    
    // Fetch weekly time series data for the brand - WITH CORRECT COLUMN NAMES
    const { data: weeklyData, error: weeklyError } = await supabase
      .from('search_performance_summary')
      .select('asin, start_date, end_date, total_impressions, total_clicks, total_cart_adds, total_purchases')
      .in('asin', asinList)
      .gte('start_date', dateFrom)
      .lte('end_date', dateTo)
      .order('start_date', { ascending: true })
    
    if (weeklyError) {
      throw weeklyError
    }
    
    // Aggregate weekly data by date range for the brand
    const weeklyAggregates = (weeklyData || []).reduce((acc: Record<string, any>, row: any) => {
      const weekKey = row.start_date
      if (!acc[weekKey]) {
        acc[weekKey] = { 
          start_date: row.start_date,
          end_date: row.end_date,
          impressions: 0, 
          clicks: 0, 
          cartAdds: 0, 
          purchases: 0 
        }
      }
      acc[weekKey].impressions += parseInt(row.total_impressions) || 0
      acc[weekKey].clicks += parseInt(row.total_clicks) || 0
      acc[weekKey].cartAdds += parseInt(row.total_cart_adds) || 0
      acc[weekKey].purchases += parseInt(row.total_purchases) || 0
      return acc
    }, {})
    
    // Convert to array and sort by date
    const timeSeries = Object.values(weeklyAggregates)
      .sort((a: any, b: any) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
      .map((week: any) => ({
        date: week.start_date,
        impressions: week.impressions,
        clicks: week.clicks,
        cartAdds: week.cartAdds,
        purchases: week.purchases,
      }))
    
    // Fetch last 5 weeks of data specifically for sparklines - WITH CORRECT COLUMN NAMES
    const fiveWeeksAgo = new Date()
    fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - 35) // 5 weeks
    
    const { data: sparklineData, error: sparklineError } = await supabase
      .from('search_performance_summary')
      .select('asin, start_date, total_impressions, total_clicks, total_cart_adds, total_purchases')
      .in('asin', asinList)
      .gte('start_date', fiveWeeksAgo.toISOString().split('T')[0])
      .order('start_date', { ascending: true })
    
    if (sparklineError) {
      console.error('Error fetching sparkline data:', sparklineError)
    }
    
    // Aggregate sparkline data by week
    const sparklineAggregates = (sparklineData || []).reduce((acc: Record<string, any>, row: any) => {
      const weekKey = row.start_date
      if (!acc[weekKey]) {
        acc[weekKey] = { 
          impressions: 0, 
          clicks: 0, 
          cartAdds: 0, 
          purchases: 0 
        }
      }
      acc[weekKey].impressions += parseInt(row.total_impressions) || 0
      acc[weekKey].clicks += parseInt(row.total_clicks) || 0
      acc[weekKey].cartAdds += parseInt(row.total_cart_adds) || 0
      acc[weekKey].purchases += parseInt(row.total_purchases) || 0
      return acc
    }, {})
    
    // Convert to arrays for sparklines (last 5 weeks)
    const sparklineWeeks = Object.keys(sparklineAggregates).sort().slice(-5)
    const impressionsTrend = sparklineWeeks.map(week => sparklineAggregates[week].impressions)
    const clicksTrend = sparklineWeeks.map(week => sparklineAggregates[week].clicks)
    const cartAddsTrend = sparklineWeeks.map(week => sparklineAggregates[week].cartAdds)
    const purchasesTrend = sparklineWeeks.map(week => sparklineAggregates[week].purchases)
    
    // Handle comparison period if provided - WITH CORRECT COLUMN NAMES
    let comparison: {
      impressions: number;
      clicks: number;
      cartAdds: number;
      purchases: number;
    } | null = null
    
    // Store comparison data by ASIN for product-level comparisons
    let comparisonByAsin: Record<string, any> = {}
    
    if (comparisonDateFrom && comparisonDateTo) {
      const { data: comparisonKpis } = await supabase
        .from('search_performance_summary')
        .select('asin, total_impressions, total_clicks, total_cart_adds, total_purchases')
        .in('asin', asinList)
        .gte('start_date', comparisonDateFrom)
        .lte('end_date', comparisonDateTo)
      
      // Aggregate comparison data by ASIN for product-level metrics
      comparisonByAsin = (comparisonKpis || []).reduce((acc: Record<string, any>, row: any) => {
        if (!acc[row.asin]) {
          acc[row.asin] = { 
            impressions: 0, 
            clicks: 0, 
            cart_adds: 0, 
            purchases: 0 
          }
        }
        acc[row.asin].impressions += parseInt(row.total_impressions) || 0
        acc[row.asin].clicks += parseInt(row.total_clicks) || 0
        acc[row.asin].cart_adds += parseInt(row.total_cart_adds) || 0
        acc[row.asin].purchases += parseInt(row.total_purchases) || 0
        return acc
      }, {})
      
      const comparisonTotals = (comparisonKpis || []).reduce(
        (acc: { impressions: number; clicks: number; cartAdds: number; purchases: number }, row: any) => ({
          impressions: acc.impressions + (parseInt(row.total_impressions) || 0),
          clicks: acc.clicks + (parseInt(row.total_clicks) || 0),
          cartAdds: acc.cartAdds + (parseInt(row.total_cart_adds) || 0),
          purchases: acc.purchases + (parseInt(row.total_purchases) || 0),
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
    
    // Fetch product performance data from our brand materialized view
    const { data: products, error: productsError } = await supabase
      .from('brand_performance_summary')
      .select(`
        brand_id,
        asin_count,
        total_impressions,
        total_clicks,
        total_cart_adds,
        total_purchases,
        avg_ctr,
        avg_cvr,
        estimated_revenue
      `)
      .eq('brand_id', brandId)
      .single()
    
    if (productsError && productsError.code !== 'PGRST116') { // Ignore "not found" error
      console.error('Brand performance summary error:', productsError)
    }
    
    // Fetch top performing ASINs for this brand
    const { data: topAsinsRaw, error: topAsinsError } = await supabase
      .from('search_performance_summary')
      .select('asin, total_impressions, total_clicks, total_cart_adds, total_purchases')
      .in('asin', asinList)
      .gte('start_date', dateFrom)
      .lte('end_date', dateTo)
    
    if (topAsinsError) {
      console.error('Error fetching top ASINs:', topAsinsError)
    }
    
    // Aggregate data by ASIN
    const asinAggregates = (topAsinsRaw || []).reduce((acc: Record<string, any>, row: any) => {
      if (!acc[row.asin]) {
        acc[row.asin] = { 
          asin: row.asin,
          impressions: 0, 
          clicks: 0, 
          cart_adds: 0, 
          purchases: 0 
        }
      }
      acc[row.asin].impressions += parseInt(row.total_impressions) || 0
      acc[row.asin].clicks += parseInt(row.total_clicks) || 0
      acc[row.asin].cart_adds += parseInt(row.total_cart_adds) || 0
      acc[row.asin].purchases += parseInt(row.total_purchases) || 0
      return acc
    }, {})
    
    // Convert to array and sort by impressions
    const topAsins = Object.values(asinAggregates)
      .sort((a: any, b: any) => b.impressions - a.impressions)
      .slice(0, productLimit)
    
    // Format products data with proper CTR/CVR calculations
    const formattedProducts = (topAsins || []).map((product: any) => {
      const comparisonData = comparisonByAsin[product.asin] || { impressions: 0, clicks: 0, cart_adds: 0, purchases: 0 }
      
      // Calculate current period rates
      const currentCtr = product.impressions > 0 ? (product.clicks / product.impressions) * 100 : 0
      const currentCvr = product.clicks > 0 ? (product.purchases / product.clicks) * 100 : 0
      
      // Calculate comparison period rates
      const comparisonCtr = comparisonData.impressions > 0 ? (comparisonData.clicks / comparisonData.impressions) * 100 : 0
      const comparisonCvr = comparisonData.clicks > 0 ? (comparisonData.purchases / comparisonData.clicks) * 100 : 0
      
      return {
        id: product.asin,
        name: product.asin, // We don't have product titles in the summary
        childAsin: product.asin,
        image: `/api/products/${product.asin}/image`,
        impressions: product.impressions || 0,
        impressionsComparison: comparisonData.impressions > 0 ? calculateComparison(product.impressions, comparisonData.impressions) : null,
        clicks: product.clicks || 0,
        clicksComparison: comparisonData.clicks > 0 ? calculateComparison(product.clicks, comparisonData.clicks) : null,
        cartAdds: product.cart_adds || 0,
        cartAddsComparison: comparisonData.cart_adds > 0 ? calculateComparison(product.cart_adds, comparisonData.cart_adds) : null,
        purchases: product.purchases || 0,
        purchasesComparison: comparisonData.purchases > 0 ? calculateComparison(product.purchases, comparisonData.purchases) : null,
        ctr: `${currentCtr.toFixed(1)}%`,
        ctrComparison: comparisonCtr > 0 ? calculateComparison(currentCtr, comparisonCtr) : null,
        cvr: `${currentCvr.toFixed(1)}%`,
        cvrComparison: comparisonCvr > 0 ? calculateComparison(currentCvr, comparisonCvr) : null,
        impressionShare: '0%', // Not available in this view
        impressionShareComparison: null,
        cvrShare: '0%',
        cvrShareComparison: null,
        ctrShare: '0%',
        ctrShareComparison: null,
        cartAddShare: '0%',
        cartAddShareComparison: null,
        purchaseShare: '0%',
        purchaseShareComparison: null,
      }
    })
    
    // For search queries, we'll use the summary table but without grouping by search_query
    // since the view doesn't include individual search queries
    const searchQueries: any[] = []
    const queriesError = null
    
    // Note: The search_performance_summary view is aggregated by ASIN and date,
    // so it doesn't have individual search query data. 
    // To get search query data, we would need a different view or direct table access.
    
    if (queriesError) {
      throw queriesError
    }
    
    // Aggregate search query data
    const queryAggregates = (searchQueries || []).reduce((acc: Record<string, any>, row: any) => {
      const query = row.search_query
      if (!acc[query]) {
        acc[query] = { impressions: 0, clicks: 0, cart_adds: 0, purchases: 0 }
      }
      acc[query].impressions += row.asin_impression_count || 0
      acc[query].clicks += row.asin_click_count || 0
      acc[query].cart_adds += row.asin_cart_add_count || 0
      acc[query].purchases += row.asin_purchase_count || 0
      return acc
    }, {})
    
    // Convert to array and calculate metrics
    const aggregatedQueries = Object.entries(queryAggregates)
      .map(([search_query, metrics]: [string, any]) => ({
        search_query,
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        cart_adds: metrics.cart_adds,
        purchases: metrics.purchases,
        ctr: metrics.impressions > 0 ? (metrics.clicks / metrics.impressions * 100).toFixed(1) : 0,
        cvr: metrics.clicks > 0 ? (metrics.purchases / metrics.clicks * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, queryLimit)
    
    // Format search queries data
    const formattedQueries = aggregatedQueries.map((query: any, index: number) => ({
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
      ctr: `${query.ctr || 0}%`,
      ctrComparison: null,
      cvr: `${query.cvr || 0}%`,
      cvrComparison: null,
      impressionShare: `0%`, // Not available without the materialized view
      impressionShareComparison: null,
      cvrShare: `0%`,
      cvrShareComparison: null,
      ctrShare: `0%`,
      ctrShareComparison: null,
      cartAddShare: `0%`,
      cartAddShareComparison: null,
      purchaseShare: `0%`,
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
        timeSeries,  // Add the weekly time series data
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