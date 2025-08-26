import { BigQueryConnectionPool } from '../connection-pool';
import { WeeklyTrend } from '../types';
import { getFullTableName } from '@/config/bigquery.config';

export class TrendCalculator {
  constructor(private pool: BigQueryConnectionPool) {}

  /**
   * Calculate weekly trends for an ASIN
   */
  async calculateWeeklyTrends(
    asin: string,
    startDate: string,
    endDate: string
  ): Promise<WeeklyTrend[]> {
    const query = `
      WITH weekly_data AS (
        SELECT
          DATE_TRUNC(DATE(query_date), WEEK) as week,
          asin,
          SUM(impressions) as impressions,
          SUM(clicks) as clicks,
          SUM(purchases) as purchases,
          COUNT(DISTINCT query) as unique_queries
        FROM \`${getFullTableName('sqpRaw')}\`
        WHERE asin = @asin
          AND DATE(query_date) BETWEEN @startDate AND @endDate
        GROUP BY week, asin
      ),
      with_previous AS (
        SELECT
          *,
          LAG(impressions) OVER (ORDER BY week) as prev_impressions,
          LAG(clicks) OVER (ORDER BY week) as prev_clicks,
          LAG(purchases) OVER (ORDER BY week) as prev_purchases
        FROM weekly_data
      )
      SELECT
        week,
        impressions,
        clicks,
        purchases,
        unique_queries,
        -- Calculate growth rates
        SAFE_DIVIDE(impressions - prev_impressions, prev_impressions) * 100 as impressions_growth,
        SAFE_DIVIDE(clicks - prev_clicks, prev_clicks) * 100 as clicks_growth,
        SAFE_DIVIDE(purchases - prev_purchases, prev_purchases) * 100 as purchases_growth,
        -- Calculate rates
        SAFE_DIVIDE(clicks, impressions) as ctr,
        SAFE_DIVIDE(purchases, clicks) as cvr,
        SAFE_DIVIDE(purchases, impressions) as purchases_per_impression
      FROM with_previous
      ORDER BY week
    `;

    const results = await this.pool.withClient(async (client) => {
      return client.query<any>(query, {
        asin,
        startDate,
        endDate,
      });
    });

    return results.map(row => ({
      week: row.week,
      asin,
      impressions: row.impressions,
      clicks: row.clicks,
      purchases: row.purchases,
      impressionsGrowth: row.impressions_growth || 0,
      clicksGrowth: row.clicks_growth || 0,
      purchasesGrowth: row.purchases_growth || 0,
      ctr: row.ctr || 0,
      cvr: row.cvr || 0,
      uniqueQueries: row.unique_queries,
    }));
  }

  /**
   * Calculate month-over-month trends
   */
  async calculateMonthlyTrends(
    asin: string,
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    const query = `
      WITH monthly_data AS (
        SELECT
          DATE_TRUNC(DATE(query_date), MONTH) as month,
          asin,
          SUM(impressions) as impressions,
          SUM(clicks) as clicks,
          SUM(purchases) as purchases,
          AVG(SAFE_DIVIDE(clicks, impressions)) as avg_ctr,
          AVG(SAFE_DIVIDE(purchases, clicks)) as avg_cvr
        FROM \`${getFullTableName('sqpRaw')}\`
        WHERE asin = @asin
          AND DATE(query_date) BETWEEN @startDate AND @endDate
        GROUP BY month, asin
      ),
      with_previous AS (
        SELECT
          *,
          LAG(purchases) OVER (ORDER BY month) as prev_purchases,
          LAG(purchases, 12) OVER (ORDER BY month) as yoy_prev_purchases
        FROM monthly_data
      )
      SELECT
        month,
        impressions,
        clicks,
        purchases,
        avg_ctr,
        avg_cvr,
        SAFE_DIVIDE(purchases - prev_purchases, prev_purchases) * 100 as mom_growth,
        SAFE_DIVIDE(purchases - yoy_prev_purchases, yoy_prev_purchases) * 100 as yoy_growth
      FROM with_previous
      ORDER BY month
    `;

    return this.pool.withClient(async (client) => {
      return client.query(query, {
        asin,
        startDate,
        endDate,
      });
    });
  }

  /**
   * Detect trend anomalies using statistical methods
   */
  async detectTrendAnomalies(
    trends: WeeklyTrend[],
    sensitivity: number = 2
  ): Promise<{
    anomalies: Array<{
      week: string;
      metric: string;
      value: number;
      expectedRange: { lower: number; upper: number };
      severity: 'low' | 'medium' | 'high';
    }>;
  }> {
    const anomalies: any[] = [];
    const metrics = ['impressions', 'clicks', 'purchases'] as const;

    for (const metric of metrics) {
      const values = trends.map(t => t[metric]);
      const stats = this.calculateStatistics(values);
      
      trends.forEach((trend, index) => {
        const value = trend[metric];
        const zScore = Math.abs((value - stats.mean) / stats.stdDev);
        
        if (zScore > sensitivity) {
          anomalies.push({
            week: trend.week,
            metric,
            value,
            expectedRange: {
              lower: stats.mean - sensitivity * stats.stdDev,
              upper: stats.mean + sensitivity * stats.stdDev,
            },
            severity: zScore > 3 ? 'high' : zScore > 2.5 ? 'medium' : 'low',
          });
        }
      });
    }

    return { anomalies };
  }

  /**
   * Forecast future trends using simple moving average
   */
  forecastTrends(
    historicalTrends: WeeklyTrend[],
    weeksToForecast: number = 4
  ): Array<{
    week: string;
    impressions: number;
    clicks: number;
    purchases: number;
    confidence: number;
  }> {
    if (historicalTrends.length < 4) {
      throw new Error('Insufficient historical data for forecasting');
    }

    const forecasts: any[] = [];
    const lastWeek = new Date(historicalTrends[historicalTrends.length - 1].week);
    
    // Use weighted moving average for forecasting
    const weights = [0.1, 0.2, 0.3, 0.4]; // More weight on recent data
    const recentTrends = historicalTrends.slice(-4);

    for (let i = 1; i <= weeksToForecast; i++) {
      const forecastWeek = new Date(lastWeek);
      forecastWeek.setDate(forecastWeek.getDate() + i * 7);
      
      const forecast = {
        week: forecastWeek.toISOString().split('T')[0],
        impressions: 0,
        clicks: 0,
        purchases: 0,
        confidence: Math.max(0.5, 0.9 - i * 0.1), // Confidence decreases with distance
      };

      // Calculate weighted averages
      recentTrends.forEach((trend, index) => {
        forecast.impressions += trend.impressions * weights[index];
        forecast.clicks += trend.clicks * weights[index];
        forecast.purchases += trend.purchases * weights[index];
      });

      forecasts.push(forecast);
    }

    return forecasts;
  }

  /**
   * Identify trend patterns
   */
  identifyTrendPatterns(
    trends: WeeklyTrend[]
  ): {
    pattern: 'growth' | 'decline' | 'stable' | 'volatile';
    confidence: number;
    details: any;
  } {
    if (trends.length < 4) {
      return { pattern: 'stable', confidence: 0.5, details: {} };
    }

    const purchaseValues = trends.map(t => t.purchases);
    const stats = this.calculateStatistics(purchaseValues);
    
    // Calculate trend direction
    const firstHalf = purchaseValues.slice(0, Math.floor(purchaseValues.length / 2));
    const secondHalf = purchaseValues.slice(Math.floor(purchaseValues.length / 2));
    const firstHalfAvg = this.average(firstHalf);
    const secondHalfAvg = this.average(secondHalf);
    
    const changePercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
    const volatility = stats.stdDev / stats.mean;

    let pattern: 'growth' | 'decline' | 'stable' | 'volatile';
    let confidence = 0;

    if (volatility > 0.5) {
      pattern = 'volatile';
      confidence = Math.min(0.9, volatility);
    } else if (changePercent > 20) {
      pattern = 'growth';
      confidence = Math.min(0.9, changePercent / 100);
    } else if (changePercent < -20) {
      pattern = 'decline';
      confidence = Math.min(0.9, Math.abs(changePercent) / 100);
    } else {
      pattern = 'stable';
      confidence = 1 - volatility;
    }

    return {
      pattern,
      confidence,
      details: {
        changePercent,
        volatility,
        mean: stats.mean,
        stdDev: stats.stdDev,
      },
    };
  }

  /**
   * Calculate compound growth rates
   */
  calculateCAGR(
    initialValue: number,
    finalValue: number,
    periods: number
  ): number {
    if (initialValue <= 0 || periods <= 0) return 0;
    
    return (Math.pow(finalValue / initialValue, 1 / periods) - 1) * 100;
  }

  /**
   * Private helper methods
   */
  private calculateStatistics(values: number[]): {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
  } {
    if (values.length === 0) {
      return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0 };
    }

    const mean = this.average(values);
    const median = this.median(values);
    const stdDev = this.standardDeviation(values, mean);
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { mean, median, stdDev, min, max };
  }

  private average(values: number[]): number {
    return values.length > 0 
      ? values.reduce((sum, val) => sum + val, 0) / values.length 
      : 0;
  }

  private median(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private standardDeviation(values: number[], mean?: number): number {
    if (values.length === 0) return 0;
    
    const avg = mean ?? this.average(values);
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    const avgSquaredDiff = this.average(squaredDiffs);
    
    return Math.sqrt(avgSquaredDiff);
  }
}