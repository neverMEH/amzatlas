import { BigQueryConnectionPool } from '../connection-pool';
import { DailyAggregator } from '../aggregators/daily-aggregator';
import { WeeklyAggregator } from '../aggregators/weekly-aggregator';
import { TrendCalculator } from './trend-calculator';
import { PerformanceScorer } from './performance-scorer';
import { MarketShareCalculator } from './market-share-calculator';
import { MetricsCalculator } from './metrics-calculator';
import { getFullTableName } from '@/config/bigquery.config';
import {
  SQPRecord,
  AggregatedMetrics,
  WeeklyTrend,
  KeywordPerformanceScore,
  MarketShareData,
  MarketOpportunity,
  DerivedMetrics,
  AdvancedMetrics,
  DataQualityReport,
  BatchProcessResult,
  TransformationOptions,
} from '../types';

export class SQPDataTransformer {
  private dailyAggregator: DailyAggregator;
  private weeklyAggregator: WeeklyAggregator;
  private trendCalculator: TrendCalculator;
  private performanceScorer: PerformanceScorer;
  private marketShareCalculator: MarketShareCalculator;
  private metricsCalculator: MetricsCalculator;

  constructor(private pool: BigQueryConnectionPool) {
    this.dailyAggregator = new DailyAggregator(pool);
    this.weeklyAggregator = new WeeklyAggregator(pool);
    this.trendCalculator = new TrendCalculator(pool);
    this.performanceScorer = new PerformanceScorer();
    this.marketShareCalculator = new MarketShareCalculator();
    this.metricsCalculator = new MetricsCalculator();
  }

  /**
   * Aggregate daily metrics from SQP records
   */
  async aggregateDailyMetrics(
    records: SQPRecord[],
    options: TransformationOptions = {}
  ): Promise<AggregatedMetrics[]> {
    return this.dailyAggregator.aggregate(records, options);
  }

  /**
   * Calculate weekly trends for an ASIN
   */
  async calculateWeeklyTrends(params: {
    asin: string;
    startDate: string;
    endDate: string;
    movingAveragePeriod?: number;
  }): Promise<WeeklyTrend[]> {
    const trends = await this.trendCalculator.calculateWeeklyTrends(
      params.asin,
      params.startDate,
      params.endDate
    );

    // Apply moving average if requested
    if (params.movingAveragePeriod) {
      return this.weeklyAggregator.calculateMovingAverage(
        trends,
        params.movingAveragePeriod
      );
    }

    return trends;
  }

  /**
   * Score keyword performance
   */
  async scoreKeywordPerformance(
    keywords: Array<{
      query: string;
      impressions: number;
      clicks: number;
      purchases: number;
      revenue?: number;
    }>,
    options: TransformationOptions = {}
  ): Promise<KeywordPerformanceScore[]> {
    const scores = await this.performanceScorer.scoreKeywords(keywords);

    if (options.includeRanking) {
      // Sort by score and add ranks
      scores.sort((a, b) => b.performanceScore - a.performanceScore);
      scores.forEach((score, index) => {
        score.rank = index + 1;
      });
    }

    return scores;
  }

  /**
   * Calculate market share by keyword
   */
  async calculateMarketShare(
    competitorData: Array<{
      query: string;
      asin: string;
      purchases: number;
    }>
  ): Promise<MarketShareData> {
    return this.marketShareCalculator.calculateMarketShare(competitorData);
  }

  /**
   * Calculate market share trends over time
   */
  async calculateMarketShareTrends(
    historicalData: Array<{
      query: string;
      asin: string;
      purchases: number;
      week: string;
    }>
  ): Promise<Record<string, Record<string, any>>> {
    return this.marketShareCalculator.calculateShareTrends(historicalData);
  }

  /**
   * Identify market opportunities
   */
  async identifyMarketOpportunities(criteria: {
    minMarketSize: number;
    maxCurrentShare: number;
    minGrowthRate: number;
  }): Promise<MarketOpportunity[]> {
    return this.marketShareCalculator.findOpportunities(this.pool, criteria);
  }

  /**
   * Calculate derived metrics for a record
   */
  calculateDerivedMetrics(record: SQPRecord): DerivedMetrics {
    return this.metricsCalculator.calculateDerivedMetrics(record);
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
    return this.metricsCalculator.calculateAdvancedMetrics(data);
  }

  /**
   * Monitor data quality
   */
  async monitorDataQuality(params: {
    dateRange: { startDate: string; endDate: string };
  }): Promise<DataQualityReport> {
    const query = `
      WITH daily_data AS (
        SELECT 
          DATE(query_date) as date,
          asin,
          COUNT(*) as record_count,
          SUM(impressions) as total_impressions,
          SUM(clicks) as total_clicks,
          SUM(purchases) as total_purchases
        FROM \`${this.getTableName('sqpRaw')}\`
        WHERE DATE(query_date) BETWEEN @startDate AND @endDate
        GROUP BY date, asin
      ),
      expected_dates AS (
        SELECT date
        FROM UNNEST(GENERATE_DATE_ARRAY(@startDate, @endDate)) as date
      )
      SELECT 
        ed.date,
        ARRAY_AGG(dd.asin IGNORE NULLS) as asins,
        COUNT(DISTINCT dd.asin) as asin_count
      FROM expected_dates ed
      LEFT JOIN daily_data dd ON ed.date = dd.date
      GROUP BY ed.date
    `;

    const results = await this.pool.withClient(async (client) => {
      return client.query(query, {
        startDate: params.dateRange.startDate,
        endDate: params.dateRange.endDate,
      });
    });

    return this.analyzeDataQuality(results);
  }

  /**
   * Detect missing data patterns
   */
  async detectMissingDataPatterns(data: any[]): Promise<{
    missingDates: string[];
    missingASINs: Record<string, string[]>;
    coverageScore: number;
  }> {
    const dates = new Set<string>();
    const asinsByDate = new Map<string, Set<string>>();
    const allASINs = new Set<string>();

    // Collect all dates and ASINs
    for (const record of data) {
      dates.add(record.date);
      allASINs.add(record.asin);
      
      if (!asinsByDate.has(record.date)) {
        asinsByDate.set(record.date, new Set());
      }
      asinsByDate.get(record.date)!.add(record.asin);
    }

    // Find missing combinations
    const missingDates: string[] = [];
    const missingASINs: Record<string, string[]> = {};

    const sortedDates = Array.from(dates).sort();
    const startDate = new Date(sortedDates[0]);
    const endDate = new Date(sortedDates[sortedDates.length - 1]);

    // Check for missing dates
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (!dates.has(dateStr)) {
        missingDates.push(dateStr);
      }
    }

    // Check for missing ASINs per date
    for (const [date, asins] of asinsByDate.entries()) {
      const missing = Array.from(allASINs).filter(asin => !asins.has(asin));
      if (missing.length > 0) {
        missingASINs[date] = missing;
      }
    }

    // Calculate coverage score
    const expectedRecords = dates.size * allASINs.size;
    const actualRecords = data.length;
    const coverageScore = expectedRecords > 0 ? actualRecords / expectedRecords : 0;

    return {
      missingDates,
      missingASINs,
      coverageScore,
    };
  }

  /**
   * Check metric consistency
   */
  async checkMetricConsistency(data: any[]): Promise<{
    issues: Array<{
      date: string;
      issue: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  }> {
    const issues: any[] = [];

    for (const record of data) {
      // Check if clicks exceed impressions
      if (record.clicks > record.impressions) {
        issues.push({
          date: record.date,
          issue: 'Clicks exceed impressions',
          severity: 'high',
        });
      }

      // Check if purchases exceed clicks
      if (record.purchases > record.clicks) {
        issues.push({
          date: record.date,
          issue: 'Purchases exceed clicks',
          severity: 'high',
        });
      }

      // Check for suspiciously high CTR
      const ctr = record.impressions > 0 ? record.clicks / record.impressions : 0;
      if (ctr > 0.5) {
        issues.push({
          date: record.date,
          issue: `Suspiciously high CTR: ${(ctr * 100).toFixed(1)}%`,
          severity: 'medium',
        });
      }

      // Check for suspiciously high CVR
      const cvr = record.clicks > 0 ? record.purchases / record.clicks : 0;
      if (cvr > 0.5) {
        issues.push({
          date: record.date,
          issue: `Suspiciously high CVR: ${(cvr * 100).toFixed(1)}%`,
          severity: 'medium',
        });
      }
    }

    return { issues };
  }

  /**
   * Process large datasets in batches
   */
  async batchProcess(
    data: SQPRecord[],
    options: {
      batchSize: number;
      operation: 'aggregate' | 'transform';
      continueOnError?: boolean;
    }
  ): Promise<BatchProcessResult> {
    const { batchSize, operation, continueOnError = false } = options;
    const batches = Math.ceil(data.length / batchSize);
    const errors: any[] = [];
    let successfulBatches = 0;

    for (let i = 0; i < batches; i++) {
      const batchStart = i * batchSize;
      const batchEnd = Math.min((i + 1) * batchSize, data.length);
      const batchData = data.slice(batchStart, batchEnd);

      try {
        if (operation === 'aggregate') {
          await this.aggregateDailyMetrics(batchData);
        } else {
          // Transform each record
          for (const record of batchData) {
            this.calculateDerivedMetrics(record);
          }
        }
        successfulBatches++;
      } catch (error) {
        errors.push({
          batch: i + 1,
          error: error instanceof Error ? error.message : 'Unknown error',
          recordsAffected: batchData.length,
        });

        if (!continueOnError) {
          throw error;
        }
      }
    }

    return {
      batchesProcessed: batches,
      totalRecords: data.length,
      successfulBatches,
      errors,
    };
  }

  /**
   * Private helper methods
   */
  private getTableName(table: string): string {
    const fullTableName = getFullTableName(table as any);
    return fullTableName;
  }

  private analyzeDataQuality(results: any[]): DataQualityReport {
    const missingDates: string[] = [];
    const anomalies: any[] = [];
    const inconsistencies: any[] = [];

    // Analyze results for quality issues
    for (const row of results) {
      if (!row.asins || row.asin_count === 0) {
        missingDates.push(row.date);
      }
    }

    // Calculate quality score (simple version)
    const qualityScore = 1 - (missingDates.length / results.length);

    return {
      missingDates,
      anomalies,
      inconsistencies,
      qualityScore,
      coverageScore: qualityScore, // Simplified for now
    };
  }
}