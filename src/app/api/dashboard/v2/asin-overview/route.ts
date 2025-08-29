import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const asin = searchParams.get('asin')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const compareStartDate = searchParams.get('compareStartDate')
    const compareEndDate = searchParams.get('compareEndDate')
    // Remove includeQueries - we're focusing on weekly aggregated data

    if (!asin || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Fetch weekly aggregated data for the time series
    const { data: weeklyData, error: weeklyError } = await supabase
      .from('weekly_summary')
      .select('*')
      .eq('asin', asin)
      .gte('period_start', startDate)
      .lte('period_end', endDate)
      .order('period_start', { ascending: true })

    if (weeklyError) {
      console.error('Error fetching weekly data:', weeklyError)
      return NextResponse.json(
        { error: 'Failed to fetch performance data' },
        { status: 500 }
      )
    }

    // Get ASIN details
    const { data: asinData } = await supabase
      .from('asin_performance_data')
      .select('asin, product_title')
      .eq('asin', asin)
      .limit(1)
      .single()

    // Aggregate metrics for current period from weekly data
    const metrics = {
      totals: {
        impressions: weeklyData?.reduce((sum: number, row: any) => sum + (row.total_impressions || 0), 0) || 0,
        clicks: weeklyData?.reduce((sum: number, row: any) => sum + (row.total_clicks || 0), 0) || 0,
        cartAdds: weeklyData?.reduce((sum: number, row: any) => sum + (row.cart_adds || 0), 0) || 0,
        purchases: weeklyData?.reduce((sum: number, row: any) => sum + (row.total_purchases || 0), 0) || 0,
      },
      rates: {
        clickThroughRate: 0,
        cartAddRate: 0,
        purchaseRate: 0,
        overallConversionRate: 0,
      },
      marketShare: {
        impressionShare: 0, // Not available in weekly_summary
        clickShare: 0, // Not available in weekly_summary
        purchaseShare: 0, // Not available in weekly_summary
      },
      pricing: {
        medianPrice: 0, // Not available in weekly_summary
        competitorMedianPrice: 0,
        priceCompetitiveness: 0,
      },
    }

    // Calculate rates
    if (metrics.totals.impressions > 0) {
      metrics.rates.clickThroughRate = metrics.totals.clicks / metrics.totals.impressions
      metrics.rates.overallConversionRate = metrics.totals.purchases / metrics.totals.impressions
    }
    if (metrics.totals.clicks > 0) {
      metrics.rates.cartAddRate = metrics.totals.cartAdds / metrics.totals.clicks
      metrics.rates.purchaseRate = metrics.totals.purchases / metrics.totals.cartAdds
    }

    // Prepare time series data from weekly data
    const timeSeries = weeklyData?.map((row: any) => ({
      date: row.period_start,
      impressions: row.total_impressions || 0,
      clicks: row.total_clicks || 0,
      cartAdds: row.cart_adds || 0,
      purchases: row.total_purchases || 0,
    })) || []

    // Fetch comparison data if requested
    let comparison = null
    if (compareStartDate && compareEndDate) {
      const { data: compareData } = await supabase
        .from('weekly_summary')
        .select('*')
        .eq('asin', asin)
        .gte('period_start', compareStartDate)
        .lte('period_end', compareEndDate)

      if (compareData && compareData.length > 0) {
        const compareTotals = {
          impressions: compareData.reduce((sum: number, row: any) => sum + (row.total_impressions || 0), 0),
          clicks: compareData.reduce((sum: number, row: any) => sum + (row.total_clicks || 0), 0),
          cartAdds: compareData.reduce((sum: number, row: any) => sum + (row.cart_adds || 0), 0),
          purchases: compareData.reduce((sum: number, row: any) => sum + (row.total_purchases || 0), 0),
        }

        comparison = {
          metrics: {
            totals: compareTotals,
            rates: {
              clickThroughRate: compareTotals.impressions > 0 ? compareTotals.clicks / compareTotals.impressions : 0,
              cartAddRate: compareTotals.clicks > 0 ? compareTotals.cartAdds / compareTotals.clicks : 0,
              purchaseRate: compareTotals.cartAdds > 0 ? compareTotals.purchases / compareTotals.cartAdds : 0,
              overallConversionRate: compareTotals.impressions > 0 ? compareTotals.purchases / compareTotals.impressions : 0,
            },
          },
          changes: {
            impressions: compareTotals.impressions > 0 
              ? (metrics.totals.impressions - compareTotals.impressions) / compareTotals.impressions 
              : 0,
            clicks: compareTotals.clicks > 0 
              ? (metrics.totals.clicks - compareTotals.clicks) / compareTotals.clicks 
              : 0,
            purchases: compareTotals.purchases > 0 
              ? (metrics.totals.purchases - compareTotals.purchases) / compareTotals.purchases 
              : 0,
            conversionRate: compareTotals.impressions > 0 && metrics.totals.impressions > 0
              ? metrics.rates.overallConversionRate - (compareTotals.purchases / compareTotals.impressions)
              : 0,
          },
        }
      }
    }

    // Fetch top search queries for the ASIN
    const { data: searchQueryData, error: searchQueryError } = await supabase
      .from('search_performance_summary')
      .select('*')
      .eq('asin', asin)
      .gte('start_date', startDate)
      .lte('end_date', endDate)
      .order('impressions', { ascending: false })
      .limit(100)

    const topQueries = searchQueryData?.map((row: any) => ({
      searchQuery: row.search_query,
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      cartAdds: row.cart_adds || 0,
      purchases: row.purchases || 0,
      ctr: row.click_through_rate || 0,
      cvr: row.conversion_rate || 0,
      cartAddRate: row.cart_add_rate || 0,
      purchaseRate: row.purchase_rate || 0,
      impressionShare: row.impression_share || 0,
      clickShare: row.click_share || 0,
      purchaseShare: row.purchase_share || 0,
    })) || []

    return NextResponse.json({
      asin,
      productTitle: asinData?.product_title || `ASIN: ${asin}`,
      brand: 'Work Sharp',
      dateRange: {
        start: startDate,
        end: endDate,
      },
      metrics,
      comparison,
      timeSeries,
      topQueries,
    })
  } catch (error) {
    console.error('Error in /api/dashboard/v2/asin-overview:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}