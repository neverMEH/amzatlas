import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    
    const {
      periodType = 'week',
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
      brandId,
      asinList,
      minImpressions = 100
    } = body

    // Validate period type
    const validPeriods = ['day', 'week', 'month', 'quarter', 'year', 'custom']
    if (!validPeriods.includes(periodType)) {
      return NextResponse.json(
        { error: 'Invalid period type' },
        { status: 400 }
      )
    }

    // For custom periods, dates are required
    if (periodType === 'custom' && (!currentStart || !currentEnd || !previousStart || !previousEnd)) {
      return NextResponse.json(
        { error: 'Custom period requires all date parameters' },
        { status: 400 }
      )
    }

    // Call the flexible comparison function
    const { data, error } = await supabase.rpc('compare_periods_flexible', {
      p_period_type: periodType,
      p_current_start: currentStart || null,
      p_current_end: currentEnd || null,
      p_previous_start: previousStart || null,
      p_previous_end: previousEnd || null,
      p_brand_id: brandId || null,
      p_asin_list: asinList || null,
      p_min_impressions: minImpressions
    })

    if (error) {
      console.error('Error calling comparison function:', error)
      return NextResponse.json(
        { error: 'Failed to compare periods' },
        { status: 500 }
      )
    }

    // Process and enhance the data
    const processedData = (data || []).map(row => ({
      ...row,
      performanceCategory: categorizePerformance(row),
      insights: generateInsights(row)
    }))

    // Calculate aggregate statistics
    const stats = calculateAggregateStats(processedData)

    return NextResponse.json({
      periodType,
      dateRange: {
        current: { start: currentStart, end: currentEnd },
        previous: { start: previousStart, end: previousEnd }
      },
      filters: {
        brandId,
        asinList,
        minImpressions
      },
      stats,
      data: processedData,
      count: processedData.length
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function categorizePerformance(row: any) {
  const impressionChange = row.o_impressions_change_pct || 0
  const cvrChange = row.o_cvr_change_pct || 0
  const revenueChange = row.o_revenue_change_pct || 0

  if (impressionChange > 20 && cvrChange > 10) return 'star_performer'
  if (impressionChange > 20 && cvrChange <= 10) return 'traffic_growth'
  if (impressionChange <= 0 && cvrChange > 10) return 'conversion_improvement'
  if (impressionChange < -20 && cvrChange < -10) return 'needs_attention'
  if (Math.abs(impressionChange) <= 5 && Math.abs(cvrChange) <= 5) return 'stable'
  return 'mixed'
}

function generateInsights(row: any) {
  const insights = []
  
  // Traffic insights
  if (row.o_impressions_change_pct > 50) {
    insights.push('Significant traffic surge detected')
  } else if (row.o_impressions_change_pct < -50) {
    insights.push('Major traffic decline requires investigation')
  }

  // Conversion insights
  if (row.o_cvr_change_pct > 20 && row.o_current_cvr > 5) {
    insights.push('Excellent conversion improvement')
  } else if (row.o_current_cvr < 1 && row.o_clicks_current > 100) {
    insights.push('Low conversion rate despite high traffic')
  }

  // Cart abandonment insights
  if (row.o_cart_add_rate_current > 20 && row.o_cart_to_purchase_rate_current < 50) {
    insights.push('High cart abandonment - consider checkout optimization')
  }

  // Price insights
  if (row.o_current_median_price > row.o_previous_median_price * 1.1) {
    insights.push('Price increase may be affecting performance')
  }

  return insights
}

function calculateAggregateStats(data: any[]) {
  if (data.length === 0) {
    return {
      overview: {},
      distribution: {},
      topMetrics: {}
    }
  }

  const validData = data.filter(d => d.o_impressions_change_pct !== null)
  
  return {
    overview: {
      totalKeywords: validData.length,
      avgImpressionChange: validData.reduce((sum, d) => sum + d.o_impressions_change_pct, 0) / validData.length,
      avgCvrChange: validData.reduce((sum, d) => sum + (d.o_cvr_change_pct || 0), 0) / validData.length,
      avgRevenueChange: validData.reduce((sum, d) => sum + (d.o_revenue_change_pct || 0), 0) / validData.length,
      totalCurrentRevenue: validData.reduce((sum, d) => sum + (d.o_current_revenue || 0), 0),
      totalPreviousRevenue: validData.reduce((sum, d) => sum + (d.o_previous_revenue || 0), 0)
    },
    distribution: {
      improved: validData.filter(d => d.o_impressions_change_pct > 5).length,
      declined: validData.filter(d => d.o_impressions_change_pct < -5).length,
      stable: validData.filter(d => Math.abs(d.o_impressions_change_pct) <= 5).length,
      starPerformers: validData.filter(d => d.performanceCategory === 'star_performer').length,
      needsAttention: validData.filter(d => d.performanceCategory === 'needs_attention').length
    },
    topMetrics: {
      highestGrowth: validData.reduce((max, d) => 
        d.o_impressions_change_pct > max.o_impressions_change_pct ? d : max
      , validData[0]),
      biggestDecline: validData.reduce((min, d) => 
        d.o_impressions_change_pct < min.o_impressions_change_pct ? d : min
      , validData[0]),
      highestRevenue: validData.reduce((max, d) => 
        (d.o_current_revenue || 0) > (max.o_current_revenue || 0) ? d : max
      , validData[0])
    }
  }
}