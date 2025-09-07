import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse parameters
    const keywordsParam = searchParams.get('keywords');
    const asinParam = searchParams.get('asin');
    const asinsParam = searchParams.get('asins');
    const startDateParam = searchParams.get('start_date');
    const endDateParam = searchParams.get('end_date');
    const aggregateParam = searchParams.get('aggregate') || 'weekly';
    const includeTrendsParam = searchParams.get('include_trends') === 'true';
    const includeCompetitorsParam = searchParams.get('include_competitors') === 'true';
    const includeStatsParam = searchParams.get('include_stats') === 'true';
    const metricsParam = searchParams.get('metrics');
    const formatParam = searchParams.get('format') || 'json';

    // Calculate default date range (last 12 weeks)
    let startDate: string;
    let endDate: string;

    if (startDateParam && endDateParam) {
      startDate = startDateParam;
      endDate = endDateParam;
    } else {
      const now = new Date();
      const endWeek = endOfWeek(now, { weekStartsOn: 1 });
      const startWeek = startOfWeek(subWeeks(endWeek, 11), { weekStartsOn: 1 });
      
      startDate = format(startWeek, 'yyyy-MM-dd');
      endDate = format(endWeek, 'yyyy-MM-dd');
    }

    // Parse ASINs
    const asins = asinsParam 
      ? asinsParam.split(',').map(a => a.trim()).filter((a: any) => a.length > 0)
      : asinParam 
        ? [asinParam] 
        : null;

    // Parse keywords
    const keywords = keywordsParam 
      ? keywordsParam.split(',').map(k => k.trim()).filter(k => k.length > 0)
      : null;

    // Handle CSV export
    if (formatParam === 'csv') {
      return await generateCSVResponse(supabase, {
        startDate,
        endDate,
        keywords,
        asins,
        aggregate: aggregateParam
      });
    }

    // Handle share of voice metrics
    if (metricsParam === 'share_of_voice') {
      const { data, error } = await supabase.rpc('calculate_share_of_voice', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_keywords: keywords,
        p_asins: asins
      });

      if (error) {
        console.error('Share of voice error:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to calculate share of voice' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data,
        metrics: 'share_of_voice'
      });
    }

    // Get market share data
    const tableName = aggregateParam === 'monthly' 
      ? 'sqp.monthly_summary'
      : 'sqp.weekly_summary';

    let query = supabase
      .from(tableName)
      .select(`
        period_end,
        query,
        asin,
        total_purchases,
        total_clicks,
        total_impressions,
        purchase_share,
        click_share,
        impression_share
      `)
      .gte('period_end', startDate)
      .lte('period_end', endDate)
      .order('period_end', { ascending: false });

    // Apply filters
    if (asins) {
      query = query.in('asin', asins);
    }

    if (keywords) {
      query = query.in('query', keywords);
    }

    const { data: rawData, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch market share data' },
        { status: 500 }
      );
    }

    // Process market share data
    let processedData = calculateMarketShareMetrics(rawData || []);

    // Add trend analysis if requested
    if (includeTrendsParam) {
      processedData = addTrendAnalysis(processedData);
    }

    const response: any = {
      success: true,
      data: processedData,
      metadata: {
        start_date: startDate,
        end_date: endDate,
        aggregate: aggregateParam,
        total_records: processedData.length
      }
    };

    // Add competitor analysis if requested
    if (includeCompetitorsParam && asins && asins.length === 1) {
      const competitorData = await getCompetitorAnalysis(
        supabase, 
        asins[0], 
        keywords?.[0] || null,
        startDate, 
        endDate
      );
      response.competitor_analysis = competitorData;
    }

    // Add market statistics if requested
    if (includeStatsParam) {
      const marketStats = await getMarketStatistics(
        supabase,
        keywords,
        startDate,
        endDate,
        tableName
      );
      response.market_stats = marketStats;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Market Share API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateMarketShareMetrics(data: any[]): any[] {
  // Group by query to calculate market totals
  const marketTotals = data.reduce((acc: any, row: any) => {
    const key = `${row.query}:${row.period_end}`;
    if (!acc[key]) {
      acc[key] = {
        total_purchases: 0,
        total_clicks: 0,
        total_impressions: 0,
        competitors: new Set(),
      };
    }
    
    acc[key].total_purchases += row.total_purchases;
    acc[key].total_clicks += row.total_clicks;
    acc[key].total_impressions += row.total_impressions;
    acc[key].competitors.add(row.asin);
    
    return acc;
  }, {} as Record<string, any>);

  // Calculate shares and trends
  return data.map(row => {
    const marketKey = `${row.query}:${row.period_end}`;
    const market = marketTotals[marketKey];
    
    const calculatedPurchaseShare = market.total_purchases > 0 
      ? row.total_purchases / market.total_purchases 
      : 0;
    
    const calculatedClickShare = market.total_clicks > 0
      ? row.total_clicks / market.total_clicks
      : 0;
    
    const calculatedImpressionShare = market.total_impressions > 0
      ? row.total_impressions / market.total_impressions
      : 0;

    return {
      ...row,
      market_total_purchases: market.total_purchases,
      market_total_clicks: market.total_clicks,
      market_total_impressions: market.total_impressions,
      competitor_count: market.competitors.size,
      purchase_share: row.purchase_share || calculatedPurchaseShare,
      click_share: row.click_share || calculatedClickShare,
      impression_share: row.impression_share || calculatedImpressionShare,
    };
  });
}

function addTrendAnalysis(data: any[]): any[] {
  // Group by query and ASIN to calculate trends
  const grouped = data.reduce((acc: any, row: any) => {
    const key = `${row.query}:${row.asin}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(row);
    return acc;
  }, {} as Record<string, any[]>);

  const results = [];

  for (const [key, rows] of Object.entries(grouped)) {
    const sortedRows = (rows as any[]).sort((a: any, b: any) => 
      new Date(b.period_end).getTime() - new Date(a.period_end).getTime()
    );

    for (let i = 0; i < sortedRows.length; i++) {
      const current = sortedRows[i];
      const previousWeek = sortedRows[i + 1];
      const previousMonth = sortedRows.find(r => {
        const currentDate = new Date(current.period_end);
        const rowDate = new Date(r.period_end);
        const daysDiff = (currentDate.getTime() - rowDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff >= 28 && daysDiff <= 35; // ~4 weeks
      });

      let weekOverWeekChange = null;
      let monthOverMonthChange = null;
      let shareTrend = 'stable';

      if (previousWeek) {
        weekOverWeekChange = current.purchase_share - previousWeek.purchase_share;
      }

      if (previousMonth) {
        monthOverMonthChange = current.purchase_share - previousMonth.purchase_share;
      }

      // Determine trend
      if (weekOverWeekChange !== null) {
        if (weekOverWeekChange > 0.01) {
          shareTrend = 'increasing';
        } else if (weekOverWeekChange < -0.01) {
          shareTrend = 'decreasing';
        }
      }

      results.push({
        ...current,
        week_over_week_change: weekOverWeekChange,
        month_over_month_change: monthOverMonthChange,
        share_trend: shareTrend,
      });
    }
  }

  return results.sort((a: any, b: any) => 
    new Date(b.period_end).getTime() - new Date(a.period_end).getTime()
  );
}

async function getCompetitorAnalysis(
  supabase: any,
  targetAsin: string,
  keyword: string | null,
  startDate: string,
  endDate: string
) {
  const { data, error } = await supabase.rpc('analyze_competitors', {
    p_target_asin: targetAsin,
    p_keyword: keyword,
    p_start_date: startDate,
    p_end_date: endDate
  });

  if (error) {
    console.error('Competitor analysis error:', error);
    return null;
  }

  return data;
}

async function getMarketStatistics(
  supabase: any,
  keywords: string[] | null,
  startDate: string,
  endDate: string,
  tableName: string
) {
  const { data, error } = await supabase.rpc('calculate_market_stats', {
    p_keywords: keywords,
    p_start_date: startDate,
    p_end_date: endDate,
    p_table_name: tableName
  });

  if (error) {
    console.error('Market stats error:', error);
    return null;
  }

  return data;
}

async function generateCSVResponse(supabase: any, params: any) {
  // Implementation for CSV export
  const csvData = await supabase.rpc('get_market_share_csv', params);
  
  if (csvData.error) {
    return NextResponse.json(
      { success: false, error: 'Failed to generate CSV' },
      { status: 500 }
    );
  }

  return new NextResponse(csvData.data, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="market-share-analysis.csv"'
    }
  });
}