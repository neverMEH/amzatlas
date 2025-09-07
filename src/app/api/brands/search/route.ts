import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || searchParams.get('query')
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      )
    }

    // Use the search_brands function for intelligent brand search
    const { data, error } = await supabase.rpc('search_brands', {
      p_search_term: query.trim()
    })

    if (error) {
      console.error('Error searching brands:', error)
      return NextResponse.json(
        { error: 'Failed to search brands' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      results: data || [],
      query: query.trim(),
      count: data?.length || 0
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}