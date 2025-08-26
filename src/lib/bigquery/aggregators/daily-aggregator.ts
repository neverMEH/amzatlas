import { BigQueryConnectionPool } from '../connection-pool';
import { 
  SQPRecord, 
  AggregatedMetrics, 
  AggregationConfig,
  TransformationOptions 
} from '../types';
import { getFullTableName } from '@/config/bigquery.config';

export class DailyAggregator {
  constructor(private pool: BigQueryConnectionPool) {}

  /**
   * Aggregate SQP records by date and key dimensions
   */
  async aggregate(
    records: SQPRecord[],
    options: TransformationOptions = {}
  ): Promise<AggregatedMetrics[]> {
    if (records.length === 0) return [];

    // Group records by date, query, and ASIN
    const grouped = this.groupRecords(records);
    
    // Calculate aggregations for each group
    const aggregated: AggregatedMetrics[] = [];
    
    for (const [key, groupRecords] of grouped.entries()) {
      const [date, query, asin] = key.split('|');
      const metrics = this.calculateMetrics(groupRecords);
      
      aggregated.push({
        date,
        query,
        asin,
        ...metrics,
      });
    }

    // Calculate share metrics if requested
    if (options.includeShareMetrics) {
      this.calculateShareMetrics(aggregated);
    }

    // Apply custom aggregations if provided
    if (options.customAggregations) {
      this.applyCustomAggregations(aggregated, records, options.customAggregations);
    }

    return aggregated;
  }

  /**
   * Persist daily aggregations to BigQuery
   */
  async persistToBigQuery(date: string): Promise<void> {
    const query = `
      INSERT INTO \`${getFullTableName('sqpDaily')}\`
      SELECT
        DATE(query_date) as date,
        query,
        asin,
        SUM(impressions) as total_impressions,
        SUM(clicks) as total_clicks,
        SUM(purchases) as total_purchases,
        SAFE_DIVIDE(SUM(clicks), SUM(impressions)) as avg_ctr,
        SAFE_DIVIDE(SUM(purchases), SUM(clicks)) as avg_cvr,
        SAFE_DIVIDE(SUM(purchases), SUM(impressions)) as purchases_per_impression,
        COUNT(*) as sessions,
        MIN(impressions) as min_impressions,
        MAX(impressions) as max_impressions,
        AVG(impressions) as avg_impressions,
        STDDEV(impressions) as stddev_impressions,
        CURRENT_TIMESTAMP() as created_at
      FROM \`${getFullTableName('sqpRaw')}\`
      WHERE DATE(query_date) = @date
      GROUP BY date, query, asin
    `;

    await this.pool.withClient(async (client) => {
      await client.query(query, { date });
    });
  }

  /**
   * Calculate statistics for a group of records
   */
  async aggregateWithStats(
    records: SQPRecord[],
    config: AggregationConfig
  ): Promise<any> {
    const grouped = this.groupByDimensions(records, config.dimensions);
    const results: any[] = [];

    for (const [key, groupRecords] of grouped.entries()) {
      const dimensions = this.parseDimensionKey(key, config.dimensions);
      const metrics: any = {};

      // Calculate basic aggregations
      for (const metric of config.metrics) {
        const values = groupRecords.map(r => (r as any)[metric] || 0);
        metrics[metric] = {
          sum: this.sum(values),
          avg: this.average(values),
          min: Math.min(...values),
          max: Math.max(...values),
        };

        if (config.includeStats) {
          metrics[metric].stddev = this.standardDeviation(values);
          metrics[metric].median = this.median(values);
          metrics[metric].percentiles = this.calculatePercentiles(values);
        }
      }

      results.push({
        ...dimensions,
        metrics,
        recordCount: groupRecords.length,
      });
    }

    return results;
  }

  /**
   * Private helper methods
   */
  private groupRecords(records: SQPRecord[]): Map<string, SQPRecord[]> {
    const grouped = new Map<string, SQPRecord[]>();
    
    for (const record of records) {
      const date = record.query_date.split('T')[0]; // Extract date part
      const key = `${date}|${record.query}|${record.asin}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(record);
    }
    
    return grouped;
  }

  private groupByDimensions(
    records: SQPRecord[],
    dimensions: string[]
  ): Map<string, SQPRecord[]> {
    const grouped = new Map<string, SQPRecord[]>();
    
    for (const record of records) {
      const keyParts = dimensions.map(dim => {
        if (dim === 'date') return record.query_date.split('T')[0];
        return (record as any)[dim] || 'unknown';
      });
      const key = keyParts.join('|');
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(record);
    }
    
    return grouped;
  }

  private parseDimensionKey(key: string, dimensions: string[]): Record<string, string> {
    const parts = key.split('|');
    const result: Record<string, string> = {};
    
    dimensions.forEach((dim, index) => {
      result[dim] = parts[index];
    });
    
    return result;
  }

  private calculateMetrics(records: SQPRecord[]): Omit<AggregatedMetrics, 'date' | 'query' | 'asin'> {
    const totalImpressions = this.sum(records.map(r => r.impressions));
    const totalClicks = this.sum(records.map(r => r.clicks));
    const totalPurchases = this.sum(records.map(r => r.purchases));
    
    return {
      impressions: totalImpressions,
      clicks: totalClicks,
      purchases: totalPurchases,
      ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      cvr: totalClicks > 0 ? totalPurchases / totalClicks : 0,
      purchaseShare: 0, // Will be calculated later if needed
      totalImpressions,
      totalClicks,
      totalPurchases,
      avgCTR: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      avgCVR: totalClicks > 0 ? totalPurchases / totalClicks : 0,
      purchasesPerImpression: totalImpressions > 0 ? totalPurchases / totalImpressions : 0,
    };
  }

  private calculateShareMetrics(aggregated: AggregatedMetrics[]): void {
    // Group by query to calculate shares
    const byQuery = new Map<string, AggregatedMetrics[]>();
    
    for (const record of aggregated) {
      if (!byQuery.has(record.query)) {
        byQuery.set(record.query, []);
      }
      byQuery.get(record.query)!.push(record);
    }
    
    // Calculate shares within each query
    for (const [query, records] of byQuery.entries()) {
      const totalImpressions = this.sum(records.map(r => r.totalImpressions));
      const totalClicks = this.sum(records.map(r => r.totalClicks));
      const totalPurchases = this.sum(records.map(r => r.totalPurchases));
      
      for (const record of records) {
        record.impressionShare = totalImpressions > 0 ? record.totalImpressions / totalImpressions : 0;
        record.clickShare = totalClicks > 0 ? record.totalClicks / totalClicks : 0;
        record.purchaseShare = totalPurchases > 0 ? record.totalPurchases / totalPurchases : 0;
      }
    }
  }

  private applyCustomAggregations(
    aggregated: AggregatedMetrics[],
    originalRecords: SQPRecord[],
    customAggs: Record<string, (records: any[]) => any>
  ): void {
    for (const record of aggregated) {
      // Find original records for this aggregation
      const matchingRecords = originalRecords.filter(
        r => r.query === record.query && 
             r.asin === record.asin && 
             r.query_date.startsWith(record.date)
      );
      
      // Apply custom aggregations
      const custom: Record<string, any> = {};
      for (const [name, fn] of Object.entries(customAggs)) {
        custom[name] = fn(matchingRecords);
      }
      
      (record as any).custom = custom;
    }
  }

  // Statistical helper methods
  private sum(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0);
  }

  private average(values: number[]): number {
    return values.length > 0 ? this.sum(values) / values.length : 0;
  }

  private median(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const avg = this.average(values);
    const squaredDiffs = values.map(val => Math.pow(val - avg, 2));
    const avgSquaredDiff = this.average(squaredDiffs);
    
    return Math.sqrt(avgSquaredDiff);
  }

  private calculatePercentiles(values: number[]): Record<string, number> {
    if (values.length === 0) {
      return { p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 };
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const percentiles = [25, 50, 75, 90, 95, 99];
    const result: Record<string, number> = {};
    
    for (const p of percentiles) {
      const index = (p / 100) * (sorted.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index - lower;
      
      result[`p${p}`] = lower === upper
        ? sorted[lower]
        : sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }
    
    return result;
  }
}