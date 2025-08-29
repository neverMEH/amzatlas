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
    const weeksParam = searchParams.get('weeks') || '8';
    const asinParam = searchParams.get('asin');
    const keywordsParam = searchParams.get('keywords');
    const formatParam = searchParams.get('format') || 'json';
    const aggregateParam = searchParams.get('aggregate') || 'weekly';
    const minPurchasesParam = searchParams.get('min_purchases') || '5';
    const includeStatsParam = searchParams.get('include_stats') === 'true';
    const startDateParam = searchParams.get('start_date');
    const endDateParam = searchParams.get('end_date');

    // Calculate date range
    const weeks = Math.min(parseInt(weeksParam, 10), 52);
    const minPurchases = parseInt(minPurchasesParam, 10);
    
    let startDate: string;
    let endDate: string;

    if (startDateParam && endDateParam) {
      startDate = startDateParam;
      endDate = endDateParam;
    } else {
      const now = new Date();
      const endWeek = endOfWeek(now, { weekStartsOn: 1 });
      const startWeek = startOfWeek(subWeeks(endWeek, weeks - 1), { weekStartsOn: 1 });
      
      startDate = format(startWeek, 'yyyy-MM-dd');
      endDate = format(endWeek, 'yyyy-MM-dd');
    }

    // Parse keywords
    const keywords = keywordsParam 
      ? keywordsParam.split(',').map(k => k.trim()).filter(k => k.length > 0)
      : null;

    // Handle heatmap format request
    if (formatParam === 'heatmap') {
      const { data, error } = await supabase.rpc('get_purchase_velocity_heatmap', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_asin: asinParam,
        p_keywords: keywords,
        p_min_purchases: minPurchases
      });

      if (error) {
        console.error('Database error (heatmap):', error);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch heatmap data' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data,
        format: 'heatmap'
      });
    }

    // Build query based on aggregation type
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
        total_impressions
      `)
      .gte('period_end', startDate)
      .lte('period_end', endDate)
      .gte('total_purchases', minPurchases)
      .order('period_end', { ascending: false });

    // Apply filters
    if (asinParam) {
      query = query.eq('asin', asinParam);
    }

    if (keywords) {
      query = query.in('query', keywords);
    }

    const { data: rawData, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch purchase velocity data' },
        { status: 500 }
      );
    }

    // Calculate velocity metrics
    const processedData = calculateVelocityMetrics(rawData || []);

    // Calculate statistics if requested
    let statistics = null;
    if (includeStatsParam) {
      statistics = calculateVelocityStatistics(processedData);
    }

    const response: any = {
      success: true,
      data: processedData,
      metadata: {
        start_date: startDate,
        end_date: endDate,
        weeks,
        aggregate: aggregateParam,
        min_purchases: minPurchases,
        total_records: processedData.length
      }
    };

    if (statistics) {
      response.statistics = statistics;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Purchase Velocity API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateVelocityMetrics(data: any[]): any[] {
  // Group by query and asin
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
      const previous = sortedRows[i + 1];
      
      let velocityChange = null;
      let velocityTrend = 'unknown';
      let weekOverWeekGrowth = null;

      if (previous) {
        velocityChange = ((current.total_purchases - previous.total_purchases) / previous.total_purchases) * 100;
        weekOverWeekGrowth = (current.total_purchases - previous.total_purchases) / previous.total_purchases;
        
        if (velocityChange > 10) {
          velocityTrend = 'accelerating';
        } else if (velocityChange < -10) {
          velocityTrend = 'decelerating';
        } else {
          velocityTrend = 'stable';
        }
      }

      // Calculate trend strength based on multiple periods
      let trendDirection = 'neutral';
      let trendStrength = 0;

      if (sortedRows.length >= 3) {
        const recent3 = sortedRows.slice(Math.max(0, i - 2), i + 1);
        const changes = [];
        
        for (let j = 0; j < recent3.length - 1; j++) {
          const change = (recent3[j].total_purchases - recent3[j + 1].total_purchases) / recent3[j + 1].total_purchases;
          changes.push(change);
        }

        const avgChange = changes.reduce((sum: number, c: any) => sum + c, 0) / changes.length;
        trendStrength = Math.abs(avgChange);
        
        if (avgChange > 0.05) {
          trendDirection = 'upward';
        } else if (avgChange < -0.05) {
          trendDirection = 'downward';
        }
      }

      results.push({
        ...current,
        previous_week_purchases: previous?.total_purchases || null,
        velocity_change: velocityChange,
        velocity_trend: velocityTrend,
        week_over_week_growth: weekOverWeekGrowth,
        trend_direction: trendDirection,
        trend_strength: trendStrength,
      });
    }
  }

  return results.sort((a: any, b: any) => 
    new Date(b.period_end).getTime() - new Date(a.period_end).getTime()
  );
}

function calculateVelocityStatistics(data: any[]) {
  const validChanges = data
    .map(d => d.velocity_change)
    .filter(v => v !== null && !isNaN(v));

  const accelerating = data.filter((d: any) => d.velocity_trend === 'accelerating').length;
  const decelerating = data.filter((d: any) => d.velocity_trend === 'decelerating').length;
  const stable = data.filter((d: any) => d.velocity_trend === 'stable').length;

  return {
    total_items: data.length,
    avg_velocity_change: validChanges.length > 0 
      ? validChanges.reduce((sum: number, v: any) => sum + v, 0) / validChanges.length 
      : null,
    max_velocity_change: validChanges.length > 0 ? Math.max(...validChanges) : null,
    min_velocity_change: validChanges.length > 0 ? Math.min(...validChanges) : null,
    accelerating_count: accelerating,
    decelerating_count: decelerating,
    stable_count: stable,
    accelerating_percentage: accelerating / data.length * 100,
    decelerating_percentage: decelerating / data.length * 100,
  };
}