import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateComparison } from '@/lib/utils/sparkline'

interface SegmentParams {
  params: {
    brandId: string
    asin: string
  }
}

export async function GET(
  request: NextRequest,
  { params }: SegmentParams
) {
  const startTime = performance.now()
  
  try {
    const { brandId, asin } = params
    const searchParams = request.nextUrl.searchParams
    
    // Parse parameters
    const dateFrom = searchParams.get('dateFrom') || searchParams.get('date_from')
    const dateTo = searchParams.get('dateTo') || searchParams.get('date_to')
    const comparisonDateFrom = searchParams.get('comparisonDateFrom') || searchParams.get('comparison_date_from')
    const comparisonDateTo = searchParams.get('comparisonDateTo') || searchParams.get('comparison_date_to')
    const segmentType = searchParams.get('segmentType') || 'weekly'
    const expandToSubSegments = searchParams.get('expandToSubSegments') === 'true'
    
    // Pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0)
    
    // Validate parameters
    if (limit < 1 || limit > 500) {
      return NextResponse.json(
        { 
          error: { 
            code: 'INVALID_PARAMETER', 
            message: 'Limit must be between 1 and 500' 
          } 
        },
        { status: 400 }
      )
    }
    
    // Validate date formats
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (dateFrom && !dateRegex.test(dateFrom)) {
      return NextResponse.json(
        { 
          error: { 
            code: 'INVALID_DATE_FORMAT', 
            message: 'Date must be in YYYY-MM-DD format' 
          } 
        },
        { status: 400 }
      )
    }
    if (dateTo && !dateRegex.test(dateTo)) {
      return NextResponse.json(
        { 
          error: { 
            code: 'INVALID_DATE_FORMAT', 
            message: 'Date must be in YYYY-MM-DD format' 
          } 
        },
        { status: 400 }
      )
    }
    
    // Validate segment type
    const validSegmentTypes = ['weekly', 'monthly', 'quarterly', 'yearly']
    if (!validSegmentTypes.includes(segmentType)) {
      return NextResponse.json(
        { 
          error: { 
            code: 'INVALID_PARAMETER', 
            message: `segmentType must be one of: ${validSegmentTypes.join(', ')}` 
          } 
        },
        { status: 400 }
      )
    }
    
    const supabase = createClient()
    
    // Verify brand and ASIN exist
    const { data: brandAsin, error: brandAsinError } = await supabase
      .from('asin_brand_mapping')
      .select(`
        asin,
        product_title,
        brands!inner(id, brand_name, is_active)
      `)
      .eq('brand_id', brandId)
      .eq('asin', asin)
      .single()
    
    if (brandAsinError || !brandAsin) {
      return NextResponse.json(
        { error: { code: 'ASIN_NOT_FOUND', message: 'ASIN not found for this brand' } },
        { 
          status: 404,
          headers: { 'Cache-Control': 'no-cache' }
        }
      )
    }
    
    // Build main query for segments
    let query = supabase
      .from('brand_product_segments')
      .select(`
        brand_id,
        brand_name,
        asin,
        product_name,
        segment_type,
        segment_start_date,
        segment_end_date,
        total_impressions,
        total_clicks,
        total_cart_adds,
        total_purchases,
        click_through_rate,
        conversion_rate,
        cart_add_rate,
        click_share,
        cart_add_share,
        purchase_share,
        query_count,
        top_query,
        data_quality
      `)
      .eq('brand_id', brandId)
      .eq('asin', asin)
      .eq('segment_type', segmentType)
    
    // Apply date filters
    if (dateFrom) {
      query = query.gte('segment_start_date', dateFrom)
    }
    if (dateTo) {
      query = query.lte('segment_end_date', dateTo)
    }
    
    // Order by date
    query = query.order('segment_start_date', { ascending: true })
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1)
    
    const { data: segments, error: segmentsError } = await query
    
    if (segmentsError) {
      console.error('Database error:', segmentsError)
      return NextResponse.json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch segment data' } },
        { 
          status: 500,
          headers: { 'Cache-Control': 'no-cache' }
        }
      )
    }
    
    // Get comparison data if requested
    let comparisonSegments: any[] = []
    if (comparisonDateFrom && comparisonDateTo) {
      const { data: compData } = await supabase
        .from('brand_product_segments')
        .select(`
          segment_start_date,
          total_impressions,
          total_clicks,
          total_cart_adds,
          total_purchases,
          click_through_rate,
          conversion_rate,
          cart_add_rate
        `)
        .eq('brand_id', brandId)
        .eq('asin', asin)
        .eq('segment_type', segmentType)
        .gte('segment_start_date', comparisonDateFrom)
        .lte('segment_end_date', comparisonDateTo)
        .order('segment_start_date', { ascending: true })
      
      comparisonSegments = compData || []
    }
    
    // Format segments with comparison data
    const formattedSegments = (segments || []).map((segment: any, index: number) => {
      const comparison = comparisonSegments[index] // Match by index for time series comparison
      
      const result: any = {
        segmentId: `${segment.asin}-${segment.segment_start_date}-${segment.segment_end_date}`,
        segmentType: segment.segment_type,
        startDate: segment.segment_start_date,
        endDate: segment.segment_end_date,
        impressions: segment.total_impressions || 0,
        clicks: segment.total_clicks || 0,
        cartAdds: segment.total_cart_adds || 0,
        purchases: segment.total_purchases || 0,
        ctr: segment.click_through_rate || 0,
        cvr: segment.conversion_rate || 0,
        cartAddRate: segment.cart_add_rate || 0,
        clickShare: segment.click_share || 0,
        cartAddShare: segment.cart_add_share || 0,
        purchaseShare: segment.purchase_share || 0,
        queryCount: segment.query_count || 0,
        topQuery: segment.top_query,
        dataQuality: segment.data_quality
      }
      
      // Add comparison data if available
      if (comparison) {
        result.impressionsComparison = calculateComparison(segment.total_impressions, comparison.total_impressions)
        result.clicksComparison = calculateComparison(segment.total_clicks, comparison.total_clicks)
        result.cartAddsComparison = calculateComparison(segment.total_cart_adds, comparison.total_cart_adds)
        result.purchasesComparison = calculateComparison(segment.total_purchases, comparison.total_purchases)
        result.ctrComparison = calculateComparison(segment.click_through_rate, comparison.click_through_rate)
        result.cvrComparison = calculateComparison(segment.conversion_rate, comparison.conversion_rate)
      }
      
      // Add sub-segments if expansion is requested and segment is longer than weekly
      if (expandToSubSegments && segmentType !== 'weekly') {
        result.canExpand = true
        result.subSegmentCount = estimateSubSegmentCount(segment.segment_start_date, segment.segment_end_date, segmentType)
      }
      
      return result
    })
    
    // Get metadata about available segments
    const { data: metadata } = await supabase.rpc('get_product_segment_metadata', {
      p_brand_id: brandId,
      p_asin: asin,
      p_segment_type: segmentType
    })
    
    // Calculate totals for the period
    const totals = formattedSegments.reduce((acc: any, segment: any) => ({
      impressions: acc.impressions + segment.impressions,
      clicks: acc.clicks + segment.clicks,
      cartAdds: acc.cartAdds + segment.cartAdds,
      purchases: acc.purchases + segment.purchases,
      queryCount: acc.queryCount + segment.queryCount
    }), { impressions: 0, clicks: 0, cartAdds: 0, purchases: 0, queryCount: 0 })
    
    // Calculate overall rates
    totals.ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0
    totals.cvr = totals.clicks > 0 ? totals.purchases / totals.clicks : 0
    totals.cartAddRate = totals.clicks > 0 ? totals.cartAdds / totals.clicks : 0
    
    // Get total count for pagination
    let totalCountQuery = supabase
      .from('brand_product_segments')
      .select('segment_start_date', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .eq('asin', asin)
      .eq('segment_type', segmentType)
    
    if (dateFrom) {
      totalCountQuery = totalCountQuery.gte('segment_start_date', dateFrom)
    }
    if (dateTo) {
      totalCountQuery = totalCountQuery.lte('segment_end_date', dateTo)
    }
    
    const { count: totalCount } = await totalCountQuery
    
    const queryTime = performance.now() - startTime
    
    const response = {
      data: {
        segments: formattedSegments,
        totals,
        segmentMetadata: metadata || {
          availableSegmentTypes: ['weekly'],
          totalSegmentsAvailable: formattedSegments.length,
          dateRange: {
            earliest: formattedSegments[0]?.startDate,
            latest: formattedSegments[formattedSegments.length - 1]?.endDate
          }
        }
      },
      meta: {
        brand: {
          id: brandId,
          brand_name: brandAsin.brands?.brand_name
        },
        product: {
          asin,
          productName: brandAsin.product_title
        },
        segmentType,
        expandToSubSegments,
        totalCount: totalCount || 0,
        limit,
        offset,
        hasMore: (totalCount || 0) > offset + limit,
        queryTime: Math.round(queryTime),
        dateRange: dateFrom && dateTo ? {
          from: dateFrom,
          to: dateTo
        } : null,
        comparisonDateRange: comparisonDateFrom && comparisonDateTo ? {
          from: comparisonDateFrom,
          to: comparisonDateTo
        } : null
      }
    }
    
    // Cache successful responses for 10 minutes (segment data is more static)
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=600, stale-while-revalidate=1200'
      }
    })
    
  } catch (error) {
    console.error('Error in brand product segments API:', error)
    return NextResponse.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch segment data' } },
      { 
        status: 500,
        headers: { 'Cache-Control': 'no-cache' }
      }
    )
  }
}

// Helper function to estimate sub-segment count
function estimateSubSegmentCount(startDate: string, endDate: string, segmentType: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  
  switch (segmentType) {
    case 'monthly':
      return Math.ceil(diffDays / 7) // Approximate weekly segments
    case 'quarterly':
      return Math.ceil(diffDays / 30) // Approximate monthly segments  
    case 'yearly':
      return Math.ceil(diffDays / 91) // Approximate quarterly segments
    default:
      return 1
  }
}