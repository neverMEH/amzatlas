import { NextRequest, NextResponse } from 'next/server';
import { SQPNestedService } from '@/services/dashboard/sqp-nested-service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const searchQuery = searchParams.get('searchQuery');
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10;

    if (!searchQuery) {
      return NextResponse.json(
        { error: 'searchQuery parameter is required' },
        { status: 400 }
      );
    }

    const service = new SQPNestedService();
    const data = await service.getMarketShareByQuery(
      searchQuery,
      startDate,
      endDate,
      limit
    );

    // Calculate market summary
    const totalMarket = data[0]?.totalMarketPurchases || 0;
    const topAsinShare = data[0]?.marketShare || 0;
    const competitorCount = data.length;

    return NextResponse.json({
      data,
      summary: {
        searchQuery,
        totalMarketPurchases: totalMarket,
        topAsinShare,
        competitorCount,
        marketConcentration: data.slice(0, 3).reduce((sum: number, item) => sum + item.marketShare, 0),
      },
      filters: {
        searchQuery,
        startDate,
        endDate,
        limit
      }
    });
  } catch (error) {
    console.error('Error in market share API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market share data' },
      { status: 500 }
    );
  }
}