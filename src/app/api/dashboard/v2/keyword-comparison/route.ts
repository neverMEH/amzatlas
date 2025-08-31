import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface KeywordComparisonData {
  timeSeries: Array<{
    date: string
    [keyword: string]: any
  }>
  funnels: {
    [keyword: string]: {
      impressions: number
      clicks: number
      cartAdds: number
      purchases: number
    }
  }
  marketShare: {
    [keyword: string]: number
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
    const keywordsParam = searchParams.get('keywords')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Validate required parameters
    if (!asin) {
      return NextResponse.json({ error: 'ASIN parameter is required' }, { status: 400 })
    }
    if (!keywordsParam) {
      return NextResponse.json({ error: 'Keywords parameter is required' }, { status: 400 })
    }
    if (!startDate) {
      return NextResponse.json({ error: 'Start date parameter is required' }, { status: 400 })
    }
    if (!endDate) {
      return NextResponse.json({ error: 'End date parameter is required' }, { status: 400 })
    }

    // Parse and validate keywords
    const keywords = keywordsParam.split(',').map(k => k.trim()).filter(k => k.length > 0)
    if (keywords.length === 0) {
      return NextResponse.json({ error: 'At least one keyword is required' }, { status: 400 })
    }
    if (keywords.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 keywords allowed' }, { status: 400 })
    }

    // Validate date formats
    if (!validateDate(startDate) || !validateDate(endDate)) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }

    // Validate date range
    if (new Date(startDate) > new Date(endDate)) {
      return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 })
    }

    const supabase = createClient()

    // Fetch time series data for all keywords
    const { data: timeSeriesData, error: timeSeriesError } = await supabase
      .from('search_query_performance')
      .select(`
        start_date,
        search_query,
        asin_impression_count,
        asin_click_count,
        asin_cart_add_count,
        asin_purchase_count
      `)
      .eq('asin', asin)
      .in('search_query', keywords)
      .gte('start_date', startDate)
      .lte('start_date', endDate)
      .order('start_date', { ascending: true })

    if (timeSeriesError) {
      console.error('Error fetching time series data:', timeSeriesError)
      return NextResponse.json({ error: 'Failed to fetch keyword comparison data' }, { status: 500 })
    }

    // Transform time series data into grouped format
    const timeSeriesMap = new Map<string, any>()
    
    if (timeSeriesData) {
      timeSeriesData.forEach((row: any) => {
        const date = row.start_date
        if (!timeSeriesMap.has(date)) {
          timeSeriesMap.set(date, { date })
        }
        
        const dateEntry = timeSeriesMap.get(date)
        dateEntry[row.search_query] = {
          impressions: row.asin_impression_count || 0,
          clicks: row.asin_click_count || 0,
          purchases: row.asin_purchase_count || 0,
        }
      })
    }

    const timeSeries = Array.from(timeSeriesMap.values())

    // Calculate funnel totals from time series data
    const funnels: KeywordComparisonData['funnels'] = {}
    
    // Group by keyword and sum the metrics
    if (timeSeriesData) {
      const keywordTotals = new Map<string, any>()
      
      timeSeriesData.forEach((row: any) => {
        const keyword = row.search_query
        if (!keywordTotals.has(keyword)) {
          keywordTotals.set(keyword, {
            impressions: 0,
            clicks: 0,
            cartAdds: 0,
            purchases: 0,
          })
        }
        
        const totals = keywordTotals.get(keyword)
        totals.impressions += row.asin_impression_count || 0
        totals.clicks += row.asin_click_count || 0
        totals.cartAdds += row.asin_cart_add_count || 0
        totals.purchases += row.asin_purchase_count || 0
      })
      
      keywordTotals.forEach((totals, keyword) => {
        funnels[keyword] = totals
      })
    }

    // Calculate market share data
    const marketShare: KeywordComparisonData['marketShare'] = {}
    
    // Fetch total market data for each keyword
    for (const keyword of keywords) {
      const { data: allAsinData } = await supabase
        .from('search_query_performance')
        .select('asin_impression_count, total_query_impression_count')
        .eq('search_query', keyword)
        .eq('asin', asin)
        .gte('start_date', startDate)
        .lte('start_date', endDate)
      
      if (allAsinData && allAsinData.length > 0) {
        // Sum impressions for this ASIN and total market
        const asinImpressions = allAsinData.reduce((sum: number, row: any) => sum + (row.asin_impression_count || 0), 0)
        const totalImpressions = allAsinData.reduce((sum: number, row: any) => sum + (row.total_query_impression_count || 0), 0)
        
        // Calculate impression share
        marketShare[keyword] = totalImpressions > 0 ? asinImpressions / totalImpressions : 0
      } else {
        marketShare[keyword] = 0
      }
    }

    const response: KeywordComparisonData = {
      timeSeries,
      funnels,
      marketShare,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in keyword-comparison API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}