import { SQPRecord, DerivedMetrics, AdvancedMetrics } from '../types';

export class MetricsCalculator {
  /**
   * Calculate derived metrics from raw SQP data
   */
  calculateDerivedMetrics(record: SQPRecord): DerivedMetrics {
    const ctr = record.impressions > 0 ? record.clicks / record.impressions : 0;
    const cvr = record.clicks > 0 ? record.purchases / record.clicks : 0;
    const purchasesPerImpression = record.impressions > 0 
      ? record.purchases / record.impressions 
      : 0;

    // Calculate funnel efficiency
    const funnelEfficiency = this.calculateFunnelEfficiency({
      impressions: record.impressions,
      clicks: record.clicks,
      purchases: record.purchases,
    });

    // Calculate engagement score
    const engagementScore = this.calculateEngagementScore({
      ctr,
      bounceRate: 1 - cvr, // Simplified: assume click without purchase is bounce
    });

    // Calculate value scores (placeholder without revenue data)
    const purchaseValueScore = record.purchases * 50; // Placeholder value
    const lifetimeValueScore = purchaseValueScore * 2.5; // Placeholder multiplier

    return {
      ctr,
      cvr,
      purchasesPerThousandImpressions: purchasesPerImpression * 1000,
      clicksPerPurchase: record.purchases > 0 ? record.clicks / record.purchases : 0,
      impressionsPerPurchase: record.purchases > 0 ? record.impressions / record.purchases : 0,
      qualityScore: (ctr * 0.4 + cvr * 0.4 + (purchasesPerImpression * 100) * 0.2),
    };
  }

  /**
   * Calculate advanced metrics with revenue data
   */
  calculateAdvancedMetrics(data: {
    query: string;
    asin: string;
    impressions: number;
    clicks: number;
    purchases: number;
    revenue: number;
    adSpend: number;
  }): AdvancedMetrics {
    const { impressions, clicks, purchases, revenue, adSpend } = data;

    // Basic rates
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cvr = clicks > 0 ? purchases / clicks : 0;

    // Cost metrics
    const cpc = clicks > 0 ? adSpend / clicks : 0;
    const cpa = purchases > 0 ? adSpend / purchases : 0;
    const acos = revenue > 0 ? (adSpend / revenue) * 100 : 0;

    // Revenue metrics
    const roas = adSpend > 0 ? revenue / adSpend : 0;
    const revenuePerClick = clicks > 0 ? revenue / clicks : 0;
    const revenuePerImpression = impressions > 0 ? revenue / impressions : 0;
    const averageOrderValue = purchases > 0 ? revenue / purchases : 0;

    // Profitability metrics
    const profit = revenue - adSpend;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const profitPerClick = clicks > 0 ? profit / clicks : 0;
    const profitPerImpression = impressions > 0 ? profit / impressions : 0;

    // Efficiency scores
    const costEfficiency = this.calculateCostEfficiency({ cpc, cpa, acos });
    const revenueEfficiency = this.calculateRevenueEfficiency({ roas, revenuePerClick });
    const overallEfficiency = (costEfficiency + revenueEfficiency) / 2;

    return {
      // Basic DerivedMetrics properties
      ctr,
      cvr,
      purchasesPerThousandImpressions: (purchases / impressions) * 1000,
      clicksPerPurchase: purchases > 0 ? clicks / purchases : 0,
      impressionsPerPurchase: purchases > 0 ? impressions / purchases : 0,
      qualityScore: (ctr * 0.4 + cvr * 0.4 + ((purchases / impressions) * 100) * 0.2),
      
      // AdvancedMetrics properties
      roas,
      acos,
      profitMargin,
      ltv: averageOrderValue * 2.5, // Placeholder LTV calculation
      cac: purchases > 0 ? adSpend / purchases : 0, // Customer acquisition cost
    };
  }

  /**
   * Calculate lifetime value metrics
   */
  calculateLTV(data: {
    averageOrderValue: number;
    purchaseFrequency: number;
    customerLifespan: number;
    discountRate?: number;
  }): {
    simpleLTV: number;
    discountedLTV: number;
    ltv3Month: number;
    ltv6Month: number;
    ltv12Month: number;
  } {
    const { averageOrderValue, purchaseFrequency, customerLifespan, discountRate = 0.1 } = data;
    
    // Simple LTV calculation
    const simpleLTV = averageOrderValue * purchaseFrequency * customerLifespan;
    
    // Discounted LTV (NPV of future cash flows)
    const monthlyRevenue = averageOrderValue * (purchaseFrequency / 12);
    const monthlyDiscountRate = discountRate / 12;
    let discountedLTV = 0;
    
    for (let month = 1; month <= customerLifespan * 12; month++) {
      discountedLTV += monthlyRevenue / Math.pow(1 + monthlyDiscountRate, month);
    }
    
    // Period-specific LTVs
    const ltv3Month = averageOrderValue * purchaseFrequency * 0.25;
    const ltv6Month = averageOrderValue * purchaseFrequency * 0.5;
    const ltv12Month = averageOrderValue * purchaseFrequency;
    
    return {
      simpleLTV,
      discountedLTV,
      ltv3Month,
      ltv6Month,
      ltv12Month,
    };
  }

  /**
   * Calculate attribution metrics
   */
  calculateAttribution(touchpoints: Array<{
    channel: string;
    timestamp: Date;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
  }>): {
    firstTouch: Record<string, number>;
    lastTouch: Record<string, number>;
    linear: Record<string, number>;
    timeDecay: Record<string, number>;
    dataDriver: Record<string, number>;
  } {
    const sorted = touchpoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const totalRevenue = touchpoints.reduce((sum, tp) => sum + tp.revenue, 0);
    
    // First-touch attribution
    const firstTouch: Record<string, number> = {};
    if (sorted.length > 0) {
      firstTouch[sorted[0].channel] = totalRevenue;
    }
    
    // Last-touch attribution
    const lastTouch: Record<string, number> = {};
    if (sorted.length > 0) {
      lastTouch[sorted[sorted.length - 1].channel] = totalRevenue;
    }
    
    // Linear attribution
    const linear: Record<string, number> = {};
    const revenuePerTouch = totalRevenue / touchpoints.length;
    for (const tp of touchpoints) {
      linear[tp.channel] = (linear[tp.channel] || 0) + revenuePerTouch;
    }
    
    // Time-decay attribution
    const timeDecay: Record<string, number> = {};
    const decayFactor = 0.5;
    let totalWeight = 0;
    const weights = sorted.map((_, index) => {
      const weight = Math.pow(1 + decayFactor, index);
      totalWeight += weight;
      return weight;
    });
    
    sorted.forEach((tp, index) => {
      const attribution = (weights[index] / totalWeight) * totalRevenue;
      timeDecay[tp.channel] = (timeDecay[tp.channel] || 0) + attribution;
    });
    
    // Data-driven attribution (simplified based on conversion rates)
    const dataDriver: Record<string, number> = {};
    const totalConversions = touchpoints.reduce((sum, tp) => sum + tp.conversions, 0);
    
    for (const tp of touchpoints) {
      const conversionWeight = totalConversions > 0 ? tp.conversions / totalConversions : 0;
      dataDriver[tp.channel] = (dataDriver[tp.channel] || 0) + (conversionWeight * totalRevenue);
    }
    
    return {
      firstTouch,
      lastTouch,
      linear,
      timeDecay,
      dataDriver,
    };
  }

  /**
   * Calculate cohort metrics
   */
  calculateCohortMetrics(cohortData: Array<{
    cohortWeek: string;
    weeksSinceCohort: number;
    users: number;
    revenue: number;
    purchases: number;
  }>): {
    retentionCurve: Array<{ week: number; retentionRate: number }>;
    revenueCurve: Array<{ week: number; cumulativeRevenue: number }>;
    avgRevenuePerUser: Array<{ week: number; arpu: number }>;
    paybackPeriod: number;
  } {
    const byCohort = new Map<string, any[]>();
    
    // Group by cohort
    for (const data of cohortData) {
      if (!byCohort.has(data.cohortWeek)) {
        byCohort.set(data.cohortWeek, []);
      }
      byCohort.get(data.cohortWeek)!.push(data);
    }
    
    // Calculate average metrics across cohorts
    const weeklyMetrics = new Map<number, { users: number[]; revenue: number[] }>();
    
    for (const [cohort, weeks] of byCohort.entries()) {
      const week0Users = weeks.find(w => w.weeksSinceCohort === 0)?.users || 1;
      
      for (const week of weeks) {
        if (!weeklyMetrics.has(week.weeksSinceCohort)) {
          weeklyMetrics.set(week.weeksSinceCohort, { users: [], revenue: [] });
        }
        
        const metrics = weeklyMetrics.get(week.weeksSinceCohort)!;
        metrics.users.push(week.users / week0Users);
        metrics.revenue.push(week.revenue);
      }
    }
    
    // Calculate curves
    const retentionCurve: Array<{ week: number; retentionRate: number }> = [];
    const revenueCurve: Array<{ week: number; cumulativeRevenue: number }> = [];
    const avgRevenuePerUser: Array<{ week: number; arpu: number }> = [];
    
    let cumulativeRevenue = 0;
    let paybackPeriod = -1;
    const acquisitionCost = 50; // Placeholder CAC
    
    for (const [week, metrics] of Array.from(weeklyMetrics.entries()).sort((a, b) => a[0] - b[0])) {
      const avgRetention = this.average(metrics.users);
      const avgRevenue = this.average(metrics.revenue);
      
      cumulativeRevenue += avgRevenue;
      
      retentionCurve.push({ week, retentionRate: avgRetention });
      revenueCurve.push({ week, cumulativeRevenue });
      avgRevenuePerUser.push({ week, arpu: cumulativeRevenue });
      
      if (paybackPeriod === -1 && cumulativeRevenue >= acquisitionCost) {
        paybackPeriod = week;
      }
    }
    
    return {
      retentionCurve,
      revenueCurve,
      avgRevenuePerUser,
      paybackPeriod: paybackPeriod === -1 ? Infinity : paybackPeriod,
    };
  }

  /**
   * Private helper methods
   */
  private calculateFunnelEfficiency(params: {
    impressions: number;
    clicks: number;
    purchases: number;
  }): number {
    const { impressions, clicks, purchases } = params;
    
    if (impressions === 0) return 0;
    
    // Calculate step conversion rates
    const impressionToClick = clicks / impressions;
    const clickToPurchase = clicks > 0 ? purchases / clicks : 0;
    
    // Geometric mean of conversion rates
    return Math.sqrt(impressionToClick * clickToPurchase) * 100;
  }

  private calculateEngagementScore(params: {
    ctr: number;
    bounceRate: number;
  }): number {
    const { ctr, bounceRate } = params;
    
    // Weight CTR positively and bounce rate negatively
    const ctrScore = Math.min(ctr * 1000, 100); // Cap at 10% CTR
    const bounceScore = (1 - bounceRate) * 100;
    
    return (ctrScore * 0.6 + bounceScore * 0.4);
  }

  private calculateCostEfficiency(params: {
    cpc: number;
    cpa: number;
    acos: number;
  }): number {
    const { cpc, cpa, acos } = params;
    
    // Lower costs = higher efficiency
    const cpcScore = cpc > 0 ? Math.max(0, 100 - cpc * 50) : 100;
    const cpaScore = cpa > 0 ? Math.max(0, 100 - cpa * 2) : 100;
    const acosScore = Math.max(0, 100 - acos);
    
    return (cpcScore * 0.2 + cpaScore * 0.4 + acosScore * 0.4);
  }

  private calculateRevenueEfficiency(params: {
    roas: number;
    revenuePerClick: number;
  }): number {
    const { roas, revenuePerClick } = params;
    
    // Higher revenue = higher efficiency
    const roasScore = Math.min(roas * 25, 100); // Cap at 4x ROAS
    const rpcScore = Math.min(revenuePerClick * 10, 100); // Cap at $10/click
    
    return (roasScore * 0.7 + rpcScore * 0.3);
  }

  private average(values: number[]): number {
    return values.length > 0 
      ? values.reduce((sum, val) => sum + val, 0) / values.length 
      : 0;
  }
}