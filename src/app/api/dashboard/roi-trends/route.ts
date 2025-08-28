import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { format, subDays } from 'date-fns'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  try {
    const searchParams = request.nextUrl.searchParams
    const weeks = parseInt(searchParams.get('weeks') || '12', 10)
    
    const endDate = new Date()
    const startDate = subDays(endDate, weeks * 7)
    
    const { data, error } = await supabase
      .from('sqp.weekly_summary')
      .select('period_start, total_purchases, total_clicks')
      .gte('period_start', format(startDate, 'yyyy-MM-dd'))
      .lte('period_start', format(endDate, 'yyyy-MM-dd'))
      .order('period_start', { ascending: true })
    
    if (error) throw error
    
    // Group by week and calculate ROI
    const weeklyROI: any[] = []
    const weekMap = new Map() as Map<string, { purchases: number, clicks: number }>
    
    (data || []).forEach(row => {
      const week = format(new Date(row.period_start), "'W'w")
      if (!weekMap.has(week)) {
        weekMap.set(week, { purchases: 0, clicks: 0 })
      }
      const weekData = weekMap.get(week)!
      weekData.purchases += row.total_purchases
      weekData.clicks += row.total_clicks
    })
    
    weekMap.forEach((data, week) => {
      const spend = data.clicks * 0.50 // Estimate $0.50 CPC
      const revenue = data.purchases * 50 // $50 average order value
      const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0
      
      weeklyROI.push({
        period: week,
        roi: Math.round(roi),
        spend: Math.round(spend),
        revenue: Math.round(revenue)
      })
    })
    
    return NextResponse.json(weeklyROI)
  } catch (error) {
    console.error('Error fetching ROI trends:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ROI trends' },
      { status: 500 }
    )
  }
}