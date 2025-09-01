import { NextRequest, NextResponse } from 'next/server';
import { getASINDataAvailability, findMostRecentCompleteMonth, getFallbackDateRange } from '@/lib/date-utils/asin-data-availability';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const asin = searchParams.get('asin');

    if (!asin) {
      return NextResponse.json(
        { error: 'ASIN parameter is required' },
        { status: 400 }
      );
    }

    // Get all available date ranges for the ASIN
    const dateRanges = await getASINDataAvailability(asin);
    
    // Find the most recent complete month
    const mostRecentCompleteMonth = await findMostRecentCompleteMonth(asin);
    
    // Get fallback date range if no complete month is available
    const fallbackRange = mostRecentCompleteMonth 
      ? null 
      : getFallbackDateRange(dateRanges);

    // Calculate summary statistics
    const summary = {
      totalRecords: dateRanges.reduce((sum, range) => sum + range.record_count, 0),
      dateRangeCount: dateRanges.length,
      earliestDate: dateRanges.length > 0 ? dateRanges[0].start_date : null,
      latestDate: dateRanges.length > 0 ? dateRanges[dateRanges.length - 1].end_date : null,
    };

    return NextResponse.json({
      asin,
      dateRanges,
      mostRecentCompleteMonth,
      fallbackRange,
      summary
    });
  } catch (error) {
    console.error('Error fetching ASIN data availability:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ASIN data availability' },
      { status: 500 }
    );
  }
}