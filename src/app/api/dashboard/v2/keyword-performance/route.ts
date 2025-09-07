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
        asin_impression_count,
        asin_click_count,
        asin_cart_add_count,
        asin_purchase_count
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
      impressions: row.asin_impression_count || 0,
      clicks: row.asin_click_count || 0,
      cartAdds: row.asin_cart_add_count || 0,
      purchases: row.asin_purchase_count || 0,
      ctr: row.asin_impression_count > 0 ? (row.asin_click_count / row.asin_impression_count) : 0,
      cvr: row.asin_impression_count > 0 ? (row.asin_purchase_count / row.asin_impression_count) : 0,
    }))

    // Calculate funnel totals from time series data
    const funnelData = timeSeries.reduce((acc: any, row: any) => ({
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      cartAdds: acc.cartAdds + row.cartAdds,
      purchases: acc.purchases + row.purchases,
    }), { impressions: 0, clicks: 0, cartAdds: 0, purchases: 0 })

    // Fetch market share data - aggregate by ASIN for the keyword
    const { data: marketShareData, error: marketShareError } = await supabase
      .from('search_query_performance')
      .select('asin')
      .eq('search_query', keyword)
      .gte('start_date', startDate)
      .lte('start_date', endDate)

    if (marketShareError) {
      console.error('Error fetching market share data:', marketShareError)
    }

    // Aggregate metrics by ASIN - skip raw SQL and go directly to manual aggregation
    const asinMetrics = new Map()
    
    // Always use manual aggregation for better compatibility
    const aggregatedData: any[] | null = null

    // Do manual aggregation
    if (marketShareData) {
      const manualAggregation: { [key: string]: any } = {}
      
      // Fetch all records for this keyword in date range
      const { data: allRecords } = await supabase
        .from('search_query_performance')
        .select('asin, asin_impression_count, asin_click_count, asin_purchase_count')
        .eq('search_query', keyword)
        .gte('start_date', startDate)
        .lte('start_date', endDate)
      
      allRecords?.forEach((row: any) => {
        if (!manualAggregation[row.asin]) {
          manualAggregation[row.asin] = {
            asin: row.asin,
            total_impressions: 0,
            total_clicks: 0,
            total_purchases: 0
          }
        }
        manualAggregation[row.asin].total_impressions += row.asin_impression_count || 0
        manualAggregation[row.asin].total_clicks += row.asin_click_count || 0
        manualAggregation[row.asin].total_purchases += row.asin_purchase_count || 0
      })
      
      Object.values(manualAggregation).forEach((row: any) => {
        asinMetrics.set(row.asin, {
          impressions: row.total_impressions,
          clicks: row.total_clicks,
          purchases: row.total_purchases,
        })
      })
    }

    // Calculate total market metrics
    const totalMarket = Array.from(asinMetrics.values()).reduce((acc: any, metrics: any) => ({
      impressions: acc.impressions + metrics.impressions,
      clicks: acc.clicks + metrics.clicks,
      purchases: acc.purchases + metrics.purchases,
    }), { impressions: 0, clicks: 0, purchases: 0 })

    // Fetch product titles and brand data separately for market share data
    const asinSet = new Set(marketShareData?.map((row: any) => row.asin) || [])
    const uniqueAsins = Array.from(asinSet)
    
    // Fetch product titles
    const { data: asinTitles } = uniqueAsins.length > 0 ? await supabase
      .from('asin_performance_data')
      .select('asin, product_title')
      .in('asin', uniqueAsins) : { data: [] }
    
    // Fetch brand mappings
    const { data: brandMappings } = uniqueAsins.length > 0 ? await supabase
      .from('asin_brand_mapping')
      .select('asin, brand_id')
      .in('asin', uniqueAsins) : { data: [] }
    
    // Fetch brand names for the brand IDs
    const brandIds = brandMappings?.map((mapping: any) => mapping.brand_id).filter(Boolean) || []
    const { data: brandData } = brandIds.length > 0 ? await supabase
      .from('brands')
      .select('id, brand_name')
      .in('id', brandIds) : { data: [] }
    
    // Create lookup maps
    const titleMap = new Map(asinTitles?.map((item: any) => [item.asin, item.product_title]) || [])
    const brandIdMap = new Map(brandMappings?.map((item: any) => [item.asin, item.brand_id]) || [])
    const brandNameMap = new Map(brandData?.map((item: any) => [item.id, item.brand_name]) || [])
    
    // Transform market share data
    const asinDataMap = new Map()
    marketShareData?.forEach((row: any) => {
      if (!asinDataMap.has(row.asin)) {
        const brandId = brandIdMap.get(row.asin)
        const brandName = brandId ? brandNameMap.get(brandId) : null
        
        asinDataMap.set(row.asin, {
          asin: row.asin,
          title: titleMap.get(row.asin) || 'Unknown Product',
          brand: brandName || 'Unknown',
        })
      }
    })

    const competitors = Array.from(asinDataMap.values()).map((asinData: any) => {
      const metrics = asinMetrics.get(asinData.asin) || { impressions: 0, clicks: 0, purchases: 0 }
      return {
        asin: asinData.asin,
        brand: asinData.brand,
        title: asinData.title,
        impressionShare: totalMarket.impressions > 0 ? metrics.impressions / totalMarket.impressions : 0,
        clickShare: totalMarket.clicks > 0 ? metrics.clicks / totalMarket.clicks : 0,
        purchaseShare: totalMarket.purchases > 0 ? metrics.purchases / totalMarket.purchases : 0,
      }
    })

    // Calculate summary data from time series
    const summary = timeSeries.reduce((acc: any, row: any) => ({
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      cartAdds: acc.cartAdds + row.cartAdds,
      purchases: acc.purchases + row.purchases,
    }), { impressions: 0, clicks: 0, cartAdds: 0, purchases: 0 })
    
    // Add calculated rates
    summary.ctr = summary.impressions > 0 ? summary.clicks / summary.impressions : 0
    summary.cvr = summary.impressions > 0 ? summary.purchases / summary.impressions : 0

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
      const { data: comparisonTimeSeriesData } = await supabase
        .from('search_query_performance')
        .select(`
          start_date,
          asin_impression_count,
          asin_click_count,
          asin_cart_add_count,
          asin_purchase_count
        `)
        .eq('asin', asin)
        .eq('search_query', keyword)
        .gte('start_date', compareStartDate)
        .lte('start_date', compareEndDate)
        .order('start_date', { ascending: true })

      if (comparisonTimeSeriesData) {
        response.comparisonTimeSeries = comparisonTimeSeriesData.map((row: any) => ({
          date: row.start_date,
          impressions: row.asin_impression_count || 0,
          clicks: row.asin_click_count || 0,
          cartAdds: row.asin_cart_add_count || 0,
          purchases: row.asin_purchase_count || 0,
          ctr: row.asin_impression_count > 0 ? (row.asin_click_count / row.asin_impression_count) : 0,
          cvr: row.asin_impression_count > 0 ? (row.asin_purchase_count / row.asin_impression_count) : 0,
        }))
      }

      // Calculate comparison funnel data and summary from time series
      if (response.comparisonTimeSeries) {
        response.comparisonFunnelData = response.comparisonTimeSeries.reduce((acc: any, row: any) => ({
          impressions: acc.impressions + row.impressions,
          clicks: acc.clicks + row.clicks,
          cartAdds: acc.cartAdds + row.cartAdds,
          purchases: acc.purchases + row.purchases,
        }), { impressions: 0, clicks: 0, cartAdds: 0, purchases: 0 })
        
        // Add comparison summary
        response.comparisonSummary = {
          ...response.comparisonFunnelData,
          ctr: response.comparisonFunnelData.impressions > 0 
            ? response.comparisonFunnelData.clicks / response.comparisonFunnelData.impressions 
            : 0,
          cvr: response.comparisonFunnelData.impressions > 0 
            ? response.comparisonFunnelData.purchases / response.comparisonFunnelData.impressions 
            : 0,
        }
      }

      // Fetch comparison market share data
      const comparisonAsinMetrics = new Map()
      
      // Fetch all records for comparison period
      const { data: comparisonRecords } = await supabase
        .from('search_query_performance')
        .select(`
          asin,
          asin_impression_count,
          asin_click_count,
          asin_purchase_count
        `)
        .eq('search_query', keyword)
        .gte('start_date', compareStartDate)
        .lte('start_date', compareEndDate)
      
      // Aggregate comparison metrics
      const comparisonAsinData = new Map()
      comparisonRecords?.forEach((row: any) => {
        const currentMetrics = comparisonAsinMetrics.get(row.asin) || {
          impressions: 0,
          clicks: 0,
          purchases: 0
        }
        
        comparisonAsinMetrics.set(row.asin, {
          impressions: currentMetrics.impressions + (row.asin_impression_count || 0),
          clicks: currentMetrics.clicks + (row.asin_click_count || 0),
          purchases: currentMetrics.purchases + (row.asin_purchase_count || 0),
        })
      })
      
      // Fetch product titles and brand data for comparison period ASINs
      const comparisonAsinSet = new Set(comparisonRecords?.map((row: any) => row.asin) || [])
      const comparisonUniqueAsins = Array.from(comparisonAsinSet)
      
      // Fetch comparison product titles
      const { data: comparisonAsinTitles } = comparisonUniqueAsins.length > 0 ? await supabase
        .from('asin_performance_data')
        .select('asin, product_title')
        .in('asin', comparisonUniqueAsins) : { data: [] }
      
      // Fetch comparison brand mappings
      const { data: comparisonBrandMappings } = comparisonUniqueAsins.length > 0 ? await supabase
        .from('asin_brand_mapping')
        .select('asin, brand_id')
        .in('asin', comparisonUniqueAsins) : { data: [] }
      
      // Fetch comparison brand names for the brand IDs
      const comparisonBrandIds = comparisonBrandMappings?.map((mapping: any) => mapping.brand_id).filter(Boolean) || []
      const { data: comparisonBrandData } = comparisonBrandIds.length > 0 ? await supabase
        .from('brands')
        .select('id, brand_name')
        .in('id', comparisonBrandIds) : { data: [] }
      
      // Create comparison lookup maps
      const comparisonTitleMap = new Map(comparisonAsinTitles?.map((item: any) => [item.asin, item.product_title]) || [])
      const comparisonBrandIdMap = new Map(comparisonBrandMappings?.map((item: any) => [item.asin, item.brand_id]) || [])
      const comparisonBrandNameMap = new Map(comparisonBrandData?.map((item: any) => [item.id, item.brand_name]) || [])
      
      // Build comparison ASIN data map
      comparisonUniqueAsins.forEach((asin) => {
        const brandId = comparisonBrandIdMap.get(asin)
        const brandName = brandId ? comparisonBrandNameMap.get(brandId) : null
        
        comparisonAsinData.set(asin, {
          asin: asin,
          title: comparisonTitleMap.get(asin) || 'Unknown Product',
          brand: brandName || 'Unknown',
        })
      })
      
      // Calculate comparison total market
      const comparisonTotalMarket = Array.from(comparisonAsinMetrics.values()).reduce((acc: any, metrics: any) => ({
        impressions: acc.impressions + metrics.impressions,
        clicks: acc.clicks + metrics.clicks,
        purchases: acc.purchases + metrics.purchases,
      }), { impressions: 0, clicks: 0, purchases: 0 })
      
      // Build comparison competitor data
      const comparisonCompetitors = Array.from(comparisonAsinData.values()).map((asinData: any) => {
        const metrics = comparisonAsinMetrics.get(asinData.asin) || { impressions: 0, clicks: 0, purchases: 0 }
        return {
          asin: asinData.asin,
          brand: asinData.brand,
          title: asinData.title,
          impressionShare: comparisonTotalMarket.impressions > 0 ? metrics.impressions / comparisonTotalMarket.impressions : 0,
          clickShare: comparisonTotalMarket.clicks > 0 ? metrics.clicks / comparisonTotalMarket.clicks : 0,
          purchaseShare: comparisonTotalMarket.purchases > 0 ? metrics.purchases / comparisonTotalMarket.purchases : 0,
        }
      })
      
      response.comparisonMarketShare = {
        totalMarket: comparisonTotalMarket,
        competitors: comparisonCompetitors,
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