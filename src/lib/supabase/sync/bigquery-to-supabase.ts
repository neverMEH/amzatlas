import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BigQueryClient } from '@/lib/bigquery/client';
import { PeriodAggregator } from '@/lib/bigquery/aggregators/period-aggregator';
import { BigQueryConnectionPool } from '@/lib/bigquery/connection-pool';
import { PeriodType } from '@/lib/bigquery/types';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';

export interface SyncConfig {
  supabaseUrl: string;
  supabaseKey: string;
  bigqueryPool: BigQueryConnectionPool;
  batchSize?: number;
}

export class BigQueryToSupabaseSync {
  private supabase: SupabaseClient;
  private periodAggregator: PeriodAggregator;
  private batchSize: number;

  constructor(config: SyncConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.periodAggregator = new PeriodAggregator(config.bigqueryPool);
    this.batchSize = config.batchSize || 1000;
  }

  /**
   * Sync aggregated data from BigQuery to Supabase for a specific period
   */
  async syncPeriodData(
    periodType: PeriodType,
    startDate: Date,
    endDate: Date
  ): Promise<{ success: boolean; recordsSynced: number; errors: any[] }> {
    const errors: any[] = [];
    let recordsSynced = 0;

    try {
      // Get aggregated data from BigQuery
      const query = this.buildAggregationQuery(periodType, startDate, endDate);
      const data = await this.executeBigQueryQuery(query);

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
              error: error.message,
              details: error,
            });
          } else {
            recordsSynced += batch.length;
          }
        } catch (batchError) {
          errors.push({
            batch: Math.floor(i / this.batchSize) + 1,
            error: batchError.message,
          });
        }
      }

      // Sync period comparisons if applicable
      if (periodType !== 'yearly') {
        await this.syncPeriodComparisons(periodType, startDate, endDate);
      }

      return {
        success: errors.length === 0,
        recordsSynced,
        errors,
      };
    } catch (error) {
      return {
        success: false,
        recordsSynced: 0,
        errors: [{ error: error.message, type: 'general' }],
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
   * Private helper methods
   */
  private buildAggregationQuery(periodType: PeriodType, startDate: Date, endDate: Date): string {
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
    // This would use the BigQuery client to execute the query
    // For now, returning a placeholder
    return [];
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