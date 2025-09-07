import { NextRequest, NextResponse } from 'next/server';
import { SQPNestedService } from '@/services/dashboard/sqp-nested-service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const asins = searchParams.get('asins')?.split(',').filter(Boolean);
    const queries = searchParams.get('queries')?.split(',').filter(Boolean);
    const brandId = searchParams.get('brandId');
    const minVolume = searchParams.get('minVolume') ? parseInt(searchParams.get('minVolume')!) : undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;

    const service = new SQPNestedService();
    
    // If brandId is provided, get ASINs for that brand first
    let brandAsins = asins;
    if (brandId && !asins) {
      brandAsins = await service.getAsinsByBrand(brandId);
    }
    
    const data = await service.getSearchPerformanceMetrics(
      startDate,
      endDate,
      {
        asins: brandAsins,
        searchQueries: queries,
        minVolume,
        limit
      }
    );

    // Calculate summary statistics
    const summary = {
      totalQueries: data.length,
      totalImpressions: data.reduce((sum: number, item) => sum + item.impressions, 0),
      totalClicks: data.reduce((sum: number, item) => sum + item.clicks, 0),
      totalCartAdds: data.reduce((sum: number, item) => sum + item.cartAdds, 0),
      totalPurchases: data.reduce((sum: number, item) => sum + item.purchases, 0),
      averageCTR: data.length > 0 
        ? data.reduce((sum: number, item) => sum + item.ctr, 0) / data.length 
        : 0,
      averageConversionRate: data.length > 0
        ? data.reduce((sum: number, item) => sum + item.conversionRate, 0) / data.length
        : 0,
    };

    return NextResponse.json({
      data,
      summary,
      filters: {
        startDate,
        endDate,
        asins,
        queries,
        minVolume,
        limit
      }
    });
  } catch (error) {
    console.error('Error in search performance API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch search performance data' },
      { status: 500 }
    );
  }
}