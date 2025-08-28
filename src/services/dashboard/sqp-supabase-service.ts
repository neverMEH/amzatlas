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
      // Use the RPC function to get metrics with comparison
      const { data, error } = await this.getClient()
        .rpc('get_dashboard_metrics_comparison', {
          p_start_date: startDate,
          p_end_date: endDate
        });
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const metrics = data[0];
        return {
          totalPurchases: metrics.total_purchases || 0,
          weekOverWeekChange: metrics.week_over_week_change || 0,
          marketShare: metrics.market_share || 0,
          marketShareChange: metrics.market_share_change || 0,
          purchaseCVR: metrics.purchase_cvr || 0,
          cvrChange: metrics.cvr_change || 0,
          zeroPurchaseKeywords: metrics.zero_purchase_keywords || 0,
          zeroPurchaseChange: metrics.zero_purchase_change || 0,
          purchaseROI: metrics.purchase_roi || 0,
          roiChange: metrics.roi_change || 0,
        };
      }
      
      // Return zeros if no data
      return {
        totalPurchases: 0,
        weekOverWeekChange: 0,
        marketShare: 0,
        marketShareChange: 0,
        purchaseCVR: 0,
        cvrChange: 0,
        zeroPurchaseKeywords: 0,
        zeroPurchaseChange: 0,
        purchaseROI: 0,
        roiChange: 0,
      };
    } catch (error) {
      console.error('Error fetching purchase metrics from Supabase:', error);
      // Only return mock data in development
      if (process.env.NODE_ENV === 'development') {
        return this.getMockMetrics();
      }
      throw error;
    }
  }
  
  async getTopKeywords(limit: number = 10): Promise<KeywordPerformance[]> {
    try {
      // Use the RPC function to get top keywords
      const { data, error } = await this.getClient()
        .rpc('get_dashboard_keywords', {
          p_limit: limit,
          p_type: 'top'
        });
      
      if (error) throw error;
      
      return (data || []).map((row: any) => ({
        keyword: row.keyword,
        purchases: row.purchases,
        marketPurchases: row.market_purchases,
        share: row.share,
        cvr: row.cvr,
        spend: row.spend,
        roi: row.roi,
        trend: row.trend as 'up' | 'down' | 'stable',
      }));
    } catch (error) {
      console.error('Error fetching top keywords:', error);
      if (process.env.NODE_ENV === 'development') {
        return this.getMockKeywords();
      }
      return [];
    }
  }
  
  async getPurchaseTrends(weeks: number = 12): Promise<PurchaseTrend[]> {
    try {
      // Use the RPC function to get trends
      const { data, error } = await this.getClient()
        .rpc('get_dashboard_trends', {
          p_weeks: weeks
        });
      
      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error('Error fetching purchase trends:', error);
      if (process.env.NODE_ENV === 'development') {
        return this.getMockTrends();
      }
      return [];
    }
  }
  
  async getZeroPurchaseKeywords(limit: number = 20): Promise<KeywordPerformance[]> {
    try {
      // Use the RPC function to get zero purchase keywords
      const { data, error } = await this.getClient()
        .rpc('get_dashboard_keywords', {
          p_limit: limit,
          p_type: 'zero-purchase'
        });
      
      if (error) throw error;
      
      return (data || []).map((row: any) => ({
        keyword: row.keyword,
        purchases: row.purchases,
        marketPurchases: row.market_purchases,
        share: row.share,
        cvr: row.cvr,
        spend: row.spend,
        roi: row.roi,
        trend: row.trend as 'up' | 'down' | 'stable',
      }));
    } catch (error) {
      console.error('Error fetching zero purchase keywords:', error);
      if (process.env.NODE_ENV === 'development') {
        return this.getMockZeroPurchaseKeywords();
      }
      return [];
    }
  }
  
  async getRisingKeywords(limit: number = 20): Promise<KeywordPerformance[]> {
    try {
      // Use the RPC function to get rising keywords
      const { data, error } = await this.getClient()
        .rpc('get_dashboard_keywords', {
          p_limit: limit,
          p_type: 'rising'
        });
      
      if (error) throw error;
      
      return (data || []).map((row: any) => ({
        keyword: row.keyword,
        purchases: row.purchases,
        marketPurchases: row.market_purchases,
        share: row.share,
        cvr: row.cvr,
        spend: row.spend,
        roi: row.roi,
        trend: row.trend as 'up' | 'down' | 'stable',
      }));
    } catch (error) {
      console.error('Error fetching rising keywords:', error);
      if (process.env.NODE_ENV === 'development') {
        return this.getMockRisingKeywords();
      }
      return [];
    }
  }
  
  async getNegativeROIKeywords(limit: number = 20): Promise<KeywordPerformance[]> {
    try {
      // Use the RPC function to get negative ROI keywords
      const { data, error } = await this.getClient()
        .rpc('get_dashboard_keywords', {
          p_limit: limit,
          p_type: 'negative-roi'
        });
      
      if (error) throw error;
      
      return (data || []).map((row: any) => ({
        keyword: row.keyword,
        purchases: row.purchases,
        marketPurchases: row.market_purchases,
        share: row.share,
        cvr: row.cvr,
        spend: row.spend,
        roi: row.roi,
        trend: row.trend as 'up' | 'down' | 'stable',
      }));
    } catch (error) {
      console.error('Error fetching negative ROI keywords:', error);
      if (process.env.NODE_ENV === 'development') {
        return this.getMockNegativeROIKeywords();
      }
      return [];
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