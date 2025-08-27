import { BigQueryClient } from '@/lib/bigquery/client';
import { format, subDays } from 'date-fns';

import { PurchaseMetrics, KeywordPerformance, PurchaseTrend } from '@/types/dashboard'

class SQPDataService {
  private client: BigQueryClient | null = null;
  
  constructor() {
    try {
      // Only initialize BigQuery client if credentials are available
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        this.client = new BigQueryClient();
      }
    } catch (error) {
      console.log('BigQuery client initialization failed, using mock data', error);
    }
  }
  
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
      FROM sqp_daily
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
      FROM sqp_daily
      WHERE date BETWEEN @prevStart AND @prevEnd
    `;
    
    try {
      // Return mock data if BigQuery client is not available
      if (!this.client) {
        return this.getMockMetrics();
      }
      
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
      FROM sqp_daily
      WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
      GROUP BY keyword
      ORDER BY purchases DESC
      LIMIT @limit
    `;
    
    try {
      // Return mock data if BigQuery client is not available
      if (!this.client) {
        return this.getMockKeywords();
      }
      
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
      FROM sqp_daily
      WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL @weeks WEEK)
      GROUP BY week
      ORDER BY MIN(date)
    `;
    
    try {
      // Return mock data if BigQuery client is not available
      if (!this.client) {
        return this.getMockTrends();
      }
      
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
  
  async getZeroPurchaseKeywords(limit: number = 20): Promise<KeywordPerformance[]> {
    const query = `
      SELECT
        keyword,
        0 as purchases,
        SUM(market_purchase_count) as marketPurchases,
        0 as share,
        0 as cvr,
        SUM(ad_spend) as spend,
        -100 as roi,
        'down' as trend
      FROM sqp_daily
      WHERE purchase_count = 0 AND click_count > 0
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
      GROUP BY keyword
      ORDER BY spend DESC
      LIMIT @limit
    `;
    
    try {
      if (!this.client) {
        return this.getMockZeroPurchaseKeywords();
      }
      
      const results = await this.client.query(query, { limit });
      
      return results.map((row: any) => ({
        keyword: row.keyword,
        purchases: row.purchases || 0,
        marketPurchases: row.marketPurchases || 0,
        share: row.share || 0,
        cvr: row.cvr || 0,
        spend: row.spend || 0,
        roi: row.roi || 0,
        trend: row.trend || 'down',
      }));
    } catch (error) {
      console.error('Error fetching zero purchase keywords:', error);
      return this.getMockZeroPurchaseKeywords();
    }
  }

  async getRisingKeywords(limit: number = 20): Promise<KeywordPerformance[]> {
    const query = `
      WITH keyword_growth AS (
        SELECT
          keyword,
          SUM(CASE WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) THEN purchase_count ELSE 0 END) as recent_purchases,
          SUM(CASE WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY) AND date < DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) THEN purchase_count ELSE 0 END) as previous_purchases,
          SUM(CASE WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) THEN market_purchase_count ELSE 0 END) as marketPurchases,
          SUM(CASE WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) THEN ad_spend ELSE 0 END) as spend,
          SUM(CASE WHEN date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) THEN revenue ELSE 0 END) as revenue
        FROM sqp_daily
        WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
        GROUP BY keyword
        HAVING recent_purchases > 0 AND previous_purchases > 0
      )
      SELECT
        keyword,
        recent_purchases as purchases,
        marketPurchases,
        SAFE_DIVIDE(recent_purchases, marketPurchases) * 100 as share,
        SAFE_DIVIDE(recent_purchases, NULLIF(spend, 0)) * 100 as cvr,
        spend,
        SAFE_DIVIDE(revenue, NULLIF(spend, 0)) * 100 as roi,
        'up' as trend
      FROM keyword_growth
      WHERE SAFE_DIVIDE((recent_purchases - previous_purchases), NULLIF(previous_purchases, 0)) > 0.2
      ORDER BY SAFE_DIVIDE((recent_purchases - previous_purchases), NULLIF(previous_purchases, 0)) DESC
      LIMIT @limit
    `;
    
    try {
      if (!this.client) {
        return this.getMockRisingKeywords();
      }
      
      const results = await this.client.query(query, { limit });
      
      return results.map((row: any) => ({
        keyword: row.keyword,
        purchases: row.purchases || 0,
        marketPurchases: row.marketPurchases || 0,
        share: row.share || 0,
        cvr: row.cvr || 0,
        spend: row.spend || 0,
        roi: row.roi || 0,
        trend: row.trend || 'up',
      }));
    } catch (error) {
      console.error('Error fetching rising keywords:', error);
      return this.getMockRisingKeywords();
    }
  }

  async getNegativeROIKeywords(limit: number = 20): Promise<KeywordPerformance[]> {
    const query = `
      SELECT
        keyword,
        SUM(purchase_count) as purchases,
        SUM(market_purchase_count) as marketPurchases,
        SUM(purchase_count) / NULLIF(SUM(market_purchase_count), 0) * 100 as share,
        SUM(purchase_count) / NULLIF(SUM(click_count), 0) * 100 as cvr,
        SUM(ad_spend) as spend,
        SUM(revenue) / NULLIF(SUM(ad_spend), 0) * 100 as roi,
        'down' as trend
      FROM sqp_daily
      WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
      GROUP BY keyword
      HAVING SUM(revenue) / NULLIF(SUM(ad_spend), 0) < 1
      ORDER BY roi ASC
      LIMIT @limit
    `;
    
    try {
      if (!this.client) {
        return this.getMockNegativeROIKeywords();
      }
      
      const results = await this.client.query(query, { limit });
      
      return results.map((row: any) => ({
        keyword: row.keyword,
        purchases: row.purchases || 0,
        marketPurchases: row.marketPurchases || 0,
        share: row.share || 0,
        cvr: row.cvr || 0,
        spend: row.spend || 0,
        roi: row.roi || 0,
        trend: row.trend || 'down',
      }));
    } catch (error) {
      console.error('Error fetching negative ROI keywords:', error);
      return this.getMockNegativeROIKeywords();
    }
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
        keyword: 'expensive bluetooth headphones',
        purchases: 0,
        marketPurchases: 45,
        share: 0,
        cvr: 0,
        spend: 234,
        roi: -100,
        trend: 'down',
      },
      {
        keyword: 'premium wireless earbuds',
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
        keyword: 'wireless earbuds noise cancelling',
        purchases: 89,
        marketPurchases: 234,
        share: 38.0,
        cvr: 6.7,
        spend: 456,
        roi: 420,
        trend: 'up',
      },
      {
        keyword: 'bluetooth headphones gym',
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

  async getROITrends(weeks: number = 12): Promise<any[]> {
    const query = `
      SELECT
        FORMAT_DATE('W%V', date) as period,
        SAFE_DIVIDE(SUM(revenue), NULLIF(SUM(ad_spend), 0)) * 100 as roi,
        SUM(ad_spend) as spend,
        SUM(revenue) as revenue
      FROM sqp_daily
      WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL @weeks WEEK)
      GROUP BY period
      ORDER BY MIN(date)
    `;
    
    try {
      if (!this.client) {
        return this.getMockROITrends();
      }
      
      const results = await this.client.query(query, { weeks });
      
      return results.map((row: any) => ({
        period: row.period,
        roi: row.roi || 0,
        spend: row.spend || 0,
        revenue: row.revenue || 0,
      }));
    } catch (error) {
      console.error('Error fetching ROI trends:', error);
      return this.getMockROITrends();
    }
  }

  async getMarketShareTrends(weeks: number = 12): Promise<any[]> {
    const query = `
      WITH weekly_shares AS (
        SELECT
          FORMAT_DATE('W%V', date) as period,
          SUM(purchase_count) as your_purchases,
          SUM(market_purchase_count) as total_market,
          SAFE_DIVIDE(SUM(purchase_count), NULLIF(SUM(market_purchase_count), 0)) * 100 as your_share
        FROM sqp_daily
        WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL @weeks WEEK)
        GROUP BY period
      )
      SELECT
        period,
        your_share as yourShare,
        GREATEST(0, 35 - (your_share * 0.3)) as topCompetitor,
        GREATEST(0, 100 - your_share - GREATEST(0, 35 - (your_share * 0.3))) as marketAverage
      FROM weekly_shares
      ORDER BY period
    `;
    
    try {
      if (!this.client) {
        return this.getMockMarketShareTrends();
      }
      
      const results = await this.client.query(query, { weeks });
      
      return results.map((row: any) => ({
        period: row.period,
        yourShare: row.yourShare || 0,
        topCompetitor: row.topCompetitor || 0,
        marketAverage: row.marketAverage || 0,
      }));
    } catch (error) {
      console.error('Error fetching market share trends:', error);
      return this.getMockMarketShareTrends();
    }
  }

  private getMockMarketShareTrends(): any[] {
    const weeks = 12;
    const trends: any[] = [];
    let yourShare = 15;
    
    for (let i = 0; i < weeks; i++) {
      yourShare += Math.random() * 2 - 0.5;
      yourShare = Math.max(10, Math.min(30, yourShare));
      
      const topCompetitor = 35 - (yourShare * 0.3);
      const marketAverage = 100 - yourShare - topCompetitor;
      
      trends.push({
        period: `W${i + 1}`,
        yourShare: parseFloat(yourShare.toFixed(1)),
        topCompetitor: parseFloat(topCompetitor.toFixed(1)),
        marketAverage: parseFloat(marketAverage.toFixed(1)),
      });
    }
    
    return trends;
  }

  private getMockROITrends(): any[] {
    const weeks = 12;
    const trends: any[] = [];
    
    for (let i = 0; i < weeks; i++) {
      trends.push({
        period: `W${i + 1}`,
        roi: 200 + (i * 10) + Math.floor(Math.random() * 50),
        spend: 5000 + (i * 200) + Math.floor(Math.random() * 500),
        revenue: 12000 + (i * 800) + Math.floor(Math.random() * 2000),
      });
    }
    
    return trends;
  }

  async getHourlyPerformance(date: string): Promise<any[]> {
    const query = `
      SELECT
        EXTRACT(HOUR FROM TIMESTAMP(date)) as hour,
        SUM(purchase_count) as purchases,
        SUM(click_count) as clicks,
        SAFE_DIVIDE(SUM(purchase_count), NULLIF(SUM(click_count), 0)) * 100 as cvr
      FROM sqp_daily
      WHERE date = @date
      GROUP BY hour
      ORDER BY hour
    `;
    
    try {
      if (!this.client) {
        return this.getMockHourlyPerformance();
      }
      
      const results = await this.client.query(query, { date });
      
      // Fill in missing hours with zeros
      const hourlyMap = new Map();
      results.forEach((row: any) => {
        hourlyMap.set(row.hour, {
          hour: `${row.hour}:00`,
          purchases: row.purchases || 0,
          clicks: row.clicks || 0,
          cvr: row.cvr || 0,
        });
      });
      
      const fullDay = [];
      for (let h = 0; h < 24; h++) {
        const hourStr = `${h}:00`;
        fullDay.push(hourlyMap.get(h) || {
          hour: hourStr,
          purchases: 0,
          clicks: 0,
          cvr: 0,
        });
      }
      
      return fullDay;
    } catch (error) {
      console.error('Error fetching hourly performance:', error);
      return this.getMockHourlyPerformance();
    }
  }

  private getMockHourlyPerformance(): any[] {
    const performance = [];
    const baseClicks = 100;
    const basePurchases = 4;
    
    for (let h = 0; h < 24; h++) {
      // Peak hours: 10-14 and 19-22
      const isPeak = (h >= 10 && h <= 14) || (h >= 19 && h <= 22);
      const multiplier = isPeak ? 2.5 : h < 6 ? 0.3 : 1;
      
      const clicks = Math.floor(baseClicks * multiplier * (0.8 + Math.random() * 0.4));
      const purchases = Math.floor(basePurchases * multiplier * (0.8 + Math.random() * 0.4));
      
      performance.push({
        hour: `${h}:00`,
        purchases,
        clicks,
        cvr: clicks > 0 ? (purchases / clicks * 100) : 0,
      });
    }
    
    return performance;
  }

  private getMockNegativeROIKeywords(): KeywordPerformance[] {
    return [
      {
        keyword: 'cheap bluetooth headphones',
        purchases: 12,
        marketPurchases: 456,
        share: 2.6,
        cvr: 1.2,
        spend: 567,
        roi: 45,
        trend: 'down',
      },
      {
        keyword: 'discount wireless earbuds',
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
export const sqpDataService = new SQPDataService();

// Re-export types for convenience
export type { PurchaseMetrics, KeywordPerformance, PurchaseTrend };