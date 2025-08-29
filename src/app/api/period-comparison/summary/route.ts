import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const searchParams = request.nextUrl.searchParams
    const brandId = searchParams.get('brandId')

    // Fetch data from all period comparison views using RPC
    const periods = ['week', 'month', 'quarter', 'year']
    const summaries = await Promise.all(
      periods.map(async (period: any) => {
        // Use RPC function to get period comparison data
        const { data, error } = await supabase.rpc('get_period_comparison', {
          p_comparison_type: period,
          p_brand_id: brandId,
          p_limit: 1000,
          p_offset: 0
        })

        if (error) {
          console.error(`Error fetching ${period} comparison:`, error)
          return null
        }

        // Calculate summary metrics
        const validData = (data || []).filter((d: any) => d.impressions_change_pct !== null)
        
        if (validData.length === 0) {
          return {
            period,
            hasData: false,
            metrics: {}
          }
        }

        // Group by positive/negative changes
        const improved = validData.filter((d: any) => d.impressions_change_pct > 0)
        const declined = validData.filter((d: any) => d.impressions_change_pct < 0)
        
        // Calculate top movers
        const topGainers = validData
          .filter((d: any) => d.impressions_change_pct > 0)
          .sort((a: any, b: any) => b.impressions_change_pct - a.impressions_change_pct)
          .slice(0, 5)
          .map((d: any) => ({
            asin: d.asin,
            searchQuery: d.search_query,
            changePercent: d.impressions_change_pct,
            currentValue: d.current_impressions,
            previousValue: d.previous_impressions
          }))

        const topDecliners = validData
          .filter((d: any) => d.impressions_change_pct < 0)
          .sort((a: any, b: any) => a.impressions_change_pct - b.impressions_change_pct)
          .slice(0, 5)
          .map((d: any) => ({
            asin: d.asin,
            searchQuery: d.search_query,
            changePercent: d.impressions_change_pct,
            currentValue: d.current_impressions,
            previousValue: d.previous_impressions
          }))

        return {
          period,
          hasData: true,
          metrics: {
            totalKeywords: validData.length,
            improvedCount: improved.length,
            declinedCount: declined.length,
            stableCount: validData.length - improved.length - declined.length,
            avgImpressionChange: validData.reduce((sum: number, d: any) => sum + d.impressions_change_pct, 0) / validData.length,
            avgCvrChange: validData.reduce((sum: number, d: any) => sum + (d.cvr_change_pct || 0), 0) / validData.length,
            avgRevenueChange: validData.reduce((sum: number, d: any) => sum + (d.revenue_change_pct || 0), 0) / validData.length,
            totalCurrentImpressions: validData.reduce((sum: number, d: any) => sum + (d.current_impressions || 0), 0),
            totalPreviousImpressions: validData.reduce((sum: number, d: any) => sum + (d.previous_impressions || 0), 0),
            totalCurrentRevenue: validData.reduce((sum: number, d: any) => sum + (d.current_revenue || 0), 0),
            totalPreviousRevenue: validData.reduce((sum: number, d: any) => sum + (d.previous_revenue || 0), 0),
          },
          topGainers,
          topDecliners
        }
      })
    )

    // Filter out null results and create response
    const validSummaries = summaries.filter((s: any) => s !== null)
    
    // Calculate overall metrics across all periods
    const overall = {
      bestPerformingPeriod: null as string | null,
      worstPerformingPeriod: null as string | null,
      mostVolatilePeriod: null as string | null,
      avgChangeByPeriod: {} as Record<string, number>
    }

    let bestChange = -Infinity
    let worstChange = Infinity
    let highestVolatility = 0

    validSummaries.forEach(summary => {
      if (summary?.hasData && summary.metrics) {
        const avgChange = summary.metrics.avgImpressionChange || 0
        overall.avgChangeByPeriod[summary.period] = avgChange

        if (avgChange > bestChange) {
          bestChange = avgChange
          overall.bestPerformingPeriod = summary.period
        }

        if (avgChange < worstChange) {
          worstChange = avgChange
          overall.worstPerformingPeriod = summary.period
        }

        // Calculate volatility as the spread between improved and declined
        const improvedCount = summary.metrics.improvedCount || 0
        const declinedCount = summary.metrics.declinedCount || 0
        const totalKeywords = summary.metrics.totalKeywords || 1
        const volatility = Math.abs(improvedCount - declinedCount) / totalKeywords
        if (volatility > highestVolatility) {
          highestVolatility = volatility
          overall.mostVolatilePeriod = summary.period
        }
      }
    })

    return NextResponse.json({
      brandId,
      summaries: validSummaries,
      overall,
      generatedAt: new Date().toISOString()
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}