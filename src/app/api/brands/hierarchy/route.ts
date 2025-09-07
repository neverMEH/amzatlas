import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface BrandNode {
  id: string
  brand_name: string
  display_name: string
  parent_brand_id: string | null
  level: number
  path: string[]
  root_brand_id: string
  asin_count?: number
  total_revenue?: number
  avg_cvr?: number
  children?: BrandNode[]
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const searchParams = request.nextUrl.searchParams
    const includeMetrics = searchParams.get('includeMetrics') === 'true'

    // Fetch brand hierarchy data
    const { data, error } = await supabase
      .from('brand_hierarchy')
      .select(includeMetrics ? '*' : 'id, brand_name, display_name, parent_brand_id, level, path, root_brand_id')
      .order('level, brand_name')

    if (error) {
      console.error('Error fetching brand hierarchy:', error)
      return NextResponse.json(
        { error: 'Failed to fetch brand hierarchy' },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ hierarchy: [], flat: [] })
    }

    // Build hierarchical structure
    const brandMap = new Map<string, BrandNode>()
    const rootBrands: BrandNode[] = []

    // First pass: create all nodes
    data.forEach((brand: any) => {
      brandMap.set(brand.id, {
        ...brand,
        children: []
      })
    })

    // Second pass: build hierarchy
    data.forEach((brand: any) => {
      const node = brandMap.get(brand.id)!
      
      if (brand.parent_brand_id) {
        const parent = brandMap.get(brand.parent_brand_id)
        if (parent) {
          parent.children!.push(node)
        }
      } else {
        rootBrands.push(node)
      }
    })

    // Sort children at each level
    const sortChildren = (node: BrandNode) => {
      if (node.children && node.children.length > 0) {
        node.children.sort((a, b) => a.brand_name.localeCompare(b.brand_name))
        node.children.forEach((child: any) => sortChildren(child))
      }
    }

    rootBrands.forEach((brand: any) => sortChildren(brand))

    // Calculate aggregated metrics if needed
    if (includeMetrics) {
      const calculateAggregates = (node: BrandNode): void => {
        if (node.children && node.children.length > 0) {
          node.children.forEach((child: any) => calculateAggregates(child))
          
          // Add child metrics to parent
          const childMetrics = node.children.reduce((acc: any, child: any) => ({
            asin_count: acc.asin_count + (child.asin_count || 0),
            total_revenue: acc.total_revenue + (child.total_revenue || 0),
            total_cvr: acc.total_cvr + ((child.avg_cvr || 0) * (child.asin_count || 0)),
            weighted_count: acc.weighted_count + (child.asin_count || 0)
          }), {
            asin_count: node.asin_count || 0,
            total_revenue: node.total_revenue || 0,
            total_cvr: (node.avg_cvr || 0) * (node.asin_count || 0),
            weighted_count: node.asin_count || 0
          })

          node.asin_count = childMetrics.asin_count
          node.total_revenue = childMetrics.total_revenue
          node.avg_cvr = childMetrics.weighted_count > 0 
            ? childMetrics.total_cvr / childMetrics.weighted_count 
            : 0
        }
      }

      rootBrands.forEach((brand: any) => calculateAggregates(brand))
    }

    return NextResponse.json({
      hierarchy: rootBrands,
      flat: Array.from(brandMap.values()),
      totalBrands: data.length,
      rootBrands: rootBrands.length
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}