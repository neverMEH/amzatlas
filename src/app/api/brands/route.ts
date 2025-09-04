import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createClient()
    
    // Fetch all active brands
    const { data: brands, error } = await supabase
      .from('brands')
      .select('id, display_name')
      .eq('is_active', true)
      .order('display_name', { ascending: true })

    if (error) {
      console.error('Error fetching brands:', error)
      return NextResponse.json(
        { error: 'Failed to fetch brands', message: error.message },
        { status: 500 }
      )
    }

    // Return brands in the expected format
    return NextResponse.json({ data: brands || [] })
  } catch (error) {
    console.error('Unexpected error in brands API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}