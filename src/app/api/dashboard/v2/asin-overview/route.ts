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
    const includeQueries = searchParams.get('includeQueries') !== 'false'

    if (!asin || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Fetch current period data
    const { data: currentData, error: currentError } = await supabase
      .from('sqp.search_performance_summary')
      .select('*')
      .eq('asin', asin)
      .gte('start_date', startDate)
      .lte('end_date', endDate)

    if (currentError) {
      console.error('Error fetching current period data:', currentError)
      return NextResponse.json(
        { error: 'Failed to fetch performance data' },
        { status: 500 }
      )
    }

    // Get ASIN details
    const { data: asinData } = await supabase
      .from('sqp.asin_performance_data')
      .select('asin, product_title')
      .eq('asin', asin)
      .limit(1)
      .single()

    // Aggregate metrics for current period
    const metrics = {
      totals: {
        impressions: currentData?.reduce((sum: number, row: any) => sum + (row.impressions || 0), 0) || 0,
        clicks: currentData?.reduce((sum: number, row: any) => sum + (row.clicks || 0), 0) || 0,
        cartAdds: currentData?.reduce((sum: number, row: any) => sum + (row.cart_adds || 0), 0) || 0,
        purchases: currentData?.reduce((sum: number, row: any) => sum + (row.purchases || 0), 0) || 0,
      },
      rates: {
        clickThroughRate: 0,
        cartAddRate: 0,
        purchaseRate: 0,
        overallConversionRate: 0,
      },
      marketShare: {
        impressionShare: currentData?.[0]?.impression_share || 0,
        clickShare: currentData?.[0]?.click_share || 0,
        purchaseShare: currentData?.[0]?.purchase_share || 0,
      },
      pricing: {
        medianPrice: currentData?.[0]?.median_price || 0,
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

    // Prepare time series data
    const timeSeries = currentData?.map((row: any) => ({
      date: row.start_date,
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      cartAdds: row.cart_adds || 0,
      purchases: row.purchases || 0,
    })) || []

    // Fetch comparison data if requested
    let comparison = null
    if (compareStartDate && compareEndDate) {
      const { data: compareData } = await supabase
        .from('sqp.search_performance_summary')
        .select('*')
        .eq('asin', asin)
        .gte('start_date', compareStartDate)
        .lte('end_date', compareEndDate)

      if (compareData && compareData.length > 0) {
        const compareTotals = {
          impressions: compareData.reduce((sum: number, row: any) => sum + (row.impressions || 0), 0),
          clicks: compareData.reduce((sum: number, row: any) => sum + (row.clicks || 0), 0),
          cartAdds: compareData.reduce((sum: number, row: any) => sum + (row.cart_adds || 0), 0),
          purchases: compareData.reduce((sum: number, row: any) => sum + (row.purchases || 0), 0),
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

    // Fetch top queries if requested
    let topQueries = []
    if (includeQueries) {
      const { data: queryData } = await supabase
        .from('sqp.search_query_performance')
        .select('search_query, impressions, clicks, purchases')
        .eq('asin', asin)
        .gte('start_date', startDate)
        .lte('end_date', endDate)
        .order('impressions', { ascending: false })
        .limit(10)

      topQueries = queryData?.map((q: any) => ({
        query: q.search_query,
        impressions: q.impressions || 0,
        clicks: q.clicks || 0,
        purchases: q.purchases || 0,
        conversionRate: q.impressions > 0 ? (q.purchases || 0) / q.impressions : 0,
      })) || []
    }

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