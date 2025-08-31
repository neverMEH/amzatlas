import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface KeywordPerformanceData {
  summary: {
    impressions: number
    clicks: number
    cartAdds: number
    purchases: number
    ctr: number
    cvr: number
  }
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
  comparisonSummary?: {
    impressions: number
    clicks: number
    cartAdds: number
    purchases: number
    ctr: number
    cvr: number
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

interface DatabaseRow {
  date: string
  impressions: number | null
  clicks: number | null
  cart_adds: number | null
  purchases: number | null
  ctr: number | null
  cvr: number | null
  search_frequency_rank?: number | null
}

interface MarketShareRow {
  asin: string
  impressions: number | null
  clicks: number | null
  purchases: number | null
  asin_performance_data: {
    product_title: string | null
    brand: string | null
  } | null
}

interface TimeSeriesRow {
  date: string
  impressions: number
  clicks: number
  cartAdds: number
  purchases: number
  ctr: number
  cvr: number
}

interface SummaryData {
  impressions: number
  clicks: number
  cartAdds: number
  purchases: number
}

interface SummaryWithRates extends SummaryData {
  ctr: number
  cvr: number
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const asin = searchParams.get('asin')
    const keyword = searchParams.get('keyword')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const compareStartDate = searchParams.get('compareStartDate')
    const compareEndDate = searchParams.get('compareEndDate')

    if (!asin || !keyword || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: asin, keyword, startDate, endDate' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get main period data
    const { data: rawData, error } = await supabase
      .from('search_query_performance')
      .select(`
        date,
        impressions,
        clicks,
        cart_adds,
        purchases,
        ctr,
        cvr,
        search_frequency_rank
      `)
      .eq('asin', asin)
      .eq('search_query', keyword)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ 
        error: 'No data found for the specified parameters',
        details: { asin, keyword, startDate, endDate }
      }, { status: 404 })
    }

    // Transform data
    const timeSeries: TimeSeriesRow[] = rawData.map((row: DatabaseRow) => ({
      date: row.date,
      impressions: Number(row.impressions) || 0,
      clicks: Number(row.clicks) || 0,
      cartAdds: Number(row.cart_adds) || 0,
      purchases: Number(row.purchases) || 0,
      ctr: Number(row.ctr) || 0,
      cvr: Number(row.cvr) || 0,
    }))

    // Calculate funnel data (latest available data point)
    const latestData = timeSeries[timeSeries.length - 1]
    const funnelData = latestData ? {
      impressions: latestData.impressions,
      clicks: latestData.clicks,
      cartAdds: latestData.cartAdds,
      purchases: latestData.purchases,
    } : { impressions: 0, clicks: 0, cartAdds: 0, purchases: 0 }

    // Get market share data for the same period
    const { data: marketData } = await supabase
      .from('search_query_performance')
      .select(`
        asin,
        impressions,
        clicks,
        purchases,
        asin_performance_data!inner(
          product_title,
          brand
        )
      `)
      .eq('search_query', keyword)
      .gte('date', startDate)
      .lte('date', endDate)

    // Calculate market totals and competitor shares
    const marketTotals = { impressions: 0, clicks: 0, purchases: 0 }
    const competitorMap = new Map<string, {
      asin: string
      brand: string
      title: string
      impressions: number
      clicks: number
      purchases: number
    }>()

    marketData?.forEach((row: MarketShareRow) => {
      marketTotals.impressions += Number(row.impressions) || 0
      marketTotals.clicks += Number(row.clicks) || 0
      marketTotals.purchases += Number(row.purchases) || 0

      if (row.asin !== asin) {
        const competitor = competitorMap.get(row.asin) || {
          asin: row.asin,
          brand: row.asin_performance_data?.brand || 'Unknown',
          title: row.asin_performance_data?.product_title || 'Unknown Product',
          impressions: 0,
          clicks: 0,
          purchases: 0,
        }
        
        competitor.impressions += Number(row.impressions) || 0
        competitor.clicks += Number(row.clicks) || 0
        competitor.purchases += Number(row.purchases) || 0
        
        competitorMap.set(row.asin, competitor)
      }
    })

    const competitors = Array.from(competitorMap.values())
      .map(competitor => ({
        ...competitor,
        impressionShare: marketTotals.impressions > 0 ? competitor.impressions / marketTotals.impressions : 0,
        clickShare: marketTotals.clicks > 0 ? competitor.clicks / marketTotals.clicks : 0,
        purchaseShare: marketTotals.purchases > 0 ? competitor.purchases / marketTotals.purchases : 0,
      }))
      .sort((a, b) => b.impressionShare - a.impressionShare)
      .slice(0, 10) // Top 10 competitors

    const totalMarket = {
      impressions: marketTotals.impressions,
      clicks: marketTotals.clicks,
      purchases: marketTotals.purchases,
    }

    // Calculate summary statistics
    const summaryData = timeSeries.reduce((acc: SummaryData, row: TimeSeriesRow) => ({
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      cartAdds: acc.cartAdds + row.cartAdds,
      purchases: acc.purchases + row.purchases,
    }), { impressions: 0, clicks: 0, cartAdds: 0, purchases: 0 })
    
    // Add calculated rates
    const summary: SummaryWithRates = {
      ...summaryData,
      ctr: summaryData.impressions > 0 ? summaryData.clicks / summaryData.impressions : 0,
      cvr: summaryData.impressions > 0 ? summaryData.purchases / summaryData.impressions : 0,
    }

    const response: KeywordPerformanceData = {
      summary,
      timeSeries,
      funnelData: funnelData || { impressions: 0, clicks: 0, cartAdds: 0, purchases: 0 },
      marketShare: {
        totalMarket,
        competitors,
      },
    }

    // Fetch comparison data if dates provided
    if (compareStartDate && compareEndDate) {
      const { data: comparisonRawData } = await supabase
        .from('search_query_performance')
        .select(`
          date,
          impressions,
          clicks,
          cart_adds,
          purchases,
          ctr,
          cvr
        `)
        .eq('asin', asin)
        .eq('search_query', keyword)
        .gte('date', compareStartDate)
        .lte('date', compareEndDate)
        .order('date')

      if (comparisonRawData && comparisonRawData.length > 0) {
        const comparisonTimeSeries: TimeSeriesRow[] = comparisonRawData.map((row: DatabaseRow) => ({
          date: row.date,
          impressions: Number(row.impressions) || 0,
          clicks: Number(row.clicks) || 0,
          cartAdds: Number(row.cart_adds) || 0,
          purchases: Number(row.purchases) || 0,
          ctr: Number(row.ctr) || 0,
          cvr: Number(row.cvr) || 0,
        }))

        response.comparisonTimeSeries = comparisonTimeSeries

        // Calculate comparison summary
        const comparisonSummaryData = comparisonTimeSeries.reduce((acc: SummaryData, row: TimeSeriesRow) => ({
          impressions: acc.impressions + row.impressions,
          clicks: acc.clicks + row.clicks,
          cartAdds: acc.cartAdds + row.cartAdds,
          purchases: acc.purchases + row.purchases,
        }), { impressions: 0, clicks: 0, cartAdds: 0, purchases: 0 })
        
        response.comparisonSummary = {
          ...comparisonSummaryData,
          ctr: comparisonSummaryData.impressions > 0 ? comparisonSummaryData.clicks / comparisonSummaryData.impressions : 0,
          cvr: comparisonSummaryData.impressions > 0 ? comparisonSummaryData.purchases / comparisonSummaryData.impressions : 0,
        }

        // Calculate comparison funnel data
        const latestComparisonData = comparisonTimeSeries[comparisonTimeSeries.length - 1]
        response.comparisonFunnelData = latestComparisonData ? {
          impressions: latestComparisonData.impressions,
          clicks: latestComparisonData.clicks,
          cartAdds: latestComparisonData.cartAdds,
          purchases: latestComparisonData.purchases,
        } : { impressions: 0, clicks: 0, cartAdds: 0, purchases: 0 }

        // Get comparison market share data
        const { data: comparisonMarketData } = await supabase
          .from('search_query_performance')
          .select(`
            asin,
            impressions,
            clicks,
            purchases,
            asin_performance_data!inner(
              product_title,
              brand
            )
          `)
          .eq('search_query', keyword)
          .gte('date', compareStartDate)
          .lte('date', compareEndDate)

        // Calculate comparison market totals
        const comparisonMarketTotals = { impressions: 0, clicks: 0, purchases: 0 }
        const comparisonCompetitorMap = new Map<string, {
          asin: string
          brand: string
          title: string
          impressions: number
          clicks: number
          purchases: number
        }>()

        comparisonMarketData?.forEach((row: MarketShareRow) => {
          comparisonMarketTotals.impressions += Number(row.impressions) || 0
          comparisonMarketTotals.clicks += Number(row.clicks) || 0
          comparisonMarketTotals.purchases += Number(row.purchases) || 0

          if (row.asin !== asin) {
            const competitor = comparisonCompetitorMap.get(row.asin) || {
              asin: row.asin,
              brand: row.asin_performance_data?.brand || 'Unknown',
              title: row.asin_performance_data?.product_title || 'Unknown Product',
              impressions: 0,
              clicks: 0,
              purchases: 0,
            }
            
            competitor.impressions += Number(row.impressions) || 0
            competitor.clicks += Number(row.clicks) || 0
            competitor.purchases += Number(row.purchases) || 0
            
            comparisonCompetitorMap.set(row.asin, competitor)
          }
        })

        const comparisonCompetitors = Array.from(comparisonCompetitorMap.values())
          .map(competitor => ({
            ...competitor,
            impressionShare: comparisonMarketTotals.impressions > 0 ? competitor.impressions / comparisonMarketTotals.impressions : 0,
            clickShare: comparisonMarketTotals.clicks > 0 ? competitor.clicks / comparisonMarketTotals.clicks : 0,
            purchaseShare: comparisonMarketTotals.purchases > 0 ? competitor.purchases / comparisonMarketTotals.purchases : 0,
          }))
          .sort((a, b) => b.impressionShare - a.impressionShare)
          .slice(0, 10)

        response.comparisonMarketShare = {
          totalMarket: comparisonMarketTotals,
          competitors: comparisonCompetitors,
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}