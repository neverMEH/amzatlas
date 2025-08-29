import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const searchParams = request.nextUrl.searchParams
    
    const brandId = searchParams.get('brandId')
    const metric = searchParams.get('metric') || 'impressions'
    const severity = searchParams.get('severity') // extreme, moderate, mild
    const dateRange = searchParams.get('dateRange') || '7d'
    const limit = parseInt(searchParams.get('limit') || '100')

    // Calculate date range
    const endDate = new Date()
    let startDate = new Date()
    
    switch (dateRange) {
      case '24h':
        startDate.setDate(startDate.getDate() - 1)
        break
      case '7d':
        startDate.setDate(startDate.getDate() - 7)
        break
      case '30d':
        startDate.setDate(startDate.getDate() - 30)
        break
      default:
        startDate.setDate(startDate.getDate() - 7)
    }

    // Detect anomalies using the database functions
    const { data, error } = await supabase.rpc('detect_keyword_anomalies', {
      p_brand_id: brandId || null,
      p_threshold: severity === 'extreme' ? 3 : severity === 'mild' ? 1.5 : 2,
      p_min_baseline_impressions: 100
    })

    if (error) {
      console.error('Error detecting anomalies:', error)
      return NextResponse.json(
        { error: 'Failed to detect anomalies' },
        { status: 500 }
      )
    }

    let anomalies = data || []

    // Filter by metric if specified
    if (metric !== 'all') {
      anomalies = anomalies.filter(a => {
        switch (metric) {
          case 'impressions':
            return Math.abs(a.o_impressions_z_score) >= (severity === 'extreme' ? 3 : severity === 'mild' ? 1.5 : 2)
          case 'clicks':
            return Math.abs(a.o_clicks_z_score) >= (severity === 'extreme' ? 3 : severity === 'mild' ? 1.5 : 2)
          case 'purchases':
            return Math.abs(a.o_purchases_z_score) >= (severity === 'extreme' ? 3 : severity === 'mild' ? 1.5 : 2)
          default:
            return true
        }
      })
    }

    // Limit results
    anomalies = anomalies.slice(0, limit)

    // Group anomalies by type and severity
    const summary = {
      totalAnomalies: anomalies.length,
      byMetric: {
        impressions: anomalies.filter(a => Math.abs(a.o_impressions_z_score) >= 1.5).length,
        clicks: anomalies.filter(a => Math.abs(a.o_clicks_z_score) >= 1.5).length,
        purchases: anomalies.filter(a => Math.abs(a.o_purchases_z_score) >= 1.5).length
      },
      bySeverity: {
        extreme: anomalies.filter(a => 
          Math.abs(a.o_impressions_z_score) >= 3 || 
          Math.abs(a.o_clicks_z_score) >= 3 || 
          Math.abs(a.o_purchases_z_score) >= 3
        ).length,
        moderate: anomalies.filter(a => 
          (Math.abs(a.o_impressions_z_score) >= 2 && Math.abs(a.o_impressions_z_score) < 3) ||
          (Math.abs(a.o_clicks_z_score) >= 2 && Math.abs(a.o_clicks_z_score) < 3) ||
          (Math.abs(a.o_purchases_z_score) >= 2 && Math.abs(a.o_purchases_z_score) < 3)
        ).length,
        mild: anomalies.filter(a => 
          (Math.abs(a.o_impressions_z_score) >= 1.5 && Math.abs(a.o_impressions_z_score) < 2) ||
          (Math.abs(a.o_clicks_z_score) >= 1.5 && Math.abs(a.o_clicks_z_score) < 2) ||
          (Math.abs(a.o_purchases_z_score) >= 1.5 && Math.abs(a.o_purchases_z_score) < 2)
        ).length
      },
      byDirection: {
        positive: anomalies.filter(a => a.o_impressions_z_score > 0).length,
        negative: anomalies.filter(a => a.o_impressions_z_score < 0).length
      }
    }

    // Enrich anomalies with insights
    const enrichedAnomalies = anomalies.map(anomaly => ({
      ...anomaly,
      severity: getAnomalySeverity(anomaly),
      type: getAnomalyType(anomaly),
      insights: generateAnomalyInsights(anomaly),
      recommendedActions: getRecommendedActions(anomaly)
    }))

    // Identify patterns across anomalies
    const patterns = identifyAnomalyPatterns(enrichedAnomalies)

    return NextResponse.json({
      filters: {
        brandId,
        metric,
        severity,
        dateRange
      },
      summary,
      patterns,
      anomalies: enrichedAnomalies
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function getAnomalySeverity(anomaly: any): 'extreme' | 'moderate' | 'mild' {
  const maxZScore = Math.max(
    Math.abs(anomaly.o_impressions_z_score),
    Math.abs(anomaly.o_clicks_z_score),
    Math.abs(anomaly.o_purchases_z_score)
  )
  
  if (maxZScore >= 3) return 'extreme'
  if (maxZScore >= 2) return 'moderate'
  return 'mild'
}

function getAnomalyType(anomaly: any): string {
  const types = []
  
  if (Math.abs(anomaly.o_impressions_z_score) >= 1.5) {
    types.push(anomaly.o_impressions_z_score > 0 ? 'traffic_surge' : 'traffic_drop')
  }
  
  if (Math.abs(anomaly.o_clicks_z_score) >= 1.5) {
    types.push(anomaly.o_clicks_z_score > 0 ? 'engagement_spike' : 'engagement_decline')
  }
  
  if (Math.abs(anomaly.o_purchases_z_score) >= 1.5) {
    types.push(anomaly.o_purchases_z_score > 0 ? 'conversion_boost' : 'conversion_collapse')
  }
  
  return types.join(', ') || 'multi_metric'
}

function generateAnomalyInsights(anomaly: any): string[] {
  const insights = []
  
  // Impression anomalies
  if (anomaly.o_impressions_z_score > 3) {
    insights.push(`Extreme traffic surge: ${anomaly.o_impressions_pct_from_avg.toFixed(1)}% above average`)
  } else if (anomaly.o_impressions_z_score < -3) {
    insights.push(`Severe traffic loss: ${Math.abs(anomaly.o_impressions_pct_from_avg).toFixed(1)}% below average`)
  }
  
  // Click anomalies relative to impressions
  if (anomaly.o_clicks_z_score > 2 && anomaly.o_impressions_z_score < 1) {
    insights.push('CTR improvement without traffic increase - content resonating better')
  } else if (anomaly.o_clicks_z_score < -2 && anomaly.o_impressions_z_score > 1) {
    insights.push('CTR decline despite traffic growth - review listing relevance')
  }
  
  // Purchase anomalies
  if (anomaly.o_purchases_z_score > 2 && anomaly.o_clicks_z_score < 1) {
    insights.push('Conversion rate spike - capitalize on improved performance')
  } else if (anomaly.o_purchases_z_score < -2) {
    insights.push('Conversion collapse requires immediate investigation')
  }
  
  // Multi-metric patterns
  if (anomaly.o_impressions_z_score > 2 && anomaly.o_clicks_z_score > 2 && anomaly.o_purchases_z_score < 1) {
    insights.push('High traffic and engagement but poor conversion - check pricing or availability')
  }
  
  return insights
}

function getRecommendedActions(anomaly: any): string[] {
  const actions = []
  
  const severity = getAnomalySeverity(anomaly)
  
  if (severity === 'extreme') {
    actions.push('Immediate investigation required')
  }
  
  // Positive anomalies
  if (anomaly.o_impressions_z_score > 2) {
    actions.push('Increase bid to maintain momentum')
    actions.push('Ensure inventory availability')
  }
  
  // Negative anomalies
  if (anomaly.o_impressions_z_score < -2) {
    actions.push('Check for listing suppression or policy violations')
    actions.push('Review competitive landscape changes')
  }
  
  if (anomaly.o_purchases_z_score < -2 && anomaly.o_current_purchases < anomaly.o_baseline_purchases * 0.5) {
    actions.push('Verify product availability and Buy Box ownership')
    actions.push('Check for negative reviews or ratings changes')
  }
  
  if (anomaly.o_clicks_z_score > 2 && anomaly.o_purchases_z_score < 0) {
    actions.push('Optimize product detail page for conversion')
    actions.push('Review pricing competitiveness')
  }
  
  return actions.slice(0, 3)
}

function identifyAnomalyPatterns(anomalies: any[]): any {
  const patterns = {
    brandWide: false,
    categorySpecific: new Map(),
    timeConcentrated: false,
    primaryMetricAffected: '',
    commonCharacteristics: []
  }
  
  if (anomalies.length < 3) return patterns
  
  // Check if anomalies are brand-wide
  const uniqueBrands = new Set(anomalies.map(a => a.o_brand_id))
  patterns.brandWide = uniqueBrands.size === 1 && anomalies.length > 10
  
  // Check metric concentration
  const metricCounts = {
    impressions: anomalies.filter(a => Math.abs(a.o_impressions_z_score) >= 2).length,
    clicks: anomalies.filter(a => Math.abs(a.o_clicks_z_score) >= 2).length,
    purchases: anomalies.filter(a => Math.abs(a.o_purchases_z_score) >= 2).length
  }
  
  patterns.primaryMetricAffected = Object.entries(metricCounts)
    .sort((a, b) => b[1] - a[1])[0][0]
  
  // Identify common characteristics
  if (anomalies.filter(a => a.o_impressions_z_score < -2).length > anomalies.length * 0.7) {
    patterns.commonCharacteristics.push('Widespread traffic decline')
  }
  
  if (anomalies.filter(a => a.o_purchases_z_score > 2).length > anomalies.length * 0.5) {
    patterns.commonCharacteristics.push('Broad conversion improvement')
  }
  
  return patterns
}