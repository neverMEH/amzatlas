import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Brand, BrandsResponse } from '@/types/brand'

export async function GET() {
  try {
    const supabase = createClient()
    
    // Fetch all active brands with extended information
    const { data: brands, error } = await supabase
      .from('brands')
      .select(`
        id,
        brand_name,
        normalized_name,
        display_name,
        parent_brand_id,
        is_active,
        created_at,
        updated_at,
        logo_url,
        brand_color,
        description,
        metadata
      `)
      .eq('is_active', true)
      .order('display_name', { ascending: true })

    if (error) {
      console.error('Error fetching brands:', error)
      return NextResponse.json(
        { error: 'Failed to fetch brands', message: error.message },
        { status: 500 }
      )
    }

    // Get ASIN counts for each brand
    const brandsWithCounts = await Promise.all(
      (brands || []).map(async (brand: any) => {
        const { count } = await supabase
          .from('asin_brand_mapping')
          .select('*', { count: 'exact', head: true })
          .eq('brand_id', brand.id)
        
        return {
          ...brand,
          asin_count: count || 0
        } as Brand
      })
    )

    // Return brands in consistent format
    const response: BrandsResponse = {
      data: brandsWithCounts,
      total: brandsWithCounts.length,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Unexpected error in brands API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}