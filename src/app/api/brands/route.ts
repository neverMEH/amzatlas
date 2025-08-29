import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')
    const includeStats = searchParams.get('includeStats') === 'true'
    const activeOnly = searchParams.get('activeOnly') !== 'false' // Default to true

    let query = supabase
      .from('brands')
      .select('*')
      .order('brand_name')

    // Apply filters
    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    if (search) {
      query = query.or(`brand_name.ilike.%${search}%,display_name.ilike.%${search}%`)
    }

    const { data: brands, error } = await query

    if (error) {
      console.error('Error fetching brands:', error)
      return NextResponse.json(
        { error: 'Failed to fetch brands' },
        { status: 500 }
      )
    }

    // If stats are requested, fetch brand performance data
    if (includeStats && brands && brands.length > 0) {
      const brandIds = brands.map(b => b.id)
      
      const { data: stats, error: statsError } = await supabase
        .from('brand_performance_summary')
        .select('*')
        .in('brand_id', brandIds)

      if (!statsError && stats) {
        // Merge stats with brands
        const statsMap = new Map(stats.map(s => [s.brand_id, s]))
        brands.forEach(brand => {
          const brandStats = statsMap.get(brand.id)
          if (brandStats) {
            Object.assign(brand, {
              asin_count: brandStats.asin_count,
              total_impressions: brandStats.total_impressions,
              total_revenue: brandStats.total_revenue,
              avg_cvr: brandStats.avg_cvr
            })
          }
        })
      }
    }

    return NextResponse.json({ brands })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}