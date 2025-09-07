import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const searchParams = request.nextUrl.searchParams
    const brandId = searchParams.get('brandId')

    // Use the get_trend_distribution function
    const { data, error } = await supabase.rpc('get_trend_distribution', {
      p_brand_id: brandId || null
    })

    if (error) {
      console.error('Error fetching trend distribution:', error)
      return NextResponse.json(
        { error: 'Failed to fetch trend distribution' },
        { status: 500 }
      )
    }

    // Calculate percentages and additional insights
    const totalKeywords = (data || []).reduce((sum: number, item: any) => sum + item.keyword_count, 0)
    const totalImpressions = (data || []).reduce((sum: number, item: any) => sum + item.total_impressions, 0)
    
    const enhancedData = (data || []).map((item: any) => ({
      ...item,
      percentage: totalKeywords > 0 ? (item.keyword_count / totalKeywords) * 100 : 0,
      avgImpressionsPerKeyword: item.keyword_count > 0 ? item.avg_impressions : 0,
      impressionShare: totalImpressions > 0 ? (item.total_impressions / totalImpressions) * 100 : 0
    }))

    // Create a visual distribution chart data
    const chartData = enhancedData.map((item: any) => ({
      name: item.trend_type,
      value: item.keyword_count,
      percentage: item.percentage,
      fill: getTrendColor(item.trend_type)
    }))

    // Get overall health score
    const healthScore = calculateHealthScore(enhancedData)

    // Identify opportunities and risks
    const opportunities: any[] = []
    const risks: any[] = []

    enhancedData.forEach((item: any) => {
      if (['emerging', 'surging', 'growing'].includes(item.trend_type) && item.keyword_count > 0) {
        opportunities.push({
          type: item.trend_type,
          count: item.keyword_count,
          examples: item.example_keywords?.slice(0, 3) || [],
          action: getActionForTrend(item.trend_type, 'opportunity')
        })
      }
      
      if (['declining', 'plummeting', 'weakening'].includes(item.trend_type) && item.keyword_count > 0) {
        risks.push({
          type: item.trend_type,
          count: item.keyword_count,
          examples: item.example_keywords?.slice(0, 3) || [],
          action: getActionForTrend(item.trend_type, 'risk')
        })
      }
    })

    return NextResponse.json({
      brandId,
      summary: {
        totalKeywords,
        totalImpressions,
        healthScore,
        dominantTrend: enhancedData.reduce((max: any, item: any) => 
          item.keyword_count > max.keyword_count ? item : max
        , { keyword_count: 0, trend_type: 'none' }).trend_type
      },
      distribution: enhancedData,
      chartData,
      insights: {
        opportunities,
        risks,
        recommendations: generateRecommendations(enhancedData, healthScore)
      }
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function getTrendColor(trendType: string): string {
  const colorMap: Record<string, string> = {
    'emerging': '#10b981', // green
    'surging': '#059669', // dark green
    'growing': '#34d399', // light green
    'stable': '#6b7280', // gray
    'volatile': '#f59e0b', // amber
    'weakening': '#f97316', // orange
    'declining': '#ef4444', // red
    'plummeting': '#dc2626' // dark red
  }
  return colorMap[trendType] || '#9ca3af'
}

function calculateHealthScore(distribution: any[]): number {
  let score = 50 // Base score

  distribution.forEach((item: any) => {
    const weight = item.percentage / 100
    
    switch (item.trend_type) {
      case 'emerging':
      case 'surging':
        score += 30 * weight
        break
      case 'growing':
        score += 20 * weight
        break
      case 'stable':
        score += 10 * weight
        break
      case 'volatile':
        score -= 5 * weight
        break
      case 'weakening':
        score -= 15 * weight
        break
      case 'declining':
      case 'plummeting':
        score -= 25 * weight
        break
    }
  })

  return Math.max(0, Math.min(100, Math.round(score)))
}

function getActionForTrend(trendType: string, category: 'opportunity' | 'risk'): string {
  const actions: Record<string, { opportunity: string; risk: string }> = {
    'emerging': {
      opportunity: 'Increase budget allocation and optimize content',
      risk: ''
    },
    'surging': {
      opportunity: 'Maximize visibility with aggressive bidding',
      risk: ''
    },
    'growing': {
      opportunity: 'Maintain momentum with consistent optimization',
      risk: ''
    },
    'declining': {
      opportunity: '',
      risk: 'Review content relevance and competitive positioning'
    },
    'plummeting': {
      opportunity: '',
      risk: 'Urgent investigation needed - check for listing issues'
    },
    'weakening': {
      opportunity: '',
      risk: 'Monitor closely and prepare intervention strategies'
    }
  }
  
  return actions[trendType]?.[category] || ''
}

function generateRecommendations(distribution: any[], healthScore: number): string[] {
  const recommendations = []
  
  // Health score based recommendations
  if (healthScore < 40) {
    recommendations.push('Immediate attention required - majority of keywords are declining')
  } else if (healthScore > 70) {
    recommendations.push('Strong performance - focus on maintaining momentum')
  }

  // Distribution based recommendations
  const emergingCount = distribution.find(d => d.trend_type === 'emerging')?.keyword_count || 0
  const decliningCount = distribution.find(d => d.trend_type === 'declining')?.keyword_count || 0
  const volatileCount = distribution.find(d => d.trend_type === 'volatile')?.keyword_count || 0

  if (emergingCount > decliningCount * 2) {
    recommendations.push('Capitalize on emerging trends with increased investment')
  }
  
  if (volatileCount > distribution.reduce((sum: number, d: any) => sum + d.keyword_count, 0) * 0.2) {
    recommendations.push('High volatility detected - implement stabilization strategies')
  }

  if (decliningCount > emergingCount) {
    recommendations.push('Focus on reversing declining trends through content optimization')
  }

  return recommendations.slice(0, 3) // Return top 3 recommendations
}