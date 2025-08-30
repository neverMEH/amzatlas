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
        impressions,
        clicks,
        cart_adds,
        purchases
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
      timeSeriesData.forEach(row => {
        const date = row.start_date
        if (!timeSeriesMap.has(date)) {
          timeSeriesMap.set(date, { date })
        }
        
        const dateEntry = timeSeriesMap.get(date)
        dateEntry[row.search_query] = {
          impressions: row.impressions || 0,
          clicks: row.clicks || 0,
          purchases: row.purchases || 0,
        }
      })
    }

    const timeSeries = Array.from(timeSeriesMap.values())

    // Fetch funnel totals for all keywords
    const { data: funnelData, error: funnelError } = await supabase
      .rpc('get_multiple_keyword_funnels', {
        p_asin: asin,
        p_keywords: keywords,
        p_start_date: startDate,
        p_end_date: endDate,
      })

    if (funnelError) {
      console.error('Error fetching funnel data:', funnelError)
    }

    // Transform funnel data
    const funnels: KeywordComparisonData['funnels'] = {}
    if (funnelData) {
      funnelData.forEach((row: any) => {
        funnels[row.search_query] = {
          impressions: row.impressions || 0,
          clicks: row.clicks || 0,
          cartAdds: row.cart_adds || 0,
          purchases: row.purchases || 0,
        }
      })
    }

    // Fetch market share data for keywords
    const { data: marketShareData, error: marketShareError } = await supabase
      .rpc('get_keyword_impression_shares', {
        p_asin: asin,
        p_keywords: keywords,
        p_start_date: startDate,
        p_end_date: endDate,
      })

    if (marketShareError) {
      console.error('Error fetching market share data:', marketShareError)
    }

    // Transform market share data
    const marketShare: KeywordComparisonData['marketShare'] = {}
    if (marketShareData) {
      marketShareData.forEach((row: any) => {
        marketShare[row.search_query] = row.impression_share || 0
      })
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