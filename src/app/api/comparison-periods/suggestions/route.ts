import { NextRequest, NextResponse } from 'next/server'
import { generateComparisonSuggestions } from '@/app/api/dashboard/v2/asin-overview/utils/suggestion-metadata'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const asin = searchParams.get('asin')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!asin || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const suggestions = await generateComparisonSuggestions(
      asin,
      { start: startDate, end: endDate }
    )

    return NextResponse.json(suggestions)
  } catch (error) {
    console.error('Error in /api/comparison-periods/suggestions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}