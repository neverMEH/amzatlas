import { NextRequest, NextResponse } from 'next/server';
import { SQPNestedService } from '@/services/dashboard/sqp-nested-service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const metric = searchParams.get('metric') as 'volume' | 'purchases' | 'conversion_rate' | 'market_share' || 'volume';
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;

    const service = new SQPNestedService();
    const data = await service.getTopQueries(
      metric,
      startDate,
      endDate,
      limit
    );

    // Calculate metric totals
    const totals = data.reduce((acc: any, item: any) => {
      acc.totalValue += item.value;
      acc.totalImpressions += item.totalImpressions;
      acc.totalPurchases += item.totalPurchases;
      return acc;
    }, { totalValue: 0, totalImpressions: 0, totalPurchases: 0 });

    // Add percentage of total for each query
    const enrichedData = data.map((item: any) => ({
      ...item,
      percentageOfTotal: totals.totalValue > 0 ? (item.value / totals.totalValue) * 100 : 0,
      conversionRate: item.totalImpressions > 0 
        ? (item.totalPurchases / item.totalImpressions) * 100 
        : 0
    }));

    return NextResponse.json({
      data: enrichedData,
      summary: {
        metric,
        totalQueries: data.length,
        totalImpressions: totals.totalImpressions,
        totalPurchases: totals.totalPurchases,
        averageValue: data.length > 0 ? totals.totalValue / data.length : 0,
        top3Concentration: enrichedData.slice(0, 3).reduce((sum: number, item) => sum + item.percentageOfTotal, 0)
      },
      filters: {
        metric,
        startDate,
        endDate,
        limit
      }
    });
  } catch (error) {
    console.error('Error in top queries API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top queries data' },
      { status: 500 }
    );
  }
}