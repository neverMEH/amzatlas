import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const searchParams = request.nextUrl.searchParams
    
    const brandId = searchParams.get('brandId')
    const trendType = searchParams.get('trendType')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Build query for the top trending keywords materialized view
    let query = supabase
      .from('top_trending_keywords')
      .select('*')

    if (brandId) {
      query = query.eq('brand_id', brandId)
    }
    
    if (trendType) {
      query = query.eq('trend_classification', trendType)
    }

    query = query.order('rank_in_category', { ascending: true })
      .limit(limit)

    const { data, error } = await query

    if (error) {
      console.error('Error fetching top trending keywords:', error)
      return NextResponse.json(
        { error: 'Failed to fetch top trending keywords' },
        { status: 500 }
      )
    }

    // Group by trend classification
    const groupedData = (data || []).reduce((acc: any, item: any) => {
      if (!acc[item.trend_classification]) {
        acc[item.trend_classification] = []
      }
      acc[item.trend_classification].push(item)
      return acc
    }, {} as Record<string, any[]>)

    // Calculate insights for each keyword
    const enrichedData = (data || []).map((item: any) => ({
      ...item,
      insights: generateKeywordInsights(item),
      competitionLevel: calculateCompetitionLevel(item),
      opportunityScore: calculateOpportunityScore(item)
    }))

    // Find cross-ASIN opportunities (same query, multiple ASINs)
    const crossAsinOpportunities = findCrossAsinOpportunities(data || [])

    return NextResponse.json({
      filters: {
        brandId,
        trendType,
        limit
      },
      summary: {
        totalKeywords: data?.length || 0,
        trendBreakdown: Object.entries(groupedData).map(([trend, items]: [string, any]) => ({
          trend,
          count: items.length,
          avgImpressions: items.reduce((sum: number, item: any) => sum + item.impressions, 0) / items.length,
          totalImpressions: items.reduce((sum: number, item: any) => sum + item.impressions, 0)
        })),
        topOpportunity: enrichedData.reduce((best: any, item: any) => 
          item.opportunityScore > best.opportunityScore ? item : best
        , enrichedData[0] || {})
      },
      data: enrichedData,
      grouped: groupedData,
      crossAsinOpportunities
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateKeywordInsights(keyword: any): string[] {
  const insights = []
  
  // Trend-based insights
  if (keyword.trend_classification === 'strong_growth' && keyword.impressions_trend > 1000) {
    insights.push('Rapid growth trajectory - prime for investment')
  }
  
  if (keyword.impressions_volatility > 0.5) {
    insights.push('High volatility - monitor daily for stability')
  }
  
  // Performance insights
  if (keyword.cvr > 5 && keyword.impressions > 10000) {
    insights.push('High-value keyword with excellent conversion')
  }
  
  if (keyword.impressions_vs_avg_pct > 100) {
    insights.push('Currently performing 2x above average')
  }
  
  // Competition insights
  if (keyword.query_asin_count > 10 && keyword.rank_in_category <= 5) {
    insights.push('Leading position in competitive query')
  }
  
  return insights
}

function calculateCompetitionLevel(keyword: any): {
  level: 'low' | 'medium' | 'high'
  score: number
  reason: string
} {
  const asinCount = keyword.query_asin_count || 0
  const totalImpressions = keyword.total_query_impressions || 0
  
  let score = 0
  let level: 'low' | 'medium' | 'high' = 'low'
  let reason = ''
  
  if (asinCount <= 5) {
    score = 20
    level = 'low'
    reason = 'Few competing ASINs'
  } else if (asinCount <= 15) {
    score = 50
    level = 'medium'
    reason = 'Moderate competition'
  } else {
    score = 80
    level = 'high'
    reason = `${asinCount} competing ASINs`
  }
  
  // Adjust based on impression share
  const impressionShare = keyword.impressions / totalImpressions
  if (impressionShare > 0.3) {
    score -= 10
    reason += ', but strong market share'
  }
  
  return { level, score: Math.max(0, Math.min(100, score)), reason }
}

function calculateOpportunityScore(keyword: any): number {
  let score = 50 // Base score
  
  // Trend factors
  if (keyword.trend_classification === 'strong_growth') score += 20
  if (keyword.trend_classification === 'moderate_growth') score += 10
  if (keyword.trend_classification === 'strong_decline') score -= 20
  
  // Performance factors
  if (keyword.impressions > 10000) score += 10
  if (keyword.cvr > 3) score += 15
  if (keyword.ctr > 2) score += 10
  
  // Competition factors
  if (keyword.query_asin_count < 10) score += 10
  if (keyword.rank_in_category <= 3) score += 15
  
  // Volatility penalty
  if (keyword.impressions_volatility > 0.5) score -= 10
  
  return Math.max(0, Math.min(100, score))
}

function findCrossAsinOpportunities(keywords: any[]): any[] {
  const queryGroups = new Map()
  
  // Group by search query
  keywords.forEach((keyword: any) => {
    if (!queryGroups.has(keyword.search_query)) {
      queryGroups.set(keyword.search_query, [])
    }
    queryGroups.get(keyword.search_query).push(keyword)
  })
  
  // Find queries with multiple ASINs where at least one is performing well
  const opportunities: any[] = []
  
  queryGroups.forEach((group: any, query: string) => {
    if (group.length >= 2) {
      const bestPerformer = group.reduce((best: any, item: any) => 
        item.impressions > best.impressions ? item : best
      )
      
      const worstPerformer = group.reduce((worst: any, item: any) => 
        item.impressions < worst.impressions ? item : worst
      )
      
      if (bestPerformer.impressions > worstPerformer.impressions * 2) {
        opportunities.push({
          searchQuery: query,
          totalAsins: group.length,
          bestAsin: {
            asin: bestPerformer.asin,
            impressions: bestPerformer.impressions,
            trend: bestPerformer.trend_classification
          },
          opportunityAsins: group
            .filter((item: any) => item.impressions < bestPerformer.impressions * 0.5)
            .map((item: any) => ({
              asin: item.asin,
              impressions: item.impressions,
              potential: bestPerformer.impressions - item.impressions
            })),
          totalPotential: group
            .filter((item: any) => item !== bestPerformer)
            .reduce((sum: number, item: any) => sum + (bestPerformer.impressions - item.impressions), 0)
        })
      }
    }
  })
  
  return opportunities
    .sort((a, b) => b.totalPotential - a.totalPotential)
    .slice(0, 10)
}