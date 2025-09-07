import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { brandId: string } }
) {
  try {
    const supabase = createClient()
    const { brandId } = params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(brandId)) {
      return NextResponse.json(
        { error: 'Invalid brand ID format' },
        { status: 400 }
      )
    }

    // Fetch brand details
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brandId)
      .single()

    if (brandError || !brand) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      )
    }

    // Fetch performance summary
    const { data: performance, error: perfError } = await supabase
      .from('brand_performance_summary')
      .select('*')
      .eq('brand_id', brandId)
      .single()

    if (perfError) {
      console.warn('No performance data found for brand:', brandId)
    }

    // Fetch child brands if any
    const { data: childBrands } = await supabase
      .from('brands')
      .select('id, brand_name, display_name')
      .eq('parent_brand_id', brandId)
      .order('brand_name')

    // Fetch parent brand if exists
    let parentBrand = null
    if (brand.parent_brand_id) {
      const { data: parent } = await supabase
        .from('brands')
        .select('id, brand_name, display_name')
        .eq('id', brand.parent_brand_id)
        .single()
      
      parentBrand = parent
    }

    // Fetch product types associated with this brand
    const { data: productTypes } = await supabase
      .from('product_type_mapping')
      .select('product_type, asin_count')
      .eq('brand_id', brandId)
      .order('asin_count', { ascending: false })

    return NextResponse.json({
      brand: {
        ...brand,
        performance: performance || null,
        childBrands: childBrands || [],
        parentBrand,
        productTypes: productTypes || []
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