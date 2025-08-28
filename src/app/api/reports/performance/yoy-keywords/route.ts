import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse parameters
    const yearParam = searchParams.get('year');
    const keywordsParam = searchParams.get('keywords');
    const limitParam = searchParams.get('limit');
    const sortBy = searchParams.get('sort') || 'purchases_change';
    const sortOrder = searchParams.get('order') || 'desc';

    // Validate year parameter
    const currentYear = new Date().getFullYear();
    let targetYear = currentYear;
    
    if (yearParam) {
      targetYear = parseInt(yearParam, 10);
      if (isNaN(targetYear) || targetYear < 2020 || targetYear > currentYear + 1) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Invalid year parameter. Must be between 2020 and ${currentYear + 1}` 
          },
          { status: 400 }
        );
      }
    }

    // Parse keywords
    const keywords = keywordsParam 
      ? keywordsParam.split(',').map(k => k.trim()).filter(k => k.length > 0)
      : null;

    // Parse limit
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 1000) : 50;

    // Call the database function
    const { data, error } = await supabase.rpc('get_yoy_keyword_performance', {
      p_year: targetYear,
      p_keywords: keywords,
      p_limit: limit,
      p_sort_by: sortBy,
      p_sort_order: sortOrder
    });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch year-over-year performance data' },
        { status: 500 }
      );
    }

    // Process and calculate YoY changes if not done in database
    const processedData = data?.map((row: any) => ({
      ...row,
      yoy_impressions_change: row.previous_year_impressions 
        ? ((row.total_impressions - row.previous_year_impressions) / row.previous_year_impressions) * 100
        : null,
      yoy_clicks_change: row.previous_year_clicks
        ? ((row.total_clicks - row.previous_year_clicks) / row.previous_year_clicks) * 100
        : null,
      yoy_purchases_change: row.previous_year_purchases
        ? ((row.total_purchases - row.previous_year_purchases) / row.previous_year_purchases) * 100
        : null,
      yoy_ctr_change: row.previous_year_ctr
        ? ((row.avg_ctr - row.previous_year_ctr) / row.previous_year_ctr) * 100
        : null,
      yoy_cvr_change: row.previous_year_cvr
        ? ((row.avg_cvr - row.previous_year_cvr) / row.previous_year_cvr) * 100
        : null,
    })) || [];

    // Calculate summary statistics
    const summary = {
      total_keywords: processedData.length,
      avg_impression_change: calculateAverage(processedData, 'yoy_impressions_change'),
      avg_click_change: calculateAverage(processedData, 'yoy_clicks_change'),
      avg_purchase_change: calculateAverage(processedData, 'yoy_purchases_change'),
      improving_keywords: processedData.filter((d: any) => (d.yoy_purchases_change || 0) > 0).length,
      declining_keywords: processedData.filter((d: any) => (d.yoy_purchases_change || 0) < 0).length,
      stable_keywords: processedData.filter((d: any) => Math.abs(d.yoy_purchases_change || 0) <= 5).length,
    };

    return NextResponse.json({
      success: true,
      data: processedData,
      summary,
      metadata: {
        year: targetYear,
        previous_year: targetYear - 1,
        keywords_filter: keywords,
        limit,
        sort_by: sortBy,
        sort_order: sortOrder,
      }
    });

  } catch (error) {
    console.error('YoY Keywords API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateAverage(data: any[], field: string): number | null {
  const validValues = data
    .map(d => d[field])
    .filter(v => v !== null && v !== undefined && !isNaN(v));
  
  return validValues.length > 0 
    ? validValues.reduce((sum, val) => sum + val, 0) / validValues.length
    : null;
}