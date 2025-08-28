import { NextRequest, NextResponse } from 'next/server';
import { SQPNestedService } from '@/services/dashboard/sqp-nested-service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const asins = searchParams.get('asins')?.split(',').filter(Boolean);
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    if (!asins || asins.length === 0) {
      return NextResponse.json(
        { error: 'asins parameter is required' },
        { status: 400 }
      );
    }

    const service = new SQPNestedService();
    const data = await service.getFunnelAnalysis(
      asins,
      startDate,
      endDate
    );

    // Aggregate funnel metrics across all queries
    const aggregatedFunnel = data.reduce((acc, item) => {
      acc.impressions += item.impressions;
      acc.clicks += item.clicks;
      acc.cartAdds += item.cartAdds;
      acc.purchases += item.purchases;
      return acc;
    }, { impressions: 0, clicks: 0, cartAdds: 0, purchases: 0 });

    // Calculate aggregate rates
    const funnelStages = [
      { 
        stage: 'Impressions', 
        count: aggregatedFunnel.impressions,
        rate: 100,
        dropOff: 0
      },
      { 
        stage: 'Clicks', 
        count: aggregatedFunnel.clicks,
        rate: aggregatedFunnel.impressions > 0 
          ? (aggregatedFunnel.clicks / aggregatedFunnel.impressions) * 100 
          : 0,
        dropOff: aggregatedFunnel.impressions - aggregatedFunnel.clicks
      },
      { 
        stage: 'Cart Adds', 
        count: aggregatedFunnel.cartAdds,
        rate: aggregatedFunnel.impressions > 0 
          ? (aggregatedFunnel.cartAdds / aggregatedFunnel.impressions) * 100 
          : 0,
        dropOff: aggregatedFunnel.clicks - aggregatedFunnel.cartAdds
      },
      { 
        stage: 'Purchases', 
        count: aggregatedFunnel.purchases,
        rate: aggregatedFunnel.impressions > 0 
          ? (aggregatedFunnel.purchases / aggregatedFunnel.impressions) * 100 
          : 0,
        dropOff: aggregatedFunnel.cartAdds - aggregatedFunnel.purchases
      }
    ];

    return NextResponse.json({
      data,
      funnel: funnelStages,
      summary: {
        totalImpressions: aggregatedFunnel.impressions,
        totalPurchases: aggregatedFunnel.purchases,
        overallConversionRate: aggregatedFunnel.impressions > 0 
          ? (aggregatedFunnel.purchases / aggregatedFunnel.impressions) * 100 
          : 0,
        averageCTR: data.length > 0
          ? data.reduce((sum, item) => sum + item.impressionToClickRate, 0) / data.length * 100
          : 0,
        averageCartAddRate: data.length > 0
          ? data.reduce((sum, item) => sum + item.clickToCartRate, 0) / data.length * 100
          : 0,
        averagePurchaseRate: data.length > 0
          ? data.reduce((sum, item) => sum + item.cartToPurchaseRate, 0) / data.length * 100
          : 0,
      },
      filters: {
        asins,
        startDate,
        endDate
      }
    });
  } catch (error) {
    console.error('Error in funnel analysis API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch funnel analysis data' },
      { status: 500 }
    );
  }
}