import { NextRequest, NextResponse } from 'next/server';
import { getASINMonthlyDataAvailability } from '@/lib/date-utils/asin-data-availability';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const asin = searchParams.get('asin');
    const yearParam = searchParams.get('year');
    const monthParam = searchParams.get('month');

    // Validate required parameters
    const missingParams = [];
    if (!asin) missingParams.push('asin');
    if (!yearParam) missingParams.push('year');
    if (!monthParam) missingParams.push('month');
    
    if (missingParams.length > 0) {
      return NextResponse.json(
        { error: `Missing required parameters: ${missingParams.join(', ')}` },
        { status: 400 }
      );
    }

    // Parse and validate year
    const year = parseInt(yearParam!, 10); // yearParam is guaranteed to exist due to check above
    if (isNaN(year)) {
      return NextResponse.json(
        { error: 'Invalid year parameter' },
        { status: 400 }
      );
    }
    
    // Validate year is reasonable (between 2000 and current year + 1)
    const currentYear = new Date().getFullYear();
    if (year < 2000 || year > currentYear + 1) {
      return NextResponse.json(
        { error: 'Invalid year parameter. Must be between 2000 and current year + 1' },
        { status: 400 }
      );
    }

    // Parse and validate month
    const month = parseInt(monthParam!, 10); // monthParam is guaranteed to exist due to check above
    if (isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Invalid month parameter. Must be between 1 and 12' },
        { status: 400 }
      );
    }

    // Fetch monthly data availability
    const monthlyData = await getASINMonthlyDataAvailability(asin!, year, month); // asin is guaranteed to exist due to check above

    // Add cache headers for better performance
    const response = NextResponse.json(monthlyData);
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60');
    
    return response;
  } catch (error) {
    console.error('Error fetching monthly data availability:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly data availability' },
      { status: 500 }
    );
  }
}