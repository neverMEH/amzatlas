import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface KeywordPerformanceData {
  timeSeries: Array<{
    date: string
    impressions: number
    clicks: number
    cartAdds: number
    purchases: number
    ctr: number
    cvr: number
  }>
  funnelData: {
    impressions: number
    clicks: number
    cartAdds: number
    purchases: number
  }
  marketShare: {
    totalMarket: {
      impressions: number
      clicks: number
      purchases: number
    }
    competitors: Array<{
      asin: string
      brand: string
      title: string
      impressionShare: number
      clickShare: number
      purchaseShare: number
    }>
  }
  comparisonTimeSeries?: Array<{
    date: string
    impressions: number
    clicks: number
    cartAdds: number
    purchases: number
    ctr: number
    cvr: number
  }>
  comparisonFunnelData?: {
    impressions: number
    clicks: number
    cartAdds: number
    purchases: number
  }
  comparisonMarketShare?: {
    totalMarket: {
      impressions: number
      clicks: number
      purchases: number
    }
    competitors: Array<{
      asin: string
      brand: string
      title: string
      impressionShare: number
      clickShare: number
      purchaseShare: number
    }>
  }
}

function validateDate(dateStr: string): boolean {
  const date = new Date(dateStr)
  return date instanceof Date && !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const asin = searchParams.get('asin')
    const keyword = searchParams.get('keyword')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const compareStartDate = searchParams.get('compareStartDate')
    const compareEndDate = searchParams.get('compareEndDate')

    // Validate required parameters
    if (!asin) {
      return NextResponse.json({ error: 'ASIN parameter is required' }, { status: 400 })
    }
    if (!keyword) {
      return NextResponse.json({ error: 'Keyword parameter is required' }, { status: 400 })
    }
    if (!startDate) {
      return NextResponse.json({ error: 'Start date parameter is required' }, { status: 400 })
    }
    if (!endDate) {
      return NextResponse.json({ error: 'End date parameter is required' }, { status: 400 })
    }

    // Validate date formats
    if (!validateDate(startDate) || !validateDate(endDate)) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    // Validate date range
    if (new Date(startDate) > new Date(endDate)) {
      return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 })
    }

    // Validate comparison dates if provided
    if (compareStartDate && compareEndDate) {
      if (!validateDate(compareStartDate) || !validateDate(compareEndDate)) {
        return NextResponse.json({ error: 'Invalid comparison date format' }, { status: 400 })
      }
      if (new Date(compareStartDate) > new Date(compareEndDate)) {
        return NextResponse.json({ error: 'Comparison start date must be before end date' }, { status: 400 })
      }
    }

    const supabase = createClient()

    // Fetch time series data
    const { data: timeSeriesData, error: timeSeriesError } = await supabase
      .from('search_query_performance')
      .select(`
        start_date,
        impressions,
        clicks,
        cart_adds,
        purchases
      `)
      .eq('asin', asin)
      .eq('search_query', keyword)
      .gte('start_date', startDate)
      .lte('start_date', endDate)
      .order('start_date', { ascending: true })

    if (timeSeriesError) {
      console.error('Error fetching time series data:', timeSeriesError)
      return NextResponse.json({ error: 'Failed to fetch keyword performance data' }, { status: 500 })
    }

    // Transform time series data
    const timeSeries = (timeSeriesData || []).map((row: any) => ({
      date: row.start_date,
      impressions: row.impressions || 0,
      clicks: row.clicks || 0,
      cartAdds: row.cart_adds || 0,
      purchases: row.purchases || 0,
      ctr: row.impressions > 0 ? (row.clicks / row.impressions) : 0,
      cvr: row.impressions > 0 ? (row.purchases / row.impressions) : 0,
    }))

    // Calculate funnel totals
    const { data: funnelRpcData, error: funnelError } = await supabase
      .rpc('get_keyword_funnel_totals', {
        p_asin: asin,
        p_keyword: keyword,
        p_start_date: startDate,
        p_end_date: endDate,
      })

    let funnelData = null
    if (funnelError || !funnelRpcData || funnelRpcData.length === 0) {
      console.error('Error fetching funnel data:', funnelError)
      // Use calculated totals as fallback
      funnelData = timeSeries.reduce((acc: any, row: any) => ({
        impressions: acc.impressions + row.impressions,
        clicks: acc.clicks + row.clicks,
        cartAdds: acc.cartAdds + row.cartAdds,
        purchases: acc.purchases + row.purchases,
      }), { impressions: 0, clicks: 0, cartAdds: 0, purchases: 0 })
    } else {
      funnelData = funnelRpcData[0]
    }

    // Fetch market share data
    const { data: marketShareData, error: marketShareError } = await supabase
      .rpc('get_keyword_market_share', {
        p_keyword: keyword,
        p_start_date: startDate,
        p_end_date: endDate,
      })

    if (marketShareError) {
      console.error('Error fetching market share data:', marketShareError)
    }

    // Calculate total market metrics
    const totalMarket = (marketShareData || []).reduce((acc: any, row: any) => ({
      impressions: acc.impressions + (row.impressions || 0),
      clicks: acc.clicks + (row.clicks || 0),
      purchases: acc.purchases + (row.purchases || 0),
    }), { impressions: 0, clicks: 0, purchases: 0 })

    // Transform market share data
    const competitors = (marketShareData || []).map((row: any) => ({
      asin: row.asin,
      brand: row.brand || 'Unknown',
      title: row.title || 'Unknown Product',
      impressionShare: totalMarket.impressions > 0 ? (row.impressions || 0) / totalMarket.impressions : 0,
      clickShare: totalMarket.clicks > 0 ? (row.clicks || 0) / totalMarket.clicks : 0,
      purchaseShare: totalMarket.purchases > 0 ? (row.purchases || 0) / totalMarket.purchases : 0,
    }))

    const response: KeywordPerformanceData = {
      timeSeries,
      funnelData: funnelData || { impressions: 0, clicks: 0, cartAdds: 0, purchases: 0 },
      marketShare: {
        totalMarket,
        competitors,
      },
    }

    // Fetch comparison data if dates provided
    if (compareStartDate && compareEndDate) {
      const { data: comparisonTimeSeriesData } = await supabase
        .from('search_query_performance')
        .select(`
          start_date,
          impressions,
          clicks,
          cart_adds,
          purchases
        `)
        .eq('asin', asin)
        .eq('search_query', keyword)
        .gte('start_date', compareStartDate)
        .lte('start_date', compareEndDate)
        .order('start_date', { ascending: true })

      if (comparisonTimeSeriesData) {
        response.comparisonTimeSeries = comparisonTimeSeriesData.map((row: any) => ({
          date: row.start_date,
          impressions: row.impressions || 0,
          clicks: row.clicks || 0,
          cartAdds: row.cart_adds || 0,
          purchases: row.purchases || 0,
          ctr: row.impressions > 0 ? (row.clicks / row.impressions) : 0,
          cvr: row.impressions > 0 ? (row.purchases / row.impressions) : 0,
        }))
      }

      // Fetch comparison funnel data
      const { data: comparisonFunnelRpcData } = await supabase
        .rpc('get_keyword_funnel_totals', {
          p_asin: asin,
          p_keyword: keyword,
          p_start_date: compareStartDate,
          p_end_date: compareEndDate,
        })

      if (comparisonFunnelRpcData && comparisonFunnelRpcData.length > 0) {
        response.comparisonFunnelData = comparisonFunnelRpcData[0]
      }

      // Fetch comparison market share
      const { data: comparisonMarketShareData } = await supabase
        .rpc('get_keyword_market_share', {
          p_keyword: keyword,
          p_start_date: compareStartDate,
          p_end_date: compareEndDate,
        })

      if (comparisonMarketShareData) {
        const comparisonTotalMarket = comparisonMarketShareData.reduce((acc: any, row: any) => ({
          impressions: acc.impressions + (row.impressions || 0),
          clicks: acc.clicks + (row.clicks || 0),
          purchases: acc.purchases + (row.purchases || 0),
        }), { impressions: 0, clicks: 0, purchases: 0 })

        response.comparisonMarketShare = {
          totalMarket: comparisonTotalMarket,
          competitors: comparisonMarketShareData.map((row: any) => ({
            asin: row.asin,
            brand: row.brand || 'Unknown',
            title: row.title || 'Unknown Product',
            impressionShare: comparisonTotalMarket.impressions > 0 ? (row.impressions || 0) / comparisonTotalMarket.impressions : 0,
            clickShare: comparisonTotalMarket.clicks > 0 ? (row.clicks || 0) / comparisonTotalMarket.clicks : 0,
            purchaseShare: comparisonTotalMarket.purchases > 0 ? (row.purchases || 0) / comparisonTotalMarket.purchases : 0,
          })),
        }
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in keyword-performance API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}