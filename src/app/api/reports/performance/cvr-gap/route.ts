import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse parameters
    const keywordsParam = searchParams.get('keywords');
    const asinParam = searchParams.get('asin');
    const startDateParam = searchParams.get('start_date');
    const endDateParam = searchParams.get('end_date');
    const minClicksParam = searchParams.get('min_clicks') || '50';
    const priorityMatrixParam = searchParams.get('priority_matrix') === 'true';
    const benchmarkParam = searchParams.get('benchmark') || 'market_average';

    // Calculate default date range (last 8 weeks)
    let startDate: string;
    let endDate: string;

    if (startDateParam && endDateParam) {
      startDate = startDateParam;
      endDate = endDateParam;
    } else {
      const now = new Date();
      const endWeek = endOfWeek(now, { weekStartsOn: 1 });
      const startWeek = startOfWeek(subWeeks(endWeek, 7), { weekStartsOn: 1 });
      
      startDate = format(startWeek, 'yyyy-MM-dd');
      endDate = format(endWeek, 'yyyy-MM-dd');
    }

    const minClicks = parseInt(minClicksParam, 10);

    // Parse keywords
    const keywords = keywordsParam 
      ? keywordsParam.split(',').map(k => k.trim()).filter(k => k.length > 0)
      : null;

    // Get CVR gap analysis data
    const { data: rawData, error } = await supabase.rpc('calculate_cvr_gaps', {
      p_start_date: startDate,
      p_end_date: endDate,
      p_keywords: keywords,
      p_asin: asinParam,
      p_min_clicks: minClicks,
      p_benchmark_type: benchmarkParam
    });

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch CVR gap analysis data' },
        { status: 500 }
      );
    }

    // Process and enrich the data
    const processedData = calculateCVRGaps(rawData || []);

    // Generate priority matrix if requested
    let priorityMatrix = null;
    if (priorityMatrixParam) {
      priorityMatrix = generatePriorityMatrix(processedData);
    }

    // Calculate summary statistics
    const summary = calculateCVRGapSummary(processedData);

    const response: any = {
      success: true,
      data: processedData,
      summary,
      metadata: {
        start_date: startDate,
        end_date: endDate,
        min_clicks: minClicks,
        benchmark: benchmarkParam,
        total_analyzed: processedData.length
      }
    };

    if (priorityMatrix) {
      response.priority_matrix = priorityMatrix;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('CVR Gap API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

interface CVRData {
  query: string;
  asin: string;
  total_clicks: number;
  total_purchases: number;
  avg_cvr: number;
  market_avg_cvr: number;
  competitor_best_cvr: number;
  category_avg_cvr: number;
  historical_avg_cvr: number;
  total_impressions: number;
}

function calculateCVRGaps(data: CVRData[]): any[] {
  return data.map(row => {
    // Calculate various gap metrics
    const marketGap = row.avg_cvr - (row.market_avg_cvr || 0);
    const competitorGap = row.avg_cvr - (row.competitor_best_cvr || 0);
    const categoryGap = row.avg_cvr - (row.category_avg_cvr || 0);
    const historicalGap = row.avg_cvr - (row.historical_avg_cvr || 0);

    // Calculate potential impact
    const marketGapImpact = marketGap < 0 ? Math.abs(marketGap) * row.total_clicks : 0;
    const competitorGapImpact = competitorGap < 0 ? Math.abs(competitorGap) * row.total_clicks : 0;

    // Determine priority level
    const priorityScore = calculatePriorityScore(row, marketGap, competitorGap);
    const priorityLevel = getPriorityLevel(priorityScore);

    // Calculate confidence level based on data quality
    const confidenceLevel = calculateConfidenceLevel(row);

    // Identify gap type and recommendations
    const gapAnalysis = analyzeGapType(marketGap, competitorGap, categoryGap, historicalGap);

    return {
      ...row,
      market_gap: marketGap,
      market_gap_percentage: row.market_avg_cvr > 0 ? (marketGap / row.market_avg_cvr) * 100 : 0,
      competitor_gap: competitorGap,
      competitor_gap_percentage: row.competitor_best_cvr > 0 ? (competitorGap / row.competitor_best_cvr) * 100 : 0,
      category_gap: categoryGap,
      historical_gap: historicalGap,
      
      // Impact metrics
      market_gap_impact: marketGapImpact,
      competitor_gap_impact: competitorGapImpact,
      missed_conversions_estimate: Math.max(marketGapImpact, competitorGapImpact),
      
      // Priority and confidence
      priority_score: priorityScore,
      priority_level: priorityLevel,
      confidence_level: confidenceLevel,
      
      // Analysis
      gap_type: gapAnalysis.type,
      primary_benchmark_gap: gapAnalysis.primaryGap,
      improvement_opportunity: gapAnalysis.opportunity,
      recommended_actions: gapAnalysis.recommendations,
      
      // Additional metrics
      traffic_quality_score: row.total_clicks > 0 ? (row.total_purchases / row.total_clicks) * 100 : 0,
      conversion_efficiency: row.avg_cvr / (row.category_avg_cvr || 0.01), // Relative to category
    };
  }).sort((a, b) => b.priority_score - a.priority_score);
}

function calculatePriorityScore(row: CVRData, marketGap: number, competitorGap: number): number {
  // Weighted scoring based on multiple factors
  const volumeScore = Math.min(row.total_clicks / 1000, 1) * 30; // Max 30 points for volume
  const gapScore = Math.max(Math.abs(marketGap), Math.abs(competitorGap)) * 100 * 25; // Max 25 points for gap size
  const impressionScore = Math.min(row.total_impressions / 10000, 1) * 20; // Max 20 points for visibility
  const opportunityScore = (marketGap < 0 || competitorGap < 0) ? 25 : 0; // 25 points if below benchmarks

  return volumeScore + gapScore + impressionScore + opportunityScore;
}

function getPriorityLevel(score: number): string {
  if (score >= 70) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function calculateConfidenceLevel(row: CVRData): string {
  // Base confidence on sample size and data recency
  const sampleSizeScore = Math.min(row.total_clicks / 100, 1);
  const conversionsSizeScore = Math.min(row.total_purchases / 20, 1);
  
  const overallConfidence = (sampleSizeScore + conversionsSizeScore) / 2;
  
  if (overallConfidence >= 0.8) return 'high';
  if (overallConfidence >= 0.5) return 'medium';
  return 'low';
}

function analyzeGapType(
  marketGap: number, 
  competitorGap: number, 
  categoryGap: number, 
  historicalGap: number
): any {
  let type = 'underperforming';
  let primaryGap = 'market';
  let opportunity = 'low';
  let recommendations = [];

  // Determine gap type
  if (marketGap > 0 && competitorGap > 0) {
    type = 'outperforming';
    opportunity = 'optimization';
    recommendations.push('Monitor for competitive threats', 'Test conversion optimization');
  } else if (marketGap < 0 || competitorGap < 0) {
    type = 'underperforming';
    
    // Find primary gap
    if (Math.abs(competitorGap) > Math.abs(marketGap)) {
      primaryGap = 'competitor';
      opportunity = 'high';
      recommendations.push(
        'Analyze top competitor product listings',
        'Improve product images and descriptions',
        'Review pricing strategy'
      );
    } else {
      primaryGap = 'market';
      opportunity = 'medium';
      recommendations.push(
        'Optimize product listing',
        'Improve customer reviews',
        'Enhance product imagery'
      );
    }
    
    // Historical comparison
    if (historicalGap < -0.01) {
      recommendations.push('Investigate recent changes that may have impacted conversion');
    }
    
    // Category comparison
    if (categoryGap < -0.02) {
      recommendations.push('Study category best practices', 'Consider product positioning changes');
    }
  } else {
    type = 'stable';
    opportunity = 'incremental';
    recommendations.push('Test incremental improvements', 'Monitor conversion trends');
  }

  return {
    type,
    primaryGap,
    opportunity,
    recommendations
  };
}

function generatePriorityMatrix(data: any[]): any {
  // Create 2x2 matrix: Impact vs Effort
  const matrix = {
    high_impact_low_effort: [] as any[], // Quick wins
    high_impact_high_effort: [] as any[], // Major projects
    low_impact_low_effort: [] as any[], // Fill-ins
    low_impact_high_effort: [] as any[], // Avoid
  };

  data.forEach(item => {
    // Estimate effort based on gap size and type
    const effort = estimateEffort(item);
    const impact = item.missed_conversions_estimate;
    
    const isHighImpact = impact > 20 || item.priority_level === 'critical';
    const isHighEffort = effort === 'high';
    
    if (isHighImpact && !isHighEffort) {
      matrix.high_impact_low_effort.push(item);
    } else if (isHighImpact && isHighEffort) {
      matrix.high_impact_high_effort.push(item);
    } else if (!isHighImpact && !isHighEffort) {
      matrix.low_impact_low_effort.push(item);
    } else {
      matrix.low_impact_high_effort.push(item);
    }
  });

  return {
    ...matrix,
    recommendations: {
      immediate: matrix.high_impact_low_effort,
      planned: matrix.high_impact_high_effort,
      backlog: matrix.low_impact_low_effort,
      avoid: matrix.low_impact_high_effort,
    }
  };
}

function estimateEffort(item: any): string {
  // Estimate effort based on gap analysis
  if (item.gap_type === 'underperforming') {
    if (item.primary_benchmark_gap === 'competitor' && Math.abs(item.competitor_gap) > 0.05) {
      return 'high'; // Significant competitor gap requires major changes
    }
    if (item.category_gap < -0.03) {
      return 'high'; // Large category gap suggests fundamental issues
    }
    return 'medium';
  }
  
  return 'low'; // Optimization or stable cases
}

function calculateCVRGapSummary(data: any[]): any {
  const criticalCount = data.filter(d => d.priority_level === 'critical').length;
  const highCount = data.filter(d => d.priority_level === 'high').length;
  const underperformingCount = data.filter(d => d.gap_type === 'underperforming').length;
  
  const totalMissedConversions = data.reduce((sum, d) => sum + (d.missed_conversions_estimate || 0), 0);
  const avgMarketGap = data.length > 0 
    ? data.reduce((sum, d) => sum + d.market_gap, 0) / data.length 
    : 0;

  return {
    total_analyzed: data.length,
    critical_issues: criticalCount,
    high_priority: highCount,
    underperforming_keywords: underperformingCount,
    total_missed_conversions_estimate: totalMissedConversions,
    avg_market_gap_percentage: avgMarketGap * 100,
    improvement_opportunities: criticalCount + highCount,
    quick_wins_available: data.filter(d => 
      d.priority_level === 'high' && d.confidence_level === 'high'
    ).length,
  };
}