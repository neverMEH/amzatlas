import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BigQueryClient } from '@/lib/bigquery/client';
import { PeriodAggregator } from '@/lib/bigquery/aggregators/period-aggregator';
import { BigQueryConnectionPool } from '@/lib/bigquery/connection-pool';
import { PeriodType, ASINDistribution, DataQualityMetrics } from '@/lib/bigquery/types';
import { BigQueryDataInspector } from '@/lib/bigquery/data-inspector';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';

export interface SyncConfig {
  supabaseUrl: string;
  supabaseKey: string;
  bigqueryPool: BigQueryConnectionPool;
  batchSize?: number;
}

export interface ASINFilterStrategy {
  type: 'all' | 'top' | 'specific' | 'representative';
  count?: number;
  asins?: string[];
}

export interface SyncOptions {
  dryRun?: boolean;
  validateData?: boolean;
  inspect?: boolean;
}

export interface SyncResult {
  success: boolean;
  recordsSynced: number;
  errors: any[];
  dryRun?: boolean;
  wouldSync?: number;
  validation?: {
    totalRecords: number;
    successfulRecords: number;
    failedRecords: number;
    distinctQueries: number;
    distinctASINs: number;
    dataQualityScore: number;
  };
  inspection?: {
    sourceRecords: number;
    syncedRecords: number;
    asinDistribution: {
      total: number;
      byQuery: Record<string, string[]>;
    };
    metrics: {
      totalImpressions: number;
      totalClicks: number;
      avgCTR: number;
    };
  };
}

export interface PeriodComparisonOptions {
  query: string;
  sourcePeriod: PeriodType;
  targetPeriod: PeriodType;
  dateRange: {
    start: Date;
    end: Date;
  };
}

export interface PeriodComparisonResult {
  sourcePeriod: PeriodType;
  targetPeriod: PeriodType;
  matches: boolean;
  discrepancies: Array<{
    query: string;
    asin: string;
    field: string;
    sourceValue: any;
    targetValue: any;
  }>;
}

export class BigQueryToSupabaseSync {
  private supabase: SupabaseClient;
  private periodAggregator: PeriodAggregator;
  private batchSize: number;
  private pool: BigQueryConnectionPool;
  private inspector: BigQueryDataInspector;
  private asinFilter: ASINFilterStrategy = { type: 'all' };

  constructor(config: SyncConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.pool = config.bigqueryPool;
    this.periodAggregator = new PeriodAggregator(config.bigqueryPool);
    this.inspector = new BigQueryDataInspector(config.bigqueryPool);
    this.batchSize = config.batchSize || 1000;
  }

  /**
   * Set ASIN filtering strategy
   */
  setASINFilter(filter: ASINFilterStrategy): void {
    this.asinFilter = filter;
  }

  /**
   * Get current ASIN filter configuration
   */
  getASINFilter(): ASINFilterStrategy {
    return { ...this.asinFilter };
  }

  /**
   * Sync aggregated data from BigQuery to Supabase for a specific period
   */
  async syncPeriodData(
    periodType: PeriodType,
    startDate: Date,
    endDate: Date,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const errors: any[] = [];
    let recordsSynced = 0;
    let successfulRecords = 0;
    let failedRecords = 0;
    const distinctQueries = new Set<string>();
    const distinctASINs = new Set<string>();
    let totalImpressions = 0;
    let totalClicks = 0;

    try {
      // Apply ASIN filtering if needed
      const asinFilterClause = await this.buildASINFilterClause();
      
      // Get aggregated data from BigQuery
      const query = this.buildAggregationQuery(periodType, startDate, endDate, asinFilterClause);
      const data = await this.executeBigQueryQuery(query);

      // If dry run, just return what would be synced
      if (options.dryRun) {
        return {
          success: true,
          recordsSynced: 0,
          errors: [],
          dryRun: true,
          wouldSync: data.length,
        };
      }

      // Track metrics for validation
      data.forEach((record: any) => {
        distinctQueries.add(record.query);
        distinctASINs.add(record.asin);
        totalImpressions += record.total_impressions || 0;
        totalClicks += record.total_clicks || 0;
      });

      // Process in batches
      for (let i = 0; i < data.length; i += this.batchSize) {
        const batch = data.slice(i, i + this.batchSize);
        const tableName = this.getSupabaseTableName(periodType);

        try {
          const { error } = await this.supabase
            .from(tableName)
            .upsert(batch, { onConflict: this.getConflictColumns(periodType) });

          if (error) {
            errors.push({
              batch: Math.floor(i / this.batchSize) + 1,
              error: error instanceof Error ? error.message : String(error),
              details: error,
            });
            failedRecords += batch.length;
          } else {
            recordsSynced += batch.length;
            successfulRecords += batch.length;
          }
        } catch (batchError) {
          errors.push({
            batch: Math.floor(i / this.batchSize) + 1,
            error: batchError instanceof Error ? batchError.message : String(batchError),
          });
          failedRecords += batch.length;
        }
      }

      // Sync period comparisons if applicable
      if (periodType !== 'yearly') {
        await this.syncPeriodComparisons(periodType, startDate, endDate);
      }

      const result: SyncResult = {
        success: errors.length === 0,
        recordsSynced,
        errors,
      };

      // Add validation metrics if requested
      if (options.validateData) {
        result.validation = {
          totalRecords: data.length,
          successfulRecords,
          failedRecords,
          distinctQueries: distinctQueries.size,
          distinctASINs: distinctASINs.size,
          dataQualityScore: successfulRecords / data.length * 100,
        };
      }

      // Add inspection data if requested
      if (options.inspect) {
        const asinsByQuery: Record<string, string[]> = {};
        data.forEach((record: any) => {
          if (!asinsByQuery[record.query]) {
            asinsByQuery[record.query] = [];
          }
          if (!asinsByQuery[record.query].includes(record.asin)) {
            asinsByQuery[record.query].push(record.asin);
          }
        });

        result.inspection = {
          sourceRecords: data.length,
          syncedRecords: recordsSynced,
          asinDistribution: {
            total: distinctASINs.size,
            byQuery: asinsByQuery,
          },
          metrics: {
            totalImpressions,
            totalClicks,
            avgCTR: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
          },
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        recordsSynced: 0,
        errors: [{ error: error instanceof Error ? error.message : String(error), type: 'general' }],
      };
    }
  }

  /**
   * Sync all periods for a date range
   */
  async syncAllPeriods(
    startDate: Date,
    endDate: Date
  ): Promise<Record<PeriodType, { success: boolean; recordsSynced: number }>> {
    const results: Record<PeriodType, { success: boolean; recordsSynced: number }> = {} as any;
    const periods: PeriodType[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

    for (const period of periods) {
      const periodStart = this.getPeriodStart(startDate, period);
      const periodEnd = this.getPeriodEnd(endDate, period);
      
      const result = await this.syncPeriodData(period, periodStart, periodEnd);
      results[period] = {
        success: result.success,
        recordsSynced: result.recordsSynced,
      };

      console.log(`Synced ${period} data: ${result.recordsSynced} records`);
      if (!result.success) {
        console.error(`Errors syncing ${period}:`, result.errors);
      }
    }

    return results;
  }

  /**
   * Refresh materialized views in Supabase
   */
  async refreshMaterializedViews(): Promise<void> {
    try {
      await this.supabase.rpc('refresh_all_views');
      console.log('Materialized views refreshed successfully');
    } catch (error) {
      console.error('Error refreshing materialized views:', error);
      throw error;
    }
  }

  /**
   * Sync period data with inspection
   */
  async syncPeriodDataWithInspection(options: {
    periodType: PeriodType;
    startDate: Date;
    endDate: Date;
    inspect?: boolean;
  }): Promise<SyncResult> {
    return this.syncPeriodData(
      options.periodType,
      options.startDate,
      options.endDate,
      { inspect: options.inspect || false }
    );
  }

  /**
   * Compare period data
   */
  async comparePeriodData(options: PeriodComparisonOptions): Promise<PeriodComparisonResult> {
    const client = await this.pool.acquire();
    
    try {
      const { query, sourcePeriod, targetPeriod, dateRange } = options;
      const discrepancies: any[] = [];
      
      // Get source period data
      const sourceData = await this.getPeriodData(sourcePeriod, query, dateRange.start, dateRange.end);
      
      // Get target period data
      const targetData = await this.getPeriodData(targetPeriod, query, dateRange.start, dateRange.end);
      
      // Compare data
      const sourceMap = new Map(
        sourceData.map((r: any) => [`${r.query}-${r.asin}`, r])
      );
      
      targetData.forEach((targetRecord: any) => {
        const key = `${targetRecord.query}-${targetRecord.asin}`;
        const sourceRecord = sourceMap.get(key);
        
        if (!sourceRecord) {
          discrepancies.push({
            query: targetRecord.query,
            asin: targetRecord.asin,
            field: 'missing',
            sourceValue: null,
            targetValue: targetRecord,
          });
        } else {
          // Compare key metrics
          const fields = ['total_impressions', 'total_clicks', 'total_purchases'];
          fields.forEach(field => {
            if (Math.abs(sourceRecord[field] - targetRecord[field]) > 0.01) {
              discrepancies.push({
                query: targetRecord.query,
                asin: targetRecord.asin,
                field,
                sourceValue: sourceRecord[field],
                targetValue: targetRecord[field],
              });
            }
          });
        }
      });
      
      return {
        sourcePeriod,
        targetPeriod,
        matches: discrepancies.length === 0,
        discrepancies: discrepancies.slice(0, 100), // Limit to 100 discrepancies
      };
    } finally {
      this.pool.release(client);
    }
  }

  /**
   * Build ASIN filter clause based on current filter strategy
   */
  private async buildASINFilterClause(): Promise<string> {
    switch (this.asinFilter.type) {
      case 'all':
        return '';
        
      case 'specific':
        if (!this.asinFilter.asins || this.asinFilter.asins.length === 0) {
          return '';
        }
        if (this.asinFilter.asins.length === 1) {
          return `AND asin = '${this.asinFilter.asins[0]}'`;
        }
        const asinList = this.asinFilter.asins.map(a => `'${a}'`).join(', ');
        return `AND asin IN (${asinList})`;
        
      case 'top':
        const topN = this.asinFilter.count || 10;
        // This requires a subquery to get top N ASINs
        return `AND asin IN (
          SELECT asin
          FROM (
            SELECT asin, SUM(impressions) as total_impressions
            FROM \`${this.getFullTableName('sqpRaw')}\`
            WHERE DATE(query_date) BETWEEN @periodStart AND @periodEnd
            GROUP BY asin
            ORDER BY total_impressions DESC
            LIMIT ${topN}
          )
        )`;
        
      case 'representative':
        // For representative sampling, we'd need to implement a more complex strategy
        // For now, defaulting to top 10% of ASINs
        return `AND asin IN (
          SELECT asin
          FROM (
            SELECT asin, SUM(impressions) as total_impressions,
              PERCENT_RANK() OVER (ORDER BY SUM(impressions) DESC) as pct_rank
            FROM \`${this.getFullTableName('sqpRaw')}\`
            WHERE DATE(query_date) BETWEEN @periodStart AND @periodEnd
            GROUP BY asin
          )
          WHERE pct_rank <= 0.1
        )`;
        
      default:
        return '';
    }
  }

  /**
   * Private helper methods
   */
  private buildAggregationQuery(
    periodType: PeriodType, 
    startDate: Date, 
    endDate: Date, 
    asinFilterClause: string = ''
  ): string {
    const periodStart = format(startDate, 'yyyy-MM-dd');
    const periodEnd = format(endDate, 'yyyy-MM-dd');
    
    const periodFields = this.getPeriodFields(periodType);
    
    return `
      SELECT
        '${periodType}' as period,
        DATE('${periodStart}') as period_start,
        DATE('${periodEnd}') as period_end,
        ${periodFields.dateFields}
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
        SAFE_DIVIDE(SUM(impressions), SUM(SUM(impressions)) OVER (PARTITION BY query)) as impression_share,
        SAFE_DIVIDE(SUM(clicks), SUM(SUM(clicks)) OVER (PARTITION BY query)) as click_share,
        SAFE_DIVIDE(SUM(purchases), SUM(SUM(purchases)) OVER (PARTITION BY query)) as purchase_share
      FROM \`${this.getFullTableName('sqpRaw')}\`
      WHERE DATE(query_date) BETWEEN '${periodStart}' AND '${periodEnd}'
        ${asinFilterClause}
      GROUP BY query, asin${periodFields.groupBy}
    `;
  }

  private getPeriodFields(periodType: PeriodType): { dateFields: string; groupBy: string } {
    switch (periodType) {
      case 'monthly':
        return {
          dateFields: `
            EXTRACT(YEAR FROM DATE('${format(new Date(), 'yyyy-MM-dd')}')) as year,
            EXTRACT(MONTH FROM DATE('${format(new Date(), 'yyyy-MM-dd')}')) as month,
          `,
          groupBy: '',
        };
      case 'quarterly':
        return {
          dateFields: `
            EXTRACT(YEAR FROM DATE('${format(new Date(), 'yyyy-MM-dd')}')) as year,
            EXTRACT(QUARTER FROM DATE('${format(new Date(), 'yyyy-MM-dd')}')) as quarter,
          `,
          groupBy: '',
        };
      case 'yearly':
        return {
          dateFields: `
            EXTRACT(YEAR FROM DATE('${format(new Date(), 'yyyy-MM-dd')}')) as year,
          `,
          groupBy: '',
        };
      default:
        return { dateFields: '', groupBy: '' };
    }
  }

  private async executeBigQueryQuery(query: string): Promise<any[]> {
    const client = await this.pool.acquire();
    
    try {
      const rows = await client.query(query);
      return rows;
    } finally {
      this.pool.release(client);
    }
  }

  /**
   * Get period data for comparison
   */
  private async getPeriodData(
    periodType: PeriodType,
    query: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    const tableName = this.getSupabaseTableName(periodType);
    const dateStart = format(startDate, 'yyyy-MM-dd');
    const dateEnd = format(endDate, 'yyyy-MM-dd');
    
    // Query from Supabase
    const { data, error } = await this.supabase
      .from(tableName)
      .select('*')
      .eq('query', query)
      .gte('period_start', dateStart)
      .lte('period_start', dateEnd);
      
    if (error) {
      throw new Error(`Failed to get ${periodType} data: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return data || [];
  }

  private getSupabaseTableName(periodType: PeriodType): string {
    return `sqp.${periodType}_summary`;
  }

  private getConflictColumns(periodType: PeriodType): string {
    switch (periodType) {
      case 'weekly':
        return 'period_start,query,asin';
      case 'monthly':
        return 'year,month,query,asin';
      case 'quarterly':
        return 'year,quarter,query,asin';
      case 'yearly':
        return 'year,query,asin';
      default:
        return 'period_start,query,asin';
    }
  }

  private async syncPeriodComparisons(
    periodType: PeriodType,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    // Implementation for syncing period comparison data
    const tableName = `sqp.period_comparisons`;
    
    // This would fetch comparison data from BigQuery and sync to Supabase
    // Placeholder for now
  }

  private getPeriodStart(date: Date, period: PeriodType): Date {
    switch (period) {
      case 'weekly':
        return startOfWeek(date);
      case 'monthly':
        return startOfMonth(date);
      case 'quarterly':
        return startOfQuarter(date);
      case 'yearly':
        return startOfYear(date);
      default:
        return date;
    }
  }

  private getPeriodEnd(date: Date, period: PeriodType): Date {
    switch (period) {
      case 'weekly':
        return endOfWeek(date);
      case 'monthly':
        return endOfMonth(date);
      case 'quarterly':
        return endOfQuarter(date);
      case 'yearly':
        return endOfYear(date);
      default:
        return date;
    }
  }

  private getFullTableName(table: string): string {
    // This would use the config to get the full table name
    return `project.dataset.${table}`;
  }
}