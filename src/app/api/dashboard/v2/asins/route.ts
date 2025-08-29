import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createClient()
    
    // Fetch distinct ASINs with their product titles and brands
    const { data, error } = await supabase
      .from('asin_performance_data')
      .select('asin, product_title, brand')
      .order('product_title', { ascending: true })
      
    if (error) {
      console.error('Error fetching ASINs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch ASINs' },
        { status: 500 }
      )
    }

    // Remove duplicates based on ASIN
    const uniqueASINs = data?.reduce((acc: any[], item: any) => {
      if (!acc.find(a => a.asin === item.asin)) {
        acc.push({
          asin: item.asin,
          productTitle: item.product_title || `ASIN: ${item.asin}`,
          brand: item.brand || 'Unknown Brand'
        })
      }
      return acc
    }, []) || []

    return NextResponse.json({ asins: uniqueASINs })
  } catch (error) {
    console.error('Error in /api/dashboard/v2/asins:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}