import { KeywordPerformanceScore } from '../types';

export class PerformanceScorer {
  /**
   * Score keywords based on multiple performance metrics
   */
  async scoreKeywords(
    keywords: Array<{
      query: string;
      impressions: number;
      clicks: number;
      purchases: number;
      revenue?: number;
    }>
  ): Promise<KeywordPerformanceScore[]> {
    if (keywords.length === 0) return [];

    // Calculate metrics for normalization
    const stats = this.calculateKeywordStats(keywords);
    const scores: KeywordPerformanceScore[] = [];

    for (const keyword of keywords) {
      const ctr = keyword.impressions > 0 ? keyword.clicks / keyword.impressions : 0;
      const cvr = keyword.clicks > 0 ? keyword.purchases / keyword.clicks : 0;
      const efficiency = keyword.impressions > 0 ? keyword.purchases / keyword.impressions : 0;

      // Calculate component scores (0-100 scale)
      const volumeScore = this.normalizeScore(keyword.impressions, stats.impressions.max);
      const engagementScore = this.normalizeScore(ctr, stats.ctr.max);
      const conversionScore = this.normalizeScore(cvr, stats.cvr.max);
      const efficiencyScore = this.normalizeScore(efficiency, stats.efficiency.max);

      // Calculate weighted performance score
      const weights = {
        volume: 0.2,
        engagement: 0.3,
        conversion: 0.4,
        efficiency: 0.1,
      };

      const performanceScore = 
        volumeScore * weights.volume +
        engagementScore * weights.engagement +
        conversionScore * weights.conversion +
        efficiencyScore * weights.efficiency;

      // Calculate opportunity score
      const opportunityScore = this.calculateOpportunityScore({
        impressions: keyword.impressions,
        ctr,
        cvr,
        avgCtr: stats.ctr.avg,
        avgCvr: stats.cvr.avg,
      });

      // Determine tier
      const tier = this.determineTier(performanceScore);

      scores.push({
        query: keyword.query,
        performanceScore,
        volumeScore,
        engagementScore,
        conversionScore,
        efficiencyScore,
        opportunityScore,
        tier,
        metrics: {
          impressions: keyword.impressions,
          clicks: keyword.clicks,
          purchases: keyword.purchases,
          revenue: keyword.revenue || 0,
          ctr,
          cvr,
          purchasesPerImpression: efficiency,
        },
      });
    }

    return scores;
  }

  /**
   * Calculate keyword competitiveness
   */
  calculateCompetitiveness(
    keywordData: Array<{
      query: string;
      asin: string;
      purchases: number;
    }>
  ): Record<string, {
    competitiveness: number;
    topCompetitors: Array<{ asin: string; marketShare: number }>;
    herfindahlIndex: number;
  }> {
    const byKeyword = new Map<string, any[]>();
    
    // Group by keyword
    for (const data of keywordData) {
      if (!byKeyword.has(data.query)) {
        byKeyword.set(data.query, []);
      }
      byKeyword.get(data.query)!.push(data);
    }

    const results: Record<string, any> = {};

    for (const [query, asins] of byKeyword.entries()) {
      const totalPurchases = asins.reduce((sum, a) => sum + a.purchases, 0);
      
      // Calculate market shares
      const marketShares = asins.map(a => ({
        asin: a.asin,
        marketShare: totalPurchases > 0 ? a.purchases / totalPurchases : 0,
      })).sort((a, b) => b.marketShare - a.marketShare);

      // Calculate Herfindahl-Hirschman Index (HHI)
      const hhi = marketShares.reduce(
        (sum, ms) => sum + Math.pow(ms.marketShare * 100, 2),
        0
      );

      // Competitiveness score (inverse of concentration)
      const competitiveness = 1 - (hhi / 10000);

      results[query] = {
        competitiveness,
        topCompetitors: marketShares.slice(0, 5),
        herfindahlIndex: hhi,
      };
    }

    return results;
  }

  /**
   * Calculate keyword efficiency metrics
   */
  calculateEfficiencyMetrics(
    keyword: {
      query: string;
      impressions: number;
      clicks: number;
      purchases: number;
      revenue: number;
      adSpend?: number;
    }
  ): {
    roas: number;
    costPerPurchase: number;
    revenuePerImpression: number;
    profitability: number;
  } {
    const adSpend = keyword.adSpend || 0;
    const roas = adSpend > 0 ? keyword.revenue / adSpend : 0;
    const costPerPurchase = keyword.purchases > 0 ? adSpend / keyword.purchases : 0;
    const revenuePerImpression = keyword.impressions > 0 
      ? keyword.revenue / keyword.impressions 
      : 0;
    const profitability = keyword.revenue - adSpend;

    return {
      roas,
      costPerPurchase,
      revenuePerImpression,
      profitability,
    };
  }

  /**
   * Identify keyword opportunities
   */
  identifyOpportunities(
    scores: KeywordPerformanceScore[],
    criteria: {
      minImpressions: number;
      minOpportunityScore: number;
      maxCurrentCVR: number;
    }
  ): Array<{
    query: string;
    reason: string;
    potentialImprovement: number;
    recommendedAction: string;
  }> {
    const opportunities: any[] = [];

    for (const score of scores) {
      const { metrics } = score;
      
      // High volume, low conversion
      if (
        metrics.impressions >= criteria.minImpressions &&
        metrics.cvr < criteria.maxCurrentCVR &&
        score.opportunityScore >= criteria.minOpportunityScore
      ) {
        opportunities.push({
          query: score.query,
          reason: 'High volume with low conversion rate',
          potentialImprovement: score.opportunityScore,
          recommendedAction: 'Optimize product listing and images for this keyword',
        });
      }

      // Good CTR, poor CVR
      if (
        metrics.ctr > 0.02 &&
        metrics.cvr < 0.05 &&
        metrics.impressions >= criteria.minImpressions / 2
      ) {
        opportunities.push({
          query: score.query,
          reason: 'Good engagement but poor conversion',
          potentialImprovement: (0.1 - metrics.cvr) * metrics.clicks,
          recommendedAction: 'Review pricing and product page for this traffic',
        });
      }

      // Underperforming compared to similar keywords
      if (
        score.performanceScore < 30 &&
        metrics.impressions >= criteria.minImpressions
      ) {
        opportunities.push({
          query: score.query,
          reason: 'Underperforming despite decent volume',
          potentialImprovement: 50 - score.performanceScore,
          recommendedAction: 'Consider pausing or restructuring campaigns for this keyword',
        });
      }
    }

    return opportunities;
  }

  /**
   * Group keywords by performance patterns
   */
  groupByPerformancePattern(
    scores: KeywordPerformanceScore[]
  ): Record<string, KeywordPerformanceScore[]> {
    const patterns = {
      highPerformers: [] as KeywordPerformanceScore[],
      risingStars: [] as KeywordPerformanceScore[],
      steadyPerformers: [] as KeywordPerformanceScore[],
      underperformers: [] as KeywordPerformanceScore[],
      highPotential: [] as KeywordPerformanceScore[],
    };

    for (const score of scores) {
      if (score.performanceScore >= 80) {
        patterns.highPerformers.push(score);
      } else if (score.performanceScore >= 60 && score.opportunityScore >= 70) {
        patterns.risingStars.push(score);
      } else if (score.performanceScore >= 50 && score.performanceScore < 60) {
        patterns.steadyPerformers.push(score);
      } else if (score.performanceScore < 30) {
        patterns.underperformers.push(score);
      } else if (score.opportunityScore >= 80) {
        patterns.highPotential.push(score);
      }
    }

    return patterns;
  }

  /**
   * Private helper methods
   */
  private calculateKeywordStats(keywords: any[]): any {
    const impressions = keywords.map(k => k.impressions);
    const ctrs = keywords.map(k => k.impressions > 0 ? k.clicks / k.impressions : 0);
    const cvrs = keywords.map(k => k.clicks > 0 ? k.purchases / k.clicks : 0);
    const efficiencies = keywords.map(k => k.impressions > 0 ? k.purchases / k.impressions : 0);

    return {
      impressions: {
        max: Math.max(...impressions),
        avg: this.average(impressions),
      },
      ctr: {
        max: Math.max(...ctrs),
        avg: this.average(ctrs),
      },
      cvr: {
        max: Math.max(...cvrs),
        avg: this.average(cvrs),
      },
      efficiency: {
        max: Math.max(...efficiencies),
        avg: this.average(efficiencies),
      },
    };
  }

  private normalizeScore(value: number, max: number): number {
    if (max === 0) return 0;
    return Math.min(100, (value / max) * 100);
  }

  private calculateOpportunityScore(params: {
    impressions: number;
    ctr: number;
    cvr: number;
    avgCtr: number;
    avgCvr: number;
  }): number {
    const { impressions, ctr, cvr, avgCtr, avgCvr } = params;
    
    // Higher opportunity if high volume but below average performance
    let score = 0;
    
    // Volume component (0-40 points)
    const volumeScore = Math.min(40, Math.log10(impressions + 1) * 10);
    score += volumeScore;
    
    // Performance gap component (0-60 points)
    const ctrGap = Math.max(0, avgCtr - ctr) / avgCtr;
    const cvrGap = Math.max(0, avgCvr - cvr) / avgCvr;
    const gapScore = (ctrGap * 30 + cvrGap * 30);
    score += gapScore;
    
    return Math.min(100, score);
  }

  private determineTier(performanceScore: number): KeywordPerformanceScore['tier'] {
    if (performanceScore >= 80) return 'top';
    if (performanceScore >= 60) return 'high';
    if (performanceScore >= 40) return 'medium';
    if (performanceScore >= 20) return 'low';
    return 'bottom';
  }

  private average(values: number[]): number {
    return values.length > 0 
      ? values.reduce((sum, val) => sum + val, 0) / values.length 
      : 0;
  }
}