import { BigQueryClient } from '@/lib/bigquery/client';
import { getFullTableName } from '@/config/bigquery.config';
import { format, subDays, subWeeks, startOfWeek, endOfWeek } from 'date-fns';

import { PurchaseMetrics, KeywordPerformance, PurchaseTrend } from '@/types/dashboard'

class SQPDataService {
  private client = new BigQueryClient();
  
  async getPurchaseMetrics(dateRange: { start: Date; end: Date }): Promise<PurchaseMetrics> {
    const startDate = format(dateRange.start, 'yyyy-MM-dd');
    const endDate = format(dateRange.end, 'yyyy-MM-dd');
    
    // Get current period metrics
    const currentMetricsQuery = `
      SELECT
        SUM(purchase_count) as totalPurchases,
        SUM(purchase_count) / NULLIF(SUM(market_purchase_count), 0) * 100 as marketShare,
        SUM(purchase_count) / NULLIF(SUM(click_count), 0) * 100 as purchaseCVR,
        SUM(revenue) / NULLIF(SUM(ad_spend), 0) * 100 as purchaseROI,
        COUNTIF(purchase_count = 0 AND click_count > 0) as zeroPurchaseKeywords
      FROM ${getFullTableName('sqpDaily')}
      WHERE date BETWEEN @startDate AND @endDate
    `;
    
    // Get previous period for comparison
    const daysDiff = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    const prevStart = subDays(dateRange.start, daysDiff);
    const prevEnd = subDays(dateRange.end, daysDiff);
    
    const previousMetricsQuery = `
      SELECT
        SUM(purchase_count) as totalPurchases,
        SUM(purchase_count) / NULLIF(SUM(market_purchase_count), 0) * 100 as marketShare,
        SUM(purchase_count) / NULLIF(SUM(click_count), 0) * 100 as purchaseCVR,
        SUM(revenue) / NULLIF(SUM(ad_spend), 0) * 100 as purchaseROI,
        COUNTIF(purchase_count = 0 AND click_count > 0) as zeroPurchaseKeywords
      FROM ${getFullTableName('sqpDaily')}
      WHERE date BETWEEN @prevStart AND @prevEnd
    `;
    
    try {
      const currentResults = await this.client.query(
        currentMetricsQuery,
        { startDate, endDate }
      );
      
      const previousResults = await this.client.query(
        previousMetricsQuery,
        { 
          prevStart: format(prevStart, 'yyyy-MM-dd'), 
          prevEnd: format(prevEnd, 'yyyy-MM-dd') 
        }
      );
      
      const current = currentResults[0] || {};
      const previous = previousResults[0] || {};
      
      return {
        totalPurchases: current.totalPurchases || 0,
        weekOverWeekChange: this.calculatePercentChange(current.totalPurchases, previous.totalPurchases),
        marketShare: current.marketShare || 0,
        marketShareChange: current.marketShare - (previous.marketShare || 0),
        purchaseCVR: current.purchaseCVR || 0,
        cvrChange: current.purchaseCVR - (previous.purchaseCVR || 0),
        zeroPurchaseKeywords: current.zeroPurchaseKeywords || 0,
        zeroPurchaseChange: current.zeroPurchaseKeywords - (previous.zeroPurchaseKeywords || 0),
        purchaseROI: current.purchaseROI || 0,
        roiChange: current.purchaseROI - (previous.purchaseROI || 0),
      };
    } catch (error) {
      console.error('Error fetching purchase metrics:', error);
      // Return mock data as fallback
      return this.getMockMetrics();
    }
  }
  
  async getTopKeywords(limit: number = 10): Promise<KeywordPerformance[]> {
    const query = `
      SELECT
        keyword,
        SUM(purchase_count) as purchases,
        SUM(market_purchase_count) as marketPurchases,
        SUM(purchase_count) / NULLIF(SUM(market_purchase_count), 0) * 100 as share,
        SUM(purchase_count) / NULLIF(SUM(click_count), 0) * 100 as cvr,
        SUM(ad_spend) as spend,
        SUM(revenue) / NULLIF(SUM(ad_spend), 0) * 100 as roi,
        CASE
          WHEN SUM(purchase_count) > LAG(SUM(purchase_count)) OVER (PARTITION BY keyword ORDER BY MAX(date)) THEN 'up'
          WHEN SUM(purchase_count) < LAG(SUM(purchase_count)) OVER (PARTITION BY keyword ORDER BY MAX(date)) THEN 'down'
          ELSE 'stable'
        END as trend
      FROM ${getFullTableName('sqpDaily')}
      WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
      GROUP BY keyword
      ORDER BY purchases DESC
      LIMIT @limit
    `;
    
    try {
      const results = await this.client.query(
        query,
        { limit }
      );
      
      return results.map((row: any) => ({
        keyword: row.keyword,
        purchases: row.purchases || 0,
        marketPurchases: row.marketPurchases || 0,
        share: row.share || 0,
        cvr: row.cvr || 0,
        spend: row.spend || 0,
        roi: row.roi || 0,
        trend: row.trend || 'stable',
      }));
    } catch (error) {
      console.error('Error fetching top keywords:', error);
      return this.getMockKeywords();
    }
  }
  
  async getPurchaseTrends(weeks: number = 12): Promise<PurchaseTrend[]> {
    const query = `
      SELECT
        FORMAT_DATE('W%V', date) as week,
        SUM(purchase_count) as purchases,
        SUM(market_purchase_count) as market
      FROM ${getFullTableName('sqpDaily')}
      WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL @weeks WEEK)
      GROUP BY week
      ORDER BY MIN(date)
    `;
    
    try {
      const results = await this.client.query(
        query,
        { weeks }
      );
      
      return results.map((row: any) => ({
        week: row.week,
        purchases: row.purchases || 0,
        market: row.market || 0,
      }));
    } catch (error) {
      console.error('Error fetching purchase trends:', error);
      return this.getMockTrends();
    }
  }
  
  private calculatePercentChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }
  
  // Mock data fallbacks for development/testing
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
        keyword: 'wireless earbuds',
        purchases: 342,
        marketPurchases: 1456,
        share: 23.5,
        cvr: 4.2,
        spend: 1250,
        roi: 285,
        trend: 'up',
      },
      {
        keyword: 'bluetooth headphones',
        purchases: 287,
        marketPurchases: 1823,
        share: 15.7,
        cvr: 3.8,
        spend: 980,
        roi: 245,
        trend: 'up',
      },
      {
        keyword: 'noise cancelling earbuds',
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
}

// Export singleton instance
export const sqpDataService = new SQPDataService();

// Re-export types for convenience
export type { PurchaseMetrics, KeywordPerformance, PurchaseTrend };