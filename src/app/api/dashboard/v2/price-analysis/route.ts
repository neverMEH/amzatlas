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
    const data = await service.getPriceAnalysis(
      asins,
      startDate,
      endDate
    );

    // Calculate price summary statistics
    const priceStats = data.reduce((acc, item) => {
      if (item.medianPurchasePrice) {
        acc.prices.push(item.medianPurchasePrice);
        if (item.priceCompetitiveness !== undefined) {
          acc.competitiveness.push(item.priceCompetitiveness);
        }
      }
      return acc;
    }, { prices: [] as number[], competitiveness: [] as number[] });

    const avgPrice = priceStats.prices.length > 0
      ? priceStats.prices.reduce((sum, p) => sum + p, 0) / priceStats.prices.length
      : 0;

    const avgCompetitiveness = priceStats.competitiveness.length > 0
      ? priceStats.competitiveness.reduce((sum, c) => sum + c, 0) / priceStats.competitiveness.length
      : 0;

    // Group by ASIN for easier visualization
    const byAsin = data.reduce((acc, item) => {
      if (!acc[item.asin]) {
        acc[item.asin] = {
          asin: item.asin,
          avgClickPrice: [],
          avgCartAddPrice: [],
          avgPurchasePrice: [],
          queries: []
        };
      }
      
      acc[item.asin].queries.push(item.searchQuery);
      if (item.medianClickPrice) acc[item.asin].avgClickPrice.push(item.medianClickPrice);
      if (item.medianCartAddPrice) acc[item.asin].avgCartAddPrice.push(item.medianCartAddPrice);
      if (item.medianPurchasePrice) acc[item.asin].avgPurchasePrice.push(item.medianPurchasePrice);
      
      return acc;
    }, {} as Record<string, any>);

    // Calculate averages per ASIN
    const asinPriceSummary = Object.values(byAsin).map((asinData: any) => ({
      asin: asinData.asin,
      avgClickPrice: asinData.avgClickPrice.length > 0
        ? asinData.avgClickPrice.reduce((sum: number, p: number) => sum + p, 0) / asinData.avgClickPrice.length
        : null,
      avgCartAddPrice: asinData.avgCartAddPrice.length > 0
        ? asinData.avgCartAddPrice.reduce((sum: number, p: number) => sum + p, 0) / asinData.avgCartAddPrice.length
        : null,
      avgPurchasePrice: asinData.avgPurchasePrice.length > 0
        ? asinData.avgPurchasePrice.reduce((sum: number, p: number) => sum + p, 0) / asinData.avgPurchasePrice.length
        : null,
      queryCount: asinData.queries.length
    }));

    return NextResponse.json({
      data,
      summary: {
        averagePrice: avgPrice,
        averageCompetitiveness: avgCompetitiveness,
        priceRange: {
          min: Math.min(...priceStats.prices),
          max: Math.max(...priceStats.prices)
        },
        competitivenessInterpretation: avgCompetitiveness > 0 
          ? 'Priced below market average' 
          : avgCompetitiveness < 0 
            ? 'Priced above market average' 
            : 'Priced at market average'
      },
      byAsin: asinPriceSummary,
      filters: {
        asins,
        startDate,
        endDate
      }
    });
  } catch (error) {
    console.error('Error in price analysis API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch price analysis data' },
      { status: 500 }
    );
  }
}