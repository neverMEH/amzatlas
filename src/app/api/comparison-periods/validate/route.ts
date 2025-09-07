import { NextRequest, NextResponse } from 'next/server'
import { validateComparisonPeriod } from '@/app/api/dashboard/v2/asin-overview/utils/suggestion-metadata'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { asin, mainRange, comparisonRange } = body

    if (!asin || !mainRange || !comparisonRange) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Validate date ranges
    if (!mainRange.start || !mainRange.end || !comparisonRange.start || !comparisonRange.end) {
      return NextResponse.json(
        { error: 'Invalid date ranges provided' },
        { status: 400 }
      )
    }

    const validation = await validateComparisonPeriod(
      asin,
      mainRange,
      comparisonRange
    )

    return NextResponse.json(validation)
  } catch (error) {
    console.error('Error in /api/comparison-periods/validate:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}