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
    const startDateParam = searchParams.get('start_date');
    const endDateParam = searchParams.get('end_date');
    const correlationTypeParam = searchParams.get('correlation') || 'purchases';
    const includeRegressionParam = searchParams.get('include_regression') === 'true';
    const formatParam = searchParams.get('format') || 'json';

    // Calculate default date range (last 16 weeks for better correlation analysis)
    let startDate: string;
    let endDate: string;

    if (startDateParam && endDateParam) {
      startDate = startDateParam;
      endDate = endDateParam;
    } else {
      const now = new Date();
      const endWeek = endOfWeek(now, { weekStartsOn: 1 });
      const startWeek = startOfWeek(subWeeks(endWeek, 15), { weekStartsOn: 1 });
      
      startDate = format(startWeek, 'yyyy-MM-dd');
      endDate = format(endWeek, 'yyyy-MM-dd');
    }

    // Parse keywords
    const keywords = keywordsParam 
      ? keywordsParam.split(',').map(k => k.trim()).filter(k => k.length > 0)
      : null;

    // Get ranking and performance data
    const { data: rawData, error } = await supabase.rpc('get_ranking_correlation_data', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_keywords: keywords,
      p_asin: asinParam,
      p_correlation_metric: correlationTypeParam
    });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch ranking correlation data' },
        { status: 500 }
      );
    }

    // Calculate correlation coefficients
    const correlationResults = calculateCorrelations(rawData || [], correlationTypeParam);

    // Add regression analysis if requested
    let regressionAnalysis = null;
    if (includeRegressionParam) {
      regressionAnalysis = calculateRegressionAnalysis(rawData || [], correlationTypeParam);
    }

    // Handle matrix format request
    if (formatParam === 'matrix') {
      const correlationMatrix = generateCorrelationMatrix(correlationResults);
      return NextResponse.json({
        success: true,
        data: correlationMatrix,
        format: 'correlation_matrix'
      });
    }

    const response: any = {
      success: true,
      data: correlationResults,
      metadata: {
        start_date: startDate,
        end_date: endDate,
        correlation_metric: correlationTypeParam,
        total_keywords: correlationResults.length,
        analysis_period_weeks: Math.ceil(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) / (7 * 24 * 60 * 60 * 1000)
        )
      }
    };

    if (regressionAnalysis) {
      response.regression_analysis = regressionAnalysis;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Rank Correlation API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

interface CorrelationData {
  query: string;
  asin: string;
  period_end: string;
  organic_rank: number;
  total_purchases: number;
  total_clicks: number;
  total_impressions: number;
}

function calculateCorrelations(data: CorrelationData[], metric: string): any[] {
  // Group by query and ASIN
  const grouped = data.reduce((acc: any, row: any) => {
    const key = `${row.query}:${row.asin}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(row);
    return acc;
  }, {} as Record<string, CorrelationData[]>);

  const results = [];

  for (const [key, rows] of Object.entries(grouped)) {
    const typedRows = rows as CorrelationData[];
    if (typedRows.length < 4) continue; // Need at least 4 data points for meaningful correlation

    const [query, asin] = key.split(':');
    
    // Extract ranks and metric values
    const ranks = typedRows.map(r => r.organic_rank).filter(r => r && r > 0);
    const metricValues = typedRows.map(r => {
      switch (metric) {
        case 'clicks': return r.total_clicks;
        case 'impressions': return r.total_impressions;
        default: return r.total_purchases;
      }
    }).filter(v => v >= 0);

    if (ranks.length !== metricValues.length || ranks.length < 4) continue;

    // Calculate Pearson correlation coefficient
    const correlation = calculatePearsonCorrelation(ranks, metricValues);
    
    // Calculate additional statistics
    const avgRank = ranks.reduce((sum: number, r) => sum + r, 0) / ranks.length;
    const avgMetric = metricValues.reduce((sum: number, v: any) => sum + v, 0) / metricValues.length;
    const rankRange = Math.max(...ranks) - Math.min(...ranks);
    const metricRange = Math.max(...metricValues) - Math.min(...metricValues);
    
    // Determine correlation strength and significance
    const absCorrelation = Math.abs(correlation);
    let strength = 'weak';
    let significance = 'not_significant';
    
    if (absCorrelation >= 0.7) {
      strength = 'strong';
      significance = 'highly_significant';
    } else if (absCorrelation >= 0.5) {
      strength = 'moderate';
      significance = 'significant';
    } else if (absCorrelation >= 0.3) {
      strength = 'weak';
      significance = 'marginally_significant';
    }

    results.push({
      query,
      asin,
      correlation_coefficient: correlation,
      correlation_strength: strength,
      significance_level: significance,
      data_points: ranks.length,
      avg_rank: avgRank,
      avg_metric_value: avgMetric,
      rank_volatility: rankRange,
      metric_volatility: metricRange,
      rank_improvement_opportunity: avgRank > 10 ? 'high' : avgRank > 5 ? 'medium' : 'low',
      data_quality_score: Math.min(1, ranks.length / 12) * (rankRange > 5 ? 1 : 0.7),
    });
  }

  return results.sort((a: any, b: any) => Math.abs(b.correlation_coefficient) - Math.abs(a.correlation_coefficient));
}

function calculatePearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;

  const sumX = x.reduce((sum: number, val) => sum + val, 0);
  const sumY = y.reduce((sum: number, val) => sum + val, 0);
  const sumXY = x.reduce((sum: number, val, i) => sum + val * y[i], 0);
  const sumX2 = x.reduce((sum: number, val) => sum + val * val, 0);
  const sumY2 = y.reduce((sum: number, val) => sum + val * val, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator === 0 ? 0 : numerator / denominator;
}

function calculateRegressionAnalysis(data: CorrelationData[], metric: string): any {
  // Group all data points
  const allRanks: number[] = [];
  const allMetrics: number[] = [];

  data.forEach((row: any) => {
    if (row.organic_rank && row.organic_rank > 0) {
      allRanks.push(row.organic_rank);
      
      const metricValue = metric === 'clicks' ? row.total_clicks 
        : metric === 'impressions' ? row.total_impressions 
        : row.total_purchases;
      
      allMetrics.push(metricValue);
    }
  });

  if (allRanks.length < 10) {
    return null; // Not enough data for meaningful regression
  }

  // Calculate linear regression (y = mx + b)
  const n = allRanks.length;
  const sumX = allRanks.reduce((sum: number, x) => sum + x, 0);
  const sumY = allMetrics.reduce((sum: number, y) => sum + y, 0);
  const sumXY = allRanks.reduce((sum: number, x, i) => sum + x * allMetrics[i], 0);
  const sumX2 = allRanks.reduce((sum: number, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const yMean = sumY / n;
  const totalSumSquares = allMetrics.reduce((sum: number, y) => sum + Math.pow(y - yMean, 2), 0);
  const residualSumSquares = allRanks.reduce((sum: number, x, i) => {
    const predicted = slope * x + intercept;
    return sum + Math.pow(allMetrics[i] - predicted, 2);
  }, 0);
  
  const rSquared = 1 - (residualSumSquares / totalSumSquares);

  return {
    slope,
    intercept,
    r_squared: rSquared,
    data_points: n,
    equation: `${metric} = ${slope.toFixed(2)} * rank + ${intercept.toFixed(2)}`,
    interpretation: slope < 0 
      ? 'Lower rank (better position) correlates with higher performance' 
      : 'Higher rank (worse position) correlates with higher performance',
    model_quality: rSquared > 0.7 ? 'good' : rSquared > 0.4 ? 'moderate' : 'poor',
  };
}

function generateCorrelationMatrix(correlationResults: any[]): any {
  // Create a matrix format for visualization
  const queries = [...new Set(correlationResults.map(r => r.query))];
  const asins = [...new Set(correlationResults.map(r => r.asin))];

  const matrix = queries.map(query => {
    return asins.map(asin => {
      const result = correlationResults.find(r => r.query === query && r.asin === asin);
      return result ? result.correlation_coefficient : null;
    });
  });

  return {
    queries,
    asins,
    correlation_matrix: matrix,
    heatmap_ready: true,
  };
}