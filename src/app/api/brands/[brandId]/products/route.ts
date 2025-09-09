import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateComparison } from '@/lib/utils/sparkline'

interface ProductParams {
  params: {
    brandId: string
  }
}

export async function GET(
  request: NextRequest,
  { params }: ProductParams
) {
  const startTime = performance.now()
  
  try {
    const { brandId } = params
    const searchParams = request.nextUrl.searchParams
    
    // Parse and validate parameters
    const dateFrom = searchParams.get('dateFrom') || searchParams.get('date_from')
    const dateTo = searchParams.get('dateTo') || searchParams.get('date_to')
    const comparisonDateFrom = searchParams.get('comparisonDateFrom') || searchParams.get('comparison_date_from')
    const comparisonDateTo = searchParams.get('comparisonDateTo') || searchParams.get('comparison_date_to')
    const includeSegments = searchParams.get('includeSegments') === 'true'
    
    // Pagination parameters
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0)
    
    // Filter parameters
    const minImpressions = parseInt(searchParams.get('minImpressions') || '0', 10)
    const sortBy = searchParams.get('sortBy') || 'impressions'
    const sortOrder = (searchParams.get('sortOrder') || 'desc').toLowerCase()
    
    // Validate limit
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { 
          error: { 
            code: 'INVALID_PARAMETER', 
            message: 'Limit must be between 1 and 100' 
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
    
    // Validate sort parameters
    const validSortColumns = ['impressions', 'clicks', 'cartAdds', 'purchases', 'ctr', 'cvr', 'productName']
    if (!validSortColumns.includes(sortBy)) {
      return NextResponse.json(
        { 
          error: { 
            code: 'INVALID_PARAMETER', 
            message: `Invalid sortBy parameter. Must be one of: ${validSortColumns.join(', ')}` 
          } 
        },
        { status: 400 }
      )
    }
    
    if (!['asc', 'desc'].includes(sortOrder)) {
      return NextResponse.json(
        { 
          error: { 
            code: 'INVALID_PARAMETER', 
            message: 'sortOrder must be either "asc" or "desc"' 
          } 
        },
        { status: 400 }
      )
    }
    
    const supabase = createClient()
    
    // Fetch brand information first
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, brand_name, is_active')
      .eq('id', brandId)
      .single()
    
    if (brandError || !brand) {
      return NextResponse.json(
        { error: { code: 'BRAND_NOT_FOUND', message: 'Brand not found' } },
        { 
          status: 404,
          headers: { 'Cache-Control': 'no-cache' }
        }
      )
    }
    
    // Build base query for brand product segments
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
    
    // Apply date filters
    if (dateFrom) {
      query = query.gte('segment_start_date', dateFrom)
    }
    if (dateTo) {
      query = query.lte('segment_end_date', dateTo)
    }
    
    // Apply filters
    if (minImpressions > 0) {
      query = query.gte('total_impressions', minImpressions)
    }
    
    // Apply sorting
    const sortMapping: Record<string, string> = {
      'impressions': 'total_impressions',
      'clicks': 'total_clicks', 
      'cartAdds': 'total_cart_adds',
      'purchases': 'total_purchases',
      'ctr': 'click_through_rate',
      'cvr': 'conversion_rate',
      'productName': 'product_name'
    }
    
    const dbSortColumn = sortMapping[sortBy] || 'total_impressions'
    query = query.order(dbSortColumn, { ascending: sortOrder === 'asc' })
    
    // Apply pagination
    query = query.range(offset, offset + limit - 1)
    
    const { data: segments, error: segmentsError } = await query
    
    if (segmentsError) {
      console.error('Database error:', segmentsError)
      return NextResponse.json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch brand products' } },
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
          asin,
          total_impressions,
          total_clicks,
          total_cart_adds,
          total_purchases
        `)
        .eq('brand_id', brandId)
        .gte('segment_start_date', comparisonDateFrom)
        .lte('segment_end_date', comparisonDateTo)
      
      comparisonSegments = compData || []
    }
    
    // Aggregate segments by ASIN for current period
    const productMap = new Map()
    segments?.forEach((segment: any) => {
      const asin = segment.asin
      if (!productMap.has(asin)) {
        productMap.set(asin, {
          asin,
          productName: segment.product_name,
          impressions: 0,
          clicks: 0,
          cartAdds: 0,
          purchases: 0,
          segments: []
        })
      }
      
      const product = productMap.get(asin)
      product.impressions += segment.total_impressions || 0
      product.clicks += segment.total_clicks || 0
      product.cartAdds += segment.total_cart_adds || 0
      product.purchases += segment.total_purchases || 0
      product.segments.push(segment)
    })
    
    // Aggregate comparison data by ASIN
    const comparisonMap = new Map()
    comparisonSegments.forEach((segment: any) => {
      const asin = segment.asin
      if (!comparisonMap.has(asin)) {
        comparisonMap.set(asin, {
          impressions: 0,
          clicks: 0,
          cartAdds: 0,
          purchases: 0
        })
      }
      
      const comp = comparisonMap.get(asin)
      comp.impressions += segment.total_impressions || 0
      comp.clicks += segment.total_clicks || 0
      comp.cartAdds += segment.total_cart_adds || 0
      comp.purchases += segment.total_purchases || 0
    })
    
    // Format products
    const products = Array.from(productMap.values()).map((product: any) => {
      const comparison = comparisonMap.get(product.asin)
      
      // Calculate current period rates (as percentages)
      const currentCtr = product.impressions > 0 ? (product.clicks / product.impressions) * 100 : 0
      const currentCvr = product.clicks > 0 ? (product.purchases / product.clicks) * 100 : 0
      
      const result: any = {
        asin: product.asin,
        productName: product.productName || product.asin,
        impressions: product.impressions,
        clicks: product.clicks,
        cartAdds: product.cartAdds,
        purchases: product.purchases,
        ctr: currentCtr,
        cvr: currentCvr,
        clickShare: product.segments[0]?.click_share || 0,
        cartAddShare: product.segments[0]?.cart_add_share || 0,
        purchaseShare: product.segments[0]?.purchase_share || 0
      }
      
      // Add comparison data if available
      if (comparison) {
        result.impressionsComparison = calculateComparison(product.impressions, comparison.impressions)
        result.clicksComparison = calculateComparison(product.clicks, comparison.clicks)
        result.cartAddsComparison = calculateComparison(product.cartAdds, comparison.cartAdds)
        result.purchasesComparison = calculateComparison(product.purchases, comparison.purchases)
        
        // Calculate comparison period rates and add CTR/CVR comparisons (as percentages)
        const comparisonCtr = comparison.impressions > 0 ? (comparison.clicks / comparison.impressions) * 100 : 0
        const comparisonCvr = comparison.clicks > 0 ? (comparison.purchases / comparison.clicks) * 100 : 0
        
        result.ctrComparison = comparisonCtr > 0 ? calculateComparison(currentCtr, comparisonCtr) : null
        result.cvrComparison = comparisonCvr > 0 ? calculateComparison(currentCvr, comparisonCvr) : null
      }
      
      // Add segment metadata if requested
      if (includeSegments) {
        const weeklySegments = product.segments.filter((s: any) => s.segment_type === 'weekly')
        const monthlySegments = product.segments.filter((s: any) => s.segment_type === 'monthly')
        
        result.segmentMetadata = {
          weeklySegmentsAvailable: weeklySegments.length,
          monthlySegmentsAvailable: monthlySegments.length,
          hasWeeklyData: weeklySegments.length > 0,
          hasMonthlyData: monthlySegments.length > 0,
          dateRange: {
            earliest: Math.min(...product.segments.map((s: any) => new Date(s.segment_start_date).getTime())),
            latest: Math.max(...product.segments.map((s: any) => new Date(s.segment_end_date).getTime()))
          }
        }
      }
      
      return result
    })
    
    // Get total count for pagination
    let totalCountQuery = supabase
      .from('brand_product_segments')
      .select('asin', { count: 'exact', head: true })
      .eq('brand_id', brandId)
    
    if (dateFrom) {
      totalCountQuery = totalCountQuery.gte('segment_start_date', dateFrom)
    }
    if (dateTo) {
      totalCountQuery = totalCountQuery.lte('segment_end_date', dateTo)
    }
    if (minImpressions > 0) {
      totalCountQuery = totalCountQuery.gte('total_impressions', minImpressions)
    }
    
    const { count: totalCount } = await totalCountQuery
    
    const queryTime = performance.now() - startTime
    
    const response = {
      data: {
        products,
      },
      meta: {
        brand: {
          id: brand.id,
          brand_name: brand.brand_name
        },
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
        } : null,
        filters: {
          minImpressions: minImpressions > 0 ? minImpressions : null,
          sortBy,
          sortOrder
        }
      }
    }
    
    // Cache successful responses for 5 minutes
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
      }
    })
    
  } catch (error) {
    console.error('Error in brand products API:', error)
    return NextResponse.json(
      { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch brand products' } },
      { 
        status: 500,
        headers: { 'Cache-Control': 'no-cache' }
      }
    )
  }
}