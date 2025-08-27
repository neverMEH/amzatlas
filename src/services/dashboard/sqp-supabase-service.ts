import { createClient } from '@supabase/supabase-js';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { PurchaseMetrics, KeywordPerformance, PurchaseTrend } from '@/types/dashboard';

class SQPSupabaseService {
  private supabase: any;
  
  constructor() {
    // Initialize lazily to avoid build-time errors
  }
  
  private getClient() {
    if (!this.supabase) {
      this.supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
    }
    return this.supabase;
  }
  
  async getPurchaseMetrics(dateRange: { start: Date; end: Date }): Promise<PurchaseMetrics> {
    const startDate = format(dateRange.start, 'yyyy-MM-dd');
    const endDate = format(dateRange.end, 'yyyy-MM-dd');
    
    try {
      // Get current period metrics
      const { data: currentData, error: currentError } = await this.getClient()
        .from('sqp.weekly_summary')
        .select('total_purchases, total_clicks, purchase_share')
        .gte('period_start', startDate)
        .lte('period_end', endDate);
      
      if (currentError) throw currentError;
      
      // Get previous period for comparison
      const daysDiff = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
      const prevStart = format(subDays(dateRange.start, daysDiff), 'yyyy-MM-dd');
      const prevEnd = format(subDays(dateRange.end, daysDiff), 'yyyy-MM-dd');
      
      const { data: previousData, error: previousError } = await this.getClient()
        .from('sqp.weekly_summary')
        .select('total_purchases, total_clicks, purchase_share')
        .gte('period_start', prevStart)
        .lte('period_end', prevEnd);
      
      if (previousError) throw previousError;
      
      // Calculate aggregates
      const current = this.aggregateMetrics(currentData || []);
      const previous = this.aggregateMetrics(previousData || []);
      
      // Get zero purchase keywords count
      const { count: zeroCount } = await this.getClient()
        .from('sqp.weekly_summary')
        .select('query', { count: 'exact', head: true })
        .gte('period_start', startDate)
        .lte('period_end', endDate)
        .gt('total_clicks', 0)
        .eq('total_purchases', 0);
      
      const { count: prevZeroCount } = await this.getClient()
        .from('sqp.weekly_summary')
        .select('query', { count: 'exact', head: true })
        .gte('period_start', prevStart)
        .lte('period_end', prevEnd)
        .gt('total_clicks', 0)
        .eq('total_purchases', 0);
      
      return {
        totalPurchases: current.totalPurchases,
        weekOverWeekChange: this.calculatePercentChange(current.totalPurchases, previous.totalPurchases),
        marketShare: current.avgShare,
        marketShareChange: current.avgShare - previous.avgShare,
        purchaseCVR: current.cvr,
        cvrChange: current.cvr - previous.cvr,
        zeroPurchaseKeywords: zeroCount || 0,
        zeroPurchaseChange: (zeroCount || 0) - (prevZeroCount || 0),
        purchaseROI: current.roi,
        roiChange: current.roi - previous.roi,
      };
    } catch (error) {
      console.error('Error fetching purchase metrics from Supabase:', error);
      return this.getMockMetrics();
    }
  }
  
  async getTopKeywords(limit: number = 10): Promise<KeywordPerformance[]> {
    try {
      const { data, error } = await this.getClient()
        .from('sqp.weekly_summary')
        .select('query, total_purchases, total_impressions, total_clicks, purchase_share, avg_cvr')
        .order('total_purchases', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return (data || []).map((row: any) => ({
        keyword: row.query,
        purchases: row.total_purchases,
        marketPurchases: Math.round(row.total_purchases / (row.purchase_share || 0.01)),
        share: row.purchase_share * 100,
        cvr: row.avg_cvr * 100,
        spend: this.estimateSpend(row.total_clicks),
        roi: this.estimateROI(row.total_purchases, row.total_clicks),
        trend: 'stable' as const,
      }));
    } catch (error) {
      console.error('Error fetching top keywords:', error);
      return this.getMockKeywords();
    }
  }
  
  async getPurchaseTrends(weeks: number = 12): Promise<PurchaseTrend[]> {
    try {
      const endDate = new Date();
      const startDate = subDays(endDate, weeks * 7);
      
      const { data, error } = await this.getClient()
        .from('sqp.weekly_summary')
        .select('period_start, total_purchases, total_impressions')
        .gte('period_start', format(startDate, 'yyyy-MM-dd'))
        .lte('period_start', format(endDate, 'yyyy-MM-dd'))
        .order('period_start', { ascending: true });
      
      if (error) throw error;
      
      // Group by week
      const weeklyData = new Map<string, { purchases: number; market: number }>();
      
      (data || []).forEach((row: any) => {
        const weekStart = startOfWeek(new Date(row.period_start));
        const weekKey = format(weekStart, 'yyyy-MM-dd');
        
        if (!weeklyData.has(weekKey)) {
          weeklyData.set(weekKey, { purchases: 0, market: 0 });
        }
        
        const week = weeklyData.get(weekKey)!;
        week.purchases += row.total_purchases;
        week.market += Math.round(row.total_purchases / 0.2); // Assume 20% market share
      });
      
      return Array.from(weeklyData.entries()).map(([weekStart, data], index) => ({
        week: `W${index + 1}`,
        purchases: data.purchases,
        market: data.market,
      }));
    } catch (error) {
      console.error('Error fetching purchase trends:', error);
      return this.getMockTrends();
    }
  }
  
  async getZeroPurchaseKeywords(limit: number = 20): Promise<KeywordPerformance[]> {
    try {
      const { data, error } = await this.getClient()
        .from('sqp.weekly_summary')
        .select('query, total_clicks, total_impressions')
        .eq('total_purchases', 0)
        .gt('total_clicks', 0)
        .order('total_clicks', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return (data || []).map((row: any) => ({
        keyword: row.query,
        purchases: 0,
        marketPurchases: Math.round(row.total_impressions * 0.04), // Estimate market purchases
        share: 0,
        cvr: 0,
        spend: this.estimateSpend(row.total_clicks),
        roi: -100,
        trend: 'down' as const,
      }));
    } catch (error) {
      console.error('Error fetching zero purchase keywords:', error);
      return this.getMockZeroPurchaseKeywords();
    }
  }
  
  async getRisingKeywords(limit: number = 20): Promise<KeywordPerformance[]> {
    try {
      // Compare last week to previous week
      const { data, error } = await this.getClient()
        .from('period_comparisons')
        .select('query, current_purchases, previous_purchases, current_clicks, purchases_change_pct')
        .eq('period_type', 'weekly')
        .gt('purchases_change_pct', 20)
        .order('purchases_change_pct', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return (data || []).map((row: any) => ({
        keyword: row.query,
        purchases: row.current_purchases,
        marketPurchases: Math.round(row.current_purchases / 0.2),
        share: 20,
        cvr: row.current_clicks > 0 ? (row.current_purchases / row.current_clicks) * 100 : 0,
        spend: this.estimateSpend(row.current_clicks),
        roi: this.estimateROI(row.current_purchases, row.current_clicks),
        trend: 'up' as const,
      }));
    } catch (error) {
      console.error('Error fetching rising keywords:', error);
      return this.getMockRisingKeywords();
    }
  }
  
  async getNegativeROIKeywords(limit: number = 20): Promise<KeywordPerformance[]> {
    try {
      const { data, error } = await this.getClient()
        .from('sqp.weekly_summary')
        .select('query, total_purchases, total_clicks, total_impressions, purchase_share')
        .gt('total_clicks', 10) // Minimum clicks threshold
        .lt('avg_cvr', 0.02) // Low conversion rate
        .order('total_clicks', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return (data || []).map((row: any) => {
        const spend = this.estimateSpend(row.total_clicks);
        const revenue = row.total_purchases * 50; // Assume $50 average order value
        const roi = ((revenue - spend) / spend) * 100;
        
        return {
          keyword: row.query,
          purchases: row.total_purchases,
          marketPurchases: Math.round(row.total_purchases / (row.purchase_share || 0.01)),
          share: row.purchase_share * 100,
          cvr: (row.total_purchases / row.total_clicks) * 100,
          spend,
          roi,
          trend: 'down' as const,
        };
      });
    } catch (error) {
      console.error('Error fetching negative ROI keywords:', error);
      return this.getMockNegativeROIKeywords();
    }
  }
  
  // Helper methods
  private aggregateMetrics(data: any[]) {
    const totalPurchases = data.reduce((sum, row) => sum + row.total_purchases, 0);
    const totalClicks = data.reduce((sum, row) => sum + row.total_clicks, 0);
    const avgShare = data.length > 0 
      ? data.reduce((sum, row) => sum + row.purchase_share, 0) / data.length * 100
      : 0;
    const cvr = totalClicks > 0 ? (totalPurchases / totalClicks) * 100 : 0;
    const roi = this.estimateROI(totalPurchases, totalClicks);
    
    return { totalPurchases, totalClicks, avgShare, cvr, roi };
  }
  
  private calculatePercentChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }
  
  private estimateSpend(clicks: number): number {
    // Estimate $0.50 CPC average
    return clicks * 0.50;
  }
  
  private estimateROI(purchases: number, clicks: number): number {
    const revenue = purchases * 50; // $50 average order value
    const spend = this.estimateSpend(clicks);
    return spend > 0 ? ((revenue - spend) / spend) * 100 : 0;
  }
  
  // Mock data methods (same as before but with more realistic data)
  private getMockMetrics(): PurchaseMetrics {
    return {
      totalPurchases: 2547,
      weekOverWeekChange: 12.3,
      marketShare: 23.7,
      marketShareChange: 2.1,
      purchaseCVR: 4.2,
      cvrChange: -0.3,
      zeroPurchaseKeywords: 127,
      zeroPurchaseChange: -15,
      purchaseROI: 247,
      roiChange: 18,
    };
  }
  
  private getMockKeywords(): KeywordPerformance[] {
    return [
      {
        keyword: 'organic coffee beans',
        purchases: 342,
        marketPurchases: 1456,
        share: 23.5,
        cvr: 4.2,
        spend: 1250,
        roi: 285,
        trend: 'up',
      },
      {
        keyword: 'fair trade coffee',
        purchases: 287,
        marketPurchases: 1823,
        share: 15.7,
        cvr: 3.8,
        spend: 980,
        roi: 245,
        trend: 'up',
      },
      {
        keyword: 'colombian coffee',
        purchases: 198,
        marketPurchases: 921,
        share: 21.5,
        cvr: 5.1,
        spend: 560,
        roi: 320,
        trend: 'down',
      },
    ];
  }
  
  private getMockTrends(): PurchaseTrend[] {
    const weeks = 12;
    const trends: PurchaseTrend[] = [];
    const baseValue = 1800;
    
    for (let i = 0; i < weeks; i++) {
      trends.push({
        week: `W${i + 1}`,
        purchases: baseValue + (i * 100) + Math.floor(Math.random() * 200),
        market: (baseValue * 4) + (i * 400) + Math.floor(Math.random() * 800),
      });
    }
    
    return trends;
  }
  
  private getMockZeroPurchaseKeywords(): KeywordPerformance[] {
    return [
      {
        keyword: 'expensive coffee maker',
        purchases: 0,
        marketPurchases: 145,
        share: 0,
        cvr: 0,
        spend: 234,
        roi: -100,
        trend: 'down',
      },
      {
        keyword: 'premium espresso beans',
        purchases: 0,
        marketPurchases: 78,
        share: 0,
        cvr: 0,
        spend: 189,
        roi: -100,
        trend: 'down',
      },
    ];
  }
  
  private getMockRisingKeywords(): KeywordPerformance[] {
    return [
      {
        keyword: 'cold brew coffee maker',
        purchases: 89,
        marketPurchases: 234,
        share: 38.0,
        cvr: 6.7,
        spend: 456,
        roi: 420,
        trend: 'up',
      },
      {
        keyword: 'pour over coffee kit',
        purchases: 67,
        marketPurchases: 189,
        share: 35.4,
        cvr: 5.9,
        spend: 345,
        roi: 380,
        trend: 'up',
      },
    ];
  }
  
  private getMockNegativeROIKeywords(): KeywordPerformance[] {
    return [
      {
        keyword: 'cheap coffee filters',
        purchases: 12,
        marketPurchases: 456,
        share: 2.6,
        cvr: 1.2,
        spend: 567,
        roi: 45,
        trend: 'down',
      },
      {
        keyword: 'discount coffee pods',
        purchases: 8,
        marketPurchases: 234,
        share: 3.4,
        cvr: 0.9,
        spend: 345,
        roi: 32,
        trend: 'down',
      },
    ];
  }
}

// Export singleton instance
export const sqpSupabaseService = new SQPSupabaseService();