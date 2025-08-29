import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const searchParams = request.nextUrl.searchParams
    const brandId = searchParams.get('brandId')

    // Get anomaly summary using the summary function
    const { data, error } = await supabase.rpc('get_anomaly_summary', {
      p_brand_id: brandId || null,
      p_days: 7
    })

    if (error) {
      console.error('Error fetching anomaly summary:', error)
      return NextResponse.json(
        { error: 'Failed to fetch anomaly summary' },
        { status: 500 }
      )
    }

    const summary = data?.[0] || {}

    // Get recent anomaly trends
    const { data: trendData } = await supabase
      .from('keyword_trend_analysis')
      .select('anomaly_status, week_start, asin, search_query, impressions_zscore')
      .neq('anomaly_status', 'normal')
      .gte('week_start', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('week_start', { ascending: true })

    // Calculate weekly anomaly trends
    const weeklyTrends = new Map()
    
    trendData?.forEach(item => {
      const weekKey = new Date(item.week_start).toISOString().split('T')[0]
      if (!weeklyTrends.has(weekKey)) {
        weeklyTrends.set(weekKey, {
          week: weekKey,
          extreme: 0,
          moderate: 0,
          mild: 0,
          total: 0
        })
      }
      
      const week = weeklyTrends.get(weekKey)
      week.total++
      week[item.anomaly_status.replace('_anomaly', '')]++
    })

    const trends = Array.from(weeklyTrends.values()).sort((a, b) => a.week.localeCompare(b.week))

    // Get top affected products
    const { data: affectedProducts } = await supabase.rpc('detect_keyword_anomalies', {
      p_brand_id: brandId || null,
      p_threshold: 2,
      p_min_baseline_impressions: 1000
    })

    const topAffected = (affectedProducts || [])
      .sort((a, b) => Math.abs(b.o_impressions_z_score) - Math.abs(a.o_impressions_z_score))
      .slice(0, 10)
      .map(item => ({
        asin: item.o_asin,
        searchQuery: item.o_search_query,
        metric: 'impressions',
        currentValue: item.o_current_impressions,
        expectedValue: item.o_baseline_impressions,
        deviation: item.o_impressions_pct_from_avg,
        zScore: item.o_impressions_z_score,
        impact: calculateImpact(item)
      }))

    // Calculate risk scores
    const riskScore = calculateOverallRiskScore(summary, topAffected)

    // Generate insights
    const insights = generateSummaryInsights(summary, trends, topAffected)

    return NextResponse.json({
      brandId,
      period: '7 days',
      summary: {
        totalAnomalies: summary.o_total_anomalies || 0,
        extremeAnomalies: summary.o_extreme_anomalies || 0,
        moderateAnomalies: summary.o_moderate_anomalies || 0,
        mildAnomalies: summary.o_mild_anomalies || 0,
        affectedAsins: summary.o_affected_asins || 0,
        affectedQueries: summary.o_affected_queries || 0,
        avgImpressionsDeviation: summary.o_avg_impressions_deviation || 0,
        avgClicksDeviation: summary.o_avg_clicks_deviation || 0,
        avgPurchasesDeviation: summary.o_avg_purchases_deviation || 0,
        positiveAnomalies: summary.o_positive_anomalies || 0,
        negativeAnomalies: summary.o_negative_anomalies || 0
      },
      trends: {
        weekly: trends,
        direction: trends.length >= 2 
          ? trends[trends.length - 1].total > trends[trends.length - 2].total ? 'increasing' : 'decreasing'
          : 'stable'
      },
      topAffected,
      riskScore,
      insights,
      lastUpdated: new Date().toISOString()
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function calculateImpact(anomaly: any): {
  level: 'critical' | 'high' | 'medium' | 'low'
  score: number
} {
  const avgPrice = 50 // Default assumption
  const revenueImpact = (anomaly.o_current_purchases - anomaly.o_baseline_purchases) * avgPrice
  
  let score = 0
  let level: 'critical' | 'high' | 'medium' | 'low' = 'low'
  
  // Base score from z-scores
  score += Math.abs(anomaly.o_impressions_z_score) * 10
  score += Math.abs(anomaly.o_clicks_z_score) * 15
  score += Math.abs(anomaly.o_purchases_z_score) * 25
  
  // Adjust for baseline size
  if (anomaly.o_baseline_impressions > 10000) score *= 1.5
  if (anomaly.o_baseline_purchases > 100) score *= 2
  
  // Determine level
  if (score >= 100 || Math.abs(revenueImpact) > 5000) {
    level = 'critical'
  } else if (score >= 50 || Math.abs(revenueImpact) > 1000) {
    level = 'high'
  } else if (score >= 25 || Math.abs(revenueImpact) > 250) {
    level = 'medium'
  }
  
  return { level, score: Math.min(100, score) }
}

function calculateOverallRiskScore(summary: any, topAffected: any[]): {
  score: number
  level: 'critical' | 'high' | 'medium' | 'low'
  factors: string[]
} {
  let score = 0
  const factors = []
  
  // Factor in anomaly counts
  if (summary.o_extreme_anomalies > 0) {
    score += summary.o_extreme_anomalies * 20
    factors.push(`${summary.o_extreme_anomalies} extreme anomalies detected`)
  }
  
  if (summary.o_negative_anomalies > summary.o_positive_anomalies * 2) {
    score += 20
    factors.push('Predominantly negative anomalies')
  }
  
  // Factor in affected scope
  if (summary.o_affected_asins > 10) {
    score += 15
    factors.push(`${summary.o_affected_asins} ASINs affected`)
  }
  
  // Factor in severity of top affected
  const criticalCount = topAffected.filter(a => a.impact.level === 'critical').length
  if (criticalCount > 0) {
    score += criticalCount * 10
    factors.push(`${criticalCount} critical impact items`)
  }
  
  // Cap at 100
  score = Math.min(100, score)
  
  const level = score >= 70 ? 'critical' : 
                score >= 50 ? 'high' :
                score >= 30 ? 'medium' : 'low'
  
  return { score, level, factors }
}

function generateSummaryInsights(summary: any, trends: any[], topAffected: any[]): string[] {
  const insights = []
  
  // Anomaly volume insights
  if (summary.o_extreme_anomalies > 5) {
    insights.push('Unusually high number of extreme anomalies requires immediate attention')
  }
  
  // Trend insights
  if (trends.length >= 3) {
    const recent = trends.slice(-3)
    const increasing = recent.every((t, i) => i === 0 || t.total > recent[i-1].total)
    if (increasing) {
      insights.push('Anomaly frequency is increasing over the past 3 weeks')
    }
  }
  
  // Balance insights
  const negativeRatio = summary.o_negative_anomalies / (summary.o_total_anomalies || 1)
  if (negativeRatio > 0.75) {
    insights.push('Performance is significantly below expectations across multiple metrics')
  } else if (negativeRatio < 0.25) {
    insights.push('Mostly positive anomalies indicate strong performance or market changes')
  }
  
  // Impact insights
  const highImpactCount = topAffected.filter(a => 
    a.impact.level === 'critical' || a.impact.level === 'high'
  ).length
  
  if (highImpactCount >= 5) {
    insights.push(`${highImpactCount} products with high business impact need priority review`)
  }
  
  // Specific metric insights
  if (Math.abs(summary.o_avg_purchases_deviation) > 30) {
    insights.push(`Purchase patterns deviate ${Math.abs(summary.o_avg_purchases_deviation).toFixed(1)}% from normal`)
  }
  
  return insights.slice(0, 5) // Return top 5 insights
}