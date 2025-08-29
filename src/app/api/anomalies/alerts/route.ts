import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const searchParams = request.nextUrl.searchParams
    
    const brandId = searchParams.get('brandId')
    const priority = searchParams.get('priority') // high, medium, low
    const status = searchParams.get('status') || 'active' // active, acknowledged, resolved

    // Get recent anomalies that require alerts
    const { data: anomalies, error } = await supabase.rpc('detect_keyword_anomalies', {
      p_brand_id: brandId || null,
      p_threshold: 2, // Moderate threshold for alerts
      p_min_baseline_impressions: 500 // Higher baseline for alerts
    })

    if (error) {
      console.error('Error fetching anomaly alerts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch anomaly alerts' },
        { status: 500 }
      )
    }

    // Convert anomalies to alerts with priority and actionability
    const alerts = (anomalies || []).map((anomaly: any) => {
      const alertPriority = calculateAlertPriority(anomaly)
      const impact = calculateBusinessImpact(anomaly)
      
      return {
        id: `${anomaly.o_asin}_${anomaly.o_search_query}_${anomaly.o_week_date}`,
        timestamp: new Date().toISOString(),
        asin: anomaly.o_asin,
        brandId: anomaly.o_brand_id,
        searchQuery: anomaly.o_search_query,
        weekDate: anomaly.o_week_date,
        priority: alertPriority,
        status: 'active',
        type: getAlertType(anomaly),
        metrics: {
          impressions: {
            current: anomaly.o_current_impressions,
            baseline: anomaly.o_baseline_impressions,
            change: anomaly.o_impressions_pct_from_avg,
            zScore: anomaly.o_impressions_z_score
          },
          clicks: {
            current: anomaly.o_current_clicks,
            baseline: anomaly.o_baseline_clicks,
            change: anomaly.o_clicks_pct_from_avg,
            zScore: anomaly.o_clicks_z_score
          },
          purchases: {
            current: anomaly.o_current_purchases,
            baseline: anomaly.o_baseline_purchases,
            change: anomaly.o_purchases_pct_from_avg,
            zScore: anomaly.o_purchases_z_score
          }
        },
        impact,
        title: generateAlertTitle(anomaly),
        description: generateAlertDescription(anomaly),
        recommendations: getAlertRecommendations(anomaly, alertPriority)
      }
    })

    // Filter by priority if specified
    let filteredAlerts = alerts
    if (priority) {
      filteredAlerts = alerts.filter((alert: any) => alert.priority === priority)
    }

    // Sort by priority and impact
    filteredAlerts.sort((a: any, b: any) => {
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      }
      return b.impact.revenueImpact - a.impact.revenueImpact
    })

    // Group alerts by priority
    const groupedAlerts = {
      high: filteredAlerts.filter((a: any) => a.priority === 'high'),
      medium: filteredAlerts.filter((a: any) => a.priority === 'medium'),
      low: filteredAlerts.filter((a: any) => a.priority === 'low')
    }

    return NextResponse.json({
      filters: {
        brandId,
        priority,
        status
      },
      summary: {
        total: filteredAlerts.length,
        byPriority: {
          high: groupedAlerts.high.length,
          medium: groupedAlerts.medium.length,
          low: groupedAlerts.low.length
        },
        criticalAlerts: filteredAlerts.filter((a: any) => 
          a.priority === 'high' && Math.abs(a.impact.revenueImpact) > 1000
        ).length,
        estimatedTotalImpact: filteredAlerts.reduce((sum: number, a: any) => sum + Math.abs(a.impact.revenueImpact), 0)
      },
      alerts: filteredAlerts,
      grouped: groupedAlerts
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function calculateAlertPriority(anomaly: any): 'high' | 'medium' | 'low' {
  const maxZScore = Math.max(
    Math.abs(anomaly.o_impressions_z_score),
    Math.abs(anomaly.o_clicks_z_score),
    Math.abs(anomaly.o_purchases_z_score)
  )
  
  // High priority conditions
  if (maxZScore >= 3 || 
      (anomaly.o_purchases_z_score < -2 && anomaly.o_baseline_purchases > 50) ||
      (anomaly.o_impressions_z_score < -2.5 && anomaly.o_baseline_impressions > 10000)) {
    return 'high'
  }
  
  // Medium priority conditions
  if (maxZScore >= 2 || 
      (anomaly.o_purchases_z_score < -1.5 && anomaly.o_baseline_purchases > 20) ||
      (anomaly.o_clicks_z_score < -2 && anomaly.o_baseline_clicks > 500)) {
    return 'medium'
  }
  
  return 'low'
}

function calculateBusinessImpact(anomaly: any): any {
  const avgPrice = anomaly.o_baseline_purchases > 0 
    ? (anomaly.o_baseline_revenue / anomaly.o_baseline_purchases) 
    : 50 // Default price assumption
  
  const purchaseImpact = anomaly.o_current_purchases - anomaly.o_baseline_purchases
  const revenueImpact = purchaseImpact * avgPrice
  
  const conversionImpact = anomaly.o_current_cvr - anomaly.o_baseline_cvr
  const trafficImpact = anomaly.o_current_impressions - anomaly.o_baseline_impressions
  
  return {
    revenueImpact,
    purchaseImpact,
    conversionImpact,
    trafficImpact,
    impactLevel: Math.abs(revenueImpact) > 5000 ? 'severe' : 
                 Math.abs(revenueImpact) > 1000 ? 'significant' : 
                 Math.abs(revenueImpact) > 100 ? 'moderate' : 'minor'
  }
}

function getAlertType(anomaly: any): string {
  const types = []
  
  if (anomaly.o_impressions_z_score < -2) types.push('traffic_loss')
  if (anomaly.o_impressions_z_score > 2.5) types.push('traffic_spike')
  if (anomaly.o_purchases_z_score < -2) types.push('conversion_drop')
  if (anomaly.o_purchases_z_score > 2.5) types.push('conversion_surge')
  if (anomaly.o_clicks_z_score < -2 && anomaly.o_impressions_z_score > -1) types.push('ctr_decline')
  
  return types[0] || 'performance_anomaly'
}

function generateAlertTitle(anomaly: any): string {
  const maxMetric = [
    { metric: 'impressions', zScore: anomaly.o_impressions_z_score, change: anomaly.o_impressions_pct_from_avg },
    { metric: 'clicks', zScore: anomaly.o_clicks_z_score, change: anomaly.o_clicks_pct_from_avg },
    { metric: 'purchases', zScore: anomaly.o_purchases_z_score, change: anomaly.o_purchases_pct_from_avg }
  ].reduce((max, current) => 
    Math.abs(current.zScore) > Math.abs(max.zScore) ? current : max
  )
  
  const direction = maxMetric.zScore > 0 ? 'surge' : 'drop'
  const severity = Math.abs(maxMetric.zScore) >= 3 ? 'Extreme' : 
                   Math.abs(maxMetric.zScore) >= 2 ? 'Significant' : 'Notable'
  
  return `${severity} ${maxMetric.metric} ${direction} for "${anomaly.o_search_query}"`
}

function generateAlertDescription(anomaly: any): string {
  const parts = []
  
  if (Math.abs(anomaly.o_impressions_z_score) >= 2) {
    parts.push(`Impressions ${anomaly.o_impressions_z_score > 0 ? 'increased' : 'decreased'} by ${Math.abs(anomaly.o_impressions_pct_from_avg).toFixed(1)}%`)
  }
  
  if (Math.abs(anomaly.o_clicks_z_score) >= 2) {
    parts.push(`Clicks ${anomaly.o_clicks_z_score > 0 ? 'increased' : 'decreased'} by ${Math.abs(anomaly.o_clicks_pct_from_avg).toFixed(1)}%`)
  }
  
  if (Math.abs(anomaly.o_purchases_z_score) >= 2) {
    parts.push(`Purchases ${anomaly.o_purchases_z_score > 0 ? 'increased' : 'decreased'} by ${Math.abs(anomaly.o_purchases_pct_from_avg).toFixed(1)}%`)
  }
  
  return parts.join('. ') + ` compared to the 6-week average for ASIN ${anomaly.o_asin}.`
}

function getAlertRecommendations(anomaly: any, priority: string): string[] {
  const recommendations = []
  
  if (priority === 'high') {
    recommendations.push('Investigate immediately to prevent further impact')
  }
  
  if (anomaly.o_impressions_z_score < -2.5) {
    recommendations.push('Check keyword ranking and bid status')
    recommendations.push('Verify product availability and listing status')
  } else if (anomaly.o_impressions_z_score > 3) {
    recommendations.push('Ensure sufficient inventory to meet demand')
    recommendations.push('Consider increasing bids to maintain position')
  }
  
  if (anomaly.o_purchases_z_score < -2 && anomaly.o_clicks_z_score > -1) {
    recommendations.push('Review product page and pricing')
    recommendations.push('Check for new negative reviews')
  }
  
  if (anomaly.o_clicks_z_score < -2 && anomaly.o_impressions_z_score > -1) {
    recommendations.push('Optimize title and main image')
    recommendations.push('Review search term relevance')
  }
  
  return recommendations.slice(0, 3)
}