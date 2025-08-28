import { 
  BigQuerySQPData, 
  SupabaseWeeklySummary,
  TransformOptions,
  ValidationResult,
  WeekBoundaries,
  StatisticalMetrics,
  ShareMetrics
} from './types';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';

export class BigQueryToSupabaseTransformer {
  /**
   * Transform BigQuery SQP data to Supabase weekly summary format
   */
  public toWeeklySummary(
    data: BigQuerySQPData, 
    options: TransformOptions
  ): SupabaseWeeklySummary {
    return {
      period_start: options.periodStart,
      period_end: options.periodEnd,
      query: this.normalizeQuery(data.search_query),
      asin: this.validateASIN(data.asin),
      total_impressions: this.safeParseInt(data.impressions),
      total_clicks: this.safeParseInt(data.clicks),
      total_purchases: this.safeParseInt(data.purchases),
      avg_ctr: this.safeParseFloat(data.ctr) || this.calculateCTR(data.clicks, data.impressions),
      avg_cvr: this.safeParseFloat(data.cvr) || this.calculateCVR(data.purchases, data.clicks),
      purchases_per_impression: this.calculatePurchasesPerImpression(data.purchases, data.impressions),
      // Share metrics will be calculated in batch
      impression_share: 0,
      click_share: 0,
      purchase_share: 0,
    };
  }

  /**
   * Calculate share metrics for a batch of records
   */
  public calculateShareMetrics(weeklyData: BigQuerySQPData[]): SupabaseWeeklySummary[] {
    // Group by query to calculate shares
    const queryGroups = this.groupByQuery(weeklyData);
    
    return weeklyData.map(data => {
      const query = this.normalizeQuery(data.search_query);
      const group = queryGroups.get(query) || [];
      
      const totals = this.calculateTotals(group);
      const shares = this.calculateShares(data, totals);
      
      const summary = this.toWeeklySummary(data, {
        periodStart: this.getWeekBoundaries(data.date).periodStart,
        periodEnd: this.getWeekBoundaries(data.date).periodEnd,
      });
      
      return {
        ...summary,
        ...shares,
      };
    });
  }

  /**
   * Parse various date formats from BigQuery
   */
  public parseDate(date: any): string {
    if (!date) return '';
    
    if (typeof date === 'string') {
      return date.split('T')[0];
    }
    
    if (date instanceof Date) {
      return format(date, 'yyyy-MM-dd');
    }
    
    if (date.value) {
      return date.value.split('T')[0];
    }
    
    return '';
  }

  /**
   * Get week boundaries for a given date
   */
  public getWeekBoundaries(date: any): WeekBoundaries {
    const parsed = typeof date === 'string' ? parseISO(this.parseDate(date)) : new Date(date);
    const weekStart = startOfWeek(parsed, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(parsed, { weekStartsOn: 1 }); // Sunday
    
    return {
      periodStart: format(weekStart, 'yyyy-MM-dd'),
      periodEnd: format(weekEnd, 'yyyy-MM-dd'),
    };
  }

  /**
   * Transform batch of records with optimizations
   */
  public transformBatch(
    batch: BigQuerySQPData[], 
    options: TransformOptions & { calculateShares?: boolean }
  ): SupabaseWeeklySummary[] {
    if (options.calculateShares) {
      return this.calculateShareMetrics(batch);
    }
    
    return batch.map(data => this.toWeeklySummary(data, options));
  }

  /**
   * Validate transformed data meets Supabase schema requirements
   */
  public validateWeeklySummary(data: SupabaseWeeklySummary): ValidationResult {
    const errors: string[] = [];
    
    // Required fields
    if (!data.query || data.query.trim() === '') {
      errors.push('Query cannot be empty');
    }
    
    if (!data.asin || data.asin.length !== 10) {
      errors.push('ASIN must be 10 characters');
    }
    
    if (!data.period_start || !data.period_end) {
      errors.push('Period dates are required');
    }
    
    // Numeric validations
    if (data.total_impressions < 0) {
      errors.push('Impressions cannot be negative');
    }
    
    if (data.total_clicks < 0) {
      errors.push('Clicks cannot be negative');
    }
    
    if (data.total_purchases < 0) {
      errors.push('Purchases cannot be negative');
    }
    
    // Logical validations
    if (data.total_clicks > data.total_impressions) {
      errors.push('Clicks cannot exceed impressions');
    }
    
    if (data.total_purchases > data.total_clicks) {
      errors.push('Purchases cannot exceed clicks');
    }
    
    // Rate validations
    if (data.avg_ctr > 1) {
      errors.push('CTR cannot exceed 100%');
    }
    
    if (data.avg_cvr > 1) {
      errors.push('CVR cannot exceed 100%');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate statistical metrics for a dataset
   */
  public calculateStatistics(values: number[]): StatisticalMetrics {
    if (values.length === 0) {
      return { min: 0, max: 0, avg: 0, stddev: 0 };
    }
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    const stddev = Math.sqrt(variance);
    
    return { min, max, avg, stddev };
  }

  /**
   * Aggregate daily data into weekly summary
   */
  public aggregateToWeekly(dailyData: BigQuerySQPData[]): Partial<SupabaseWeeklySummary> {
    const totalImpressions = dailyData.reduce((sum, d) => sum + this.safeParseInt(d.impressions), 0);
    const totalClicks = dailyData.reduce((sum, d) => sum + this.safeParseInt(d.clicks), 0);
    const totalPurchases = dailyData.reduce((sum, d) => sum + this.safeParseInt(d.purchases), 0);
    
    return {
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      total_purchases: totalPurchases,
      avg_ctr: this.calculateCTR(totalClicks, totalImpressions),
      avg_cvr: this.calculateCVR(totalPurchases, totalClicks),
      purchases_per_impression: this.calculatePurchasesPerImpression(totalPurchases, totalImpressions),
    };
  }

  /**
   * Parse BigQuery numeric type safely
   */
  public parseNumeric(value: any, decimals: number = 6): number {
    if (!value) return 0;
    
    if (typeof value === 'number') {
      return Number(value.toFixed(decimals));
    }
    
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : Number(parsed.toFixed(decimals));
    }
    
    if (value.value !== undefined) {
      return this.parseNumeric(value.value, decimals);
    }
    
    return 0;
  }

  /**
   * Safe integer parsing with fallback
   */
  public safeParseInt(value: any): number {
    if (value === null || value === undefined) return 0;
    
    const parsed = parseInt(String(value), 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Safe float parsing with fallback
   */
  public safeParseFloat(value: any): number {
    if (value === null || value === undefined) return 0;
    
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Calculate CTR safely
   */
  public calculateCTR(clicks: any, impressions: any): number {
    const clickCount = this.safeParseInt(clicks);
    const impressionCount = this.safeParseInt(impressions);
    
    if (impressionCount === 0) return 0;
    
    return Number((clickCount / impressionCount).toFixed(6));
  }

  /**
   * Calculate CVR safely
   */
  public calculateCVR(purchases: any, clicks: any): number {
    const purchaseCount = this.safeParseInt(purchases);
    const clickCount = this.safeParseInt(clicks);
    
    if (clickCount === 0) return 0;
    
    return Number((purchaseCount / clickCount).toFixed(6));
  }

  /**
   * Calculate purchases per impression
   */
  private calculatePurchasesPerImpression(purchases: any, impressions: any): number {
    const purchaseCount = this.safeParseInt(purchases);
    const impressionCount = this.safeParseInt(impressions);
    
    if (impressionCount === 0) return 0;
    
    return Number((purchaseCount / impressionCount).toFixed(6));
  }

  /**
   * Normalize search query
   */
  private normalizeQuery(query: string): string {
    return query.toLowerCase().trim();
  }

  /**
   * Validate ASIN format
   */
  private validateASIN(asin: string): string {
    const cleaned = asin.trim().toUpperCase();
    
    if (cleaned.length !== 10) {
      console.warn(`Invalid ASIN length: ${asin}`);
    }
    
    return cleaned;
  }

  /**
   * Group data by query
   */
  private groupByQuery(data: BigQuerySQPData[]): Map<string, BigQuerySQPData[]> {
    const groups = new Map<string, BigQuerySQPData[]>();
    
    for (const item of data) {
      const query = this.normalizeQuery(item.search_query);
      const group = groups.get(query) || [];
      group.push(item);
      groups.set(query, group);
    }
    
    return groups;
  }

  /**
   * Calculate totals for a group
   */
  private calculateTotals(group: BigQuerySQPData[]): {
    totalImpressions: number;
    totalClicks: number;
    totalPurchases: number;
  } {
    return {
      totalImpressions: group.reduce((sum, d) => sum + this.safeParseInt(d.impressions), 0),
      totalClicks: group.reduce((sum, d) => sum + this.safeParseInt(d.clicks), 0),
      totalPurchases: group.reduce((sum, d) => sum + this.safeParseInt(d.purchases), 0),
    };
  }

  /**
   * Calculate share metrics for a single record
   */
  private calculateShares(
    data: BigQuerySQPData, 
    totals: { totalImpressions: number; totalClicks: number; totalPurchases: number }
  ): ShareMetrics {
    const impressions = this.safeParseInt(data.impressions);
    const clicks = this.safeParseInt(data.clicks);
    const purchases = this.safeParseInt(data.purchases);
    
    return {
      impression_share: totals.totalImpressions > 0 ? impressions / totals.totalImpressions : 0,
      click_share: totals.totalClicks > 0 ? clicks / totals.totalClicks : 0,
      purchase_share: totals.totalPurchases > 0 ? purchases / totals.totalPurchases : 0,
    };
  }
}