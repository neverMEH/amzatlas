import { BigQueryConnectionPool } from '../connection-pool';
import { 
  SQPRecord, 
  AggregatedMetrics, 
  TransformationOptions,
  PeriodType,
  PeriodComparison
} from '../types';
import { getFullTableName } from '@/config/bigquery.config';
import { format, startOfWeek, startOfMonth, startOfQuarter, startOfYear, endOfWeek, endOfMonth, endOfQuarter, endOfYear, addWeeks, addMonths, addQuarters, addYears, subWeeks, subMonths, subQuarters, subYears } from 'date-fns';

export class PeriodAggregator {
  constructor(private pool: BigQueryConnectionPool) {}

  /**
   * Aggregate SQP records by specified period (weekly, monthly, quarterly, yearly)
   */
  async aggregateByPeriod(
    records: SQPRecord[],
    period: PeriodType,
    options: TransformationOptions = {}
  ): Promise<AggregatedMetrics[]> {
    if (records.length === 0) return [];

    // Group records by period, query, and ASIN
    const grouped = this.groupRecordsByPeriod(records, period);
    
    // Calculate aggregations for each group
    const aggregated: AggregatedMetrics[] = [];
    
    for (const [key, groupRecords] of grouped.entries()) {
      const [periodKey, query, asin] = key.split('|');
      const metrics = this.calculateMetrics(groupRecords);
      
      aggregated.push({
        date: periodKey,
        period,
        periodStart: this.getPeriodStart(periodKey, period),
        periodEnd: this.getPeriodEnd(periodKey, period),
        query,
        asin,
        ...metrics,
      });
    }

    // Calculate share metrics if requested
    if (options.includeShareMetrics) {
      this.calculateShareMetrics(aggregated);
    }

    return aggregated;
  }

  /**
   * Calculate period-over-period comparisons
   */
  async calculatePeriodComparison(
    currentPeriodData: AggregatedMetrics[],
    period: PeriodType
  ): Promise<PeriodComparison[]> {
    const comparisons: PeriodComparison[] = [];

    // Get unique combinations of query and ASIN
    const combinations = new Set(
      currentPeriodData.map(d => `${d.query}|${d.asin}`)
    );

    for (const combo of combinations) {
      const [query, asin] = combo.split('|');
      const currentData = currentPeriodData.filter(
        d => d.query === query && d.asin === asin
      );

      if (currentData.length === 0) continue;

      // Get previous period data
      const previousPeriodData = await this.getPreviousPeriodData(
        currentData[0].date,
        period,
        query,
        asin
      );

      if (!previousPeriodData) continue;

      const comparison = this.compareMetrics(currentData[0], previousPeriodData);
      comparisons.push({
        period,
        currentPeriod: currentData[0].date,
        previousPeriod: previousPeriodData.date,
        query,
        asin,
        ...comparison,
      });
    }

    return comparisons;
  }

  /**
   * Persist aggregations to BigQuery tables
   */
  async persistToBigQuery(period: PeriodType, startDate: string, endDate: string): Promise<void> {
    const tableSuffix = this.getTableSuffix(period);
    const query = `
      INSERT INTO \`${getFullTableName(`sqp_${tableSuffix}_summary`)}\`
      SELECT
        '${period}' as period,
        DATE('${startDate}') as period_start,
        DATE('${endDate}') as period_end,
        query,
        asin,
        SUM(impressions) as total_impressions,
        SUM(clicks) as total_clicks,
        SUM(purchases) as total_purchases,
        SAFE_DIVIDE(SUM(clicks), SUM(impressions)) as avg_ctr,
        SAFE_DIVIDE(SUM(purchases), SUM(clicks)) as avg_cvr,
        SAFE_DIVIDE(SUM(purchases), SUM(impressions)) as purchases_per_impression,
        COUNT(DISTINCT DATE(query_date)) as active_days,
        MIN(impressions) as min_impressions,
        MAX(impressions) as max_impressions,
        AVG(impressions) as avg_impressions,
        STDDEV(impressions) as stddev_impressions,
        -- Share metrics calculated within period
        SAFE_DIVIDE(SUM(impressions), SUM(SUM(impressions)) OVER (PARTITION BY query)) as impression_share,
        SAFE_DIVIDE(SUM(clicks), SUM(SUM(clicks)) OVER (PARTITION BY query)) as click_share,
        SAFE_DIVIDE(SUM(purchases), SUM(SUM(purchases)) OVER (PARTITION BY query)) as purchase_share,
        CURRENT_TIMESTAMP() as created_at
      FROM \`${getFullTableName('sqpRaw')}\`
      WHERE DATE(query_date) BETWEEN @startDate AND @endDate
      GROUP BY query, asin
    `;

    await this.pool.withClient(async (client) => {
      await client.query(query, { startDate, endDate });
    });
  }

  /**
   * Create period-over-period comparison table
   */
  async createPeriodComparisonTable(period: PeriodType): Promise<void> {
    const tableSuffix = this.getTableSuffix(period);
    const query = `
      CREATE OR REPLACE TABLE \`${getFullTableName(`sqp_${tableSuffix}_comparison`)}\` AS
      WITH current_period AS (
        SELECT * FROM \`${getFullTableName(`sqp_${tableSuffix}_summary`)}\`
        WHERE period_start >= DATE_SUB(CURRENT_DATE(), INTERVAL 1 ${period.toUpperCase()})
      ),
      previous_period AS (
        SELECT * FROM \`${getFullTableName(`sqp_${tableSuffix}_summary`)}\`
        WHERE period_start >= DATE_SUB(CURRENT_DATE(), INTERVAL 2 ${period.toUpperCase()})
          AND period_start < DATE_SUB(CURRENT_DATE(), INTERVAL 1 ${period.toUpperCase()})
      )
      SELECT
        c.period,
        c.period_start as current_period_start,
        c.period_end as current_period_end,
        p.period_start as previous_period_start,
        p.period_end as previous_period_end,
        c.query,
        c.asin,
        -- Current period metrics
        c.total_impressions as current_impressions,
        c.total_clicks as current_clicks,
        c.total_purchases as current_purchases,
        c.avg_ctr as current_ctr,
        c.avg_cvr as current_cvr,
        -- Previous period metrics
        p.total_impressions as previous_impressions,
        p.total_clicks as previous_clicks,
        p.total_purchases as previous_purchases,
        p.avg_ctr as previous_ctr,
        p.avg_cvr as previous_cvr,
        -- Period-over-period changes
        c.total_impressions - IFNULL(p.total_impressions, 0) as impressions_change,
        SAFE_DIVIDE(c.total_impressions - IFNULL(p.total_impressions, 0), p.total_impressions) as impressions_change_pct,
        c.total_clicks - IFNULL(p.total_clicks, 0) as clicks_change,
        SAFE_DIVIDE(c.total_clicks - IFNULL(p.total_clicks, 0), p.total_clicks) as clicks_change_pct,
        c.total_purchases - IFNULL(p.total_purchases, 0) as purchases_change,
        SAFE_DIVIDE(c.total_purchases - IFNULL(p.total_purchases, 0), p.total_purchases) as purchases_change_pct,
        c.avg_ctr - IFNULL(p.avg_ctr, 0) as ctr_change,
        c.avg_cvr - IFNULL(p.avg_cvr, 0) as cvr_change,
        CURRENT_TIMESTAMP() as created_at
      FROM current_period c
      LEFT JOIN previous_period p
        ON c.query = p.query AND c.asin = p.asin
    `;

    await this.pool.withClient(async (client) => {
      await client.query(query);
    });
  }

  /**
   * Private helper methods
   */
  private groupRecordsByPeriod(records: SQPRecord[], period: PeriodType): Map<string, SQPRecord[]> {
    const grouped = new Map<string, SQPRecord[]>();
    
    for (const record of records) {
      const date = new Date(record.query_date);
      const periodKey = this.getPeriodKey(date, period);
      const key = `${periodKey}|${record.query}|${record.asin}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(record);
    }
    
    return grouped;
  }

  private getPeriodKey(date: Date, period: PeriodType): string {
    switch (period) {
      case 'weekly':
        return format(startOfWeek(date), 'yyyy-MM-dd');
      case 'monthly':
        return format(startOfMonth(date), 'yyyy-MM');
      case 'quarterly':
        return `${format(date, 'yyyy')}-Q${Math.floor(date.getMonth() / 3) + 1}`;
      case 'yearly':
        return format(date, 'yyyy');
      default:
        return format(date, 'yyyy-MM-dd');
    }
  }

  private getPeriodStart(periodKey: string, period: PeriodType): string {
    switch (period) {
      case 'weekly':
        return periodKey; // Already start of week
      case 'monthly':
        return `${periodKey}-01`;
      case 'quarterly':
        const [year, quarter] = periodKey.split('-Q');
        const month = (parseInt(quarter) - 1) * 3;
        return `${year}-${String(month + 1).padStart(2, '0')}-01`;
      case 'yearly':
        return `${periodKey}-01-01`;
      default:
        return periodKey;
    }
  }

  private getPeriodEnd(periodKey: string, period: PeriodType): string {
    const startDate = new Date(this.getPeriodStart(periodKey, period));
    
    switch (period) {
      case 'weekly':
        return format(endOfWeek(startDate), 'yyyy-MM-dd');
      case 'monthly':
        return format(endOfMonth(startDate), 'yyyy-MM-dd');
      case 'quarterly':
        return format(endOfQuarter(startDate), 'yyyy-MM-dd');
      case 'yearly':
        return format(endOfYear(startDate), 'yyyy-MM-dd');
      default:
        return periodKey;
    }
  }

  private async getPreviousPeriodData(
    currentPeriodKey: string,
    period: PeriodType,
    query: string,
    asin: string
  ): Promise<AggregatedMetrics | null> {
    const currentStart = new Date(this.getPeriodStart(currentPeriodKey, period));
    let previousStart: Date;
    let previousEnd: Date;

    switch (period) {
      case 'weekly':
        previousStart = startOfWeek(subWeeks(currentStart, 1));
        previousEnd = endOfWeek(previousStart);
        break;
      case 'monthly':
        previousStart = startOfMonth(subMonths(currentStart, 1));
        previousEnd = endOfMonth(previousStart);
        break;
      case 'quarterly':
        previousStart = startOfQuarter(subQuarters(currentStart, 1));
        previousEnd = endOfQuarter(previousStart);
        break;
      case 'yearly':
        previousStart = startOfYear(subYears(currentStart, 1));
        previousEnd = endOfYear(previousStart);
        break;
    }

    const tableSuffix = this.getTableSuffix(period);
    const queryStr = `
      SELECT * FROM \`${getFullTableName(`sqp_${tableSuffix}_summary`)}\`
      WHERE period_start = @startDate
        AND query = @query
        AND asin = @asin
      LIMIT 1
    `;

    const result = await this.pool.withClient(async (client) => {
      const [rows] = await client.query(queryStr, {
        startDate: format(previousStart, 'yyyy-MM-dd'),
        query,
        asin,
      });
      return rows.length > 0 ? rows[0] : null;
    });

    return result;
  }

  private compareMetrics(current: AggregatedMetrics, previous: AggregatedMetrics): any {
    const safeDivide = (numerator: number, denominator: number) => 
      denominator === 0 ? 0 : numerator / denominator;

    return {
      currentMetrics: {
        impressions: current.totalImpressions,
        clicks: current.totalClicks,
        purchases: current.totalPurchases,
        ctr: current.avgCTR,
        cvr: current.avgCVR,
      },
      previousMetrics: {
        impressions: previous.totalImpressions,
        clicks: previous.totalClicks,
        purchases: previous.totalPurchases,
        ctr: previous.avgCTR,
        cvr: previous.avgCVR,
      },
      changes: {
        impressions: current.totalImpressions - previous.totalImpressions,
        impressionsPercent: safeDivide(
          current.totalImpressions - previous.totalImpressions,
          previous.totalImpressions
        ) * 100,
        clicks: current.totalClicks - previous.totalClicks,
        clicksPercent: safeDivide(
          current.totalClicks - previous.totalClicks,
          previous.totalClicks
        ) * 100,
        purchases: current.totalPurchases - previous.totalPurchases,
        purchasesPercent: safeDivide(
          current.totalPurchases - previous.totalPurchases,
          previous.totalPurchases
        ) * 100,
        ctr: current.avgCTR - previous.avgCTR,
        cvr: current.avgCVR - previous.avgCVR,
      },
    };
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
    // Group by period and query to calculate shares
    const byPeriodQuery = new Map<string, AggregatedMetrics[]>();
    
    for (const record of aggregated) {
      const key = `${record.date}|${record.query}`;
      if (!byPeriodQuery.has(key)) {
        byPeriodQuery.set(key, []);
      }
      byPeriodQuery.get(key)!.push(record);
    }
    
    // Calculate shares within each period and query
    for (const [key, records] of byPeriodQuery.entries()) {
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

  private getTableSuffix(period: PeriodType): string {
    switch (period) {
      case 'weekly':
        return 'weekly';
      case 'monthly':
        return 'monthly';
      case 'quarterly':
        return 'quarterly';
      case 'yearly':
        return 'yearly';
      default:
        return 'weekly';
    }
  }

  private sum(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0);
  }
}