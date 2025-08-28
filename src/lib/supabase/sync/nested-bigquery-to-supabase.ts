import { BigQuery } from '@google-cloud/bigquery';
import { getSupabaseClient } from '@/config/supabase.config';
import { NestedDataTransformer } from './nested-data-transformer';
import { BigQueryNestedResponse, SyncLogEntry } from './types';
import { SyncLogger } from './sync-logger';

export class NestedBigQueryToSupabaseSync {
  private bigquery: BigQuery;
  private supabase = getSupabaseClient();
  private transformer = new NestedDataTransformer();
  private logger = new SyncLogger(this.supabase);

  constructor(
    private config: {
      projectId: string;
      dataset: string;
      table: string;
      batchSize?: number;
    }
  ) {
    this.bigquery = new BigQuery({
      projectId: config.projectId,
    });
  }

  /**
   * Sync data from BigQuery to Supabase for a specific date range
   */
  async syncDateRange(
    startDate: Date,
    endDate: Date,
    options?: {
      asins?: string[];
      reportingPeriod?: 'WEEK' | 'MONTH' | 'QUARTER';
      dryRun?: boolean;
    }
  ): Promise<{
    success: boolean;
    recordsProcessed: number;
    errors: any[];
    syncLogId?: number;
  }> {
    const syncLogId = await this.logger.startSync({
      sync_type: 'weekly',
      sync_status: 'started',
      started_at: new Date(),
      source_table: `${this.config.projectId}.${this.config.dataset}.${this.config.table}`,
      target_table: 'sqp.search_query_performance',
      period_start: startDate,
      period_end: endDate,
      sync_metadata: { asins: options?.asins, reportingPeriod: options?.reportingPeriod }
    });

    try {
      // Build and execute BigQuery query
      const query = this.buildQuery(startDate, endDate, options);
      console.log('Executing BigQuery query:', query);

      const [job] = await this.bigquery.createQueryJob({ query });
      const [rows] = await job.getQueryResults();

      if (!rows || rows.length === 0) {
        await this.logger.completeSync(syncLogId, {
          records_processed: 0,
          records_inserted: 0,
          records_updated: 0,
          records_failed: 0
        });
        return {
          success: true,
          recordsProcessed: 0,
          errors: [],
          syncLogId: syncLogId
        };
      }

      // Transform rows into nested structure
      const nestedResponse = this.transformToNestedStructure(rows);

      if (!this.transformer.validateNestedData(nestedResponse)) {
        throw new Error('Invalid data structure received from BigQuery');
      }

      // Perform dry run if requested
      if (options?.dryRun) {
        console.log('Dry run - would process:', {
          asins: nestedResponse.dataByAsin.length,
          totalQueries: nestedResponse.dataByAsin.reduce(
            (sum, asin) => sum + asin.searchQueryData.length, 0
          )
        });
        await this.logger.failSync(syncLogId, new Error('Dry run completed'));
        return {
          success: true,
          recordsProcessed: 0,
          errors: [],
          syncLogId: syncLogId
        };
      }

      // Transform and sync data
      const results = await this.transformer.transformAndSync(
        nestedResponse,
        syncLogId
      );

      // Log data quality checks
      await this.performDataQualityChecks(syncLogId, nestedResponse, results);

      // Complete sync log
      await this.logger.completeSync(syncLogId, {
        records_processed: results.asinRecords + results.queryRecords + results.summaryRecords,
        records_inserted: results.asinRecords + results.queryRecords + results.summaryRecords,
        records_updated: 0,
        records_failed: results.errors.length
      });

      return {
        success: results.errors.length === 0,
        recordsProcessed: results.asinRecords + results.queryRecords + results.summaryRecords,
        errors: results.errors,
        syncLogId: syncLogId
      };

    } catch (error) {
      await this.logger.failSync(syncLogId, error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        recordsProcessed: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        syncLogId: syncLogId
      };
    }
  }

  /**
   * Build BigQuery query for nested structure
   * Note: The actual BigQuery table appears to be flat, not nested
   * We'll query the flat structure and transform it to nested in code
   */
  private buildQuery(
    startDate: Date,
    endDate: Date,
    options?: {
      asins?: string[];
      reportingPeriod?: 'WEEK' | 'MONTH' | 'QUARTER';
    }
  ): string {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Since the actual structure may be flat, let's query the available columns
    let query = `
      SELECT 
        date as startDate,
        date as endDate,
        asin,
        *
      FROM \`${this.config.projectId}.${this.config.dataset}.${this.config.table}\`
      WHERE date >= '${startDateStr}'
        AND date <= '${endDateStr}'`;

    if (options?.asins && options.asins.length > 0) {
      const asinList = options.asins.map(asin => `'${asin}'`).join(',');
      query += ` AND asin IN (${asinList})`;
    }

    query += `
      ORDER BY date, asin
      LIMIT 1000`; // Add limit for initial testing

    return query;
  }

  /**
   * Transform flat BigQuery rows into nested structure
   */
  private transformToNestedStructure(rows: any[]): BigQueryNestedResponse {
    // Group by ASIN and date range
    const asinMap = new Map<string, any>();

    for (const row of rows) {
      const key = `${row.startDate}_${row.endDate}_${row.asin}`;
      
      if (!asinMap.has(key)) {
        asinMap.set(key, {
          startDate: row.startDate,
          endDate: row.endDate,
          asin: row.asin,
          searchQueryData: []
        });
      }

      // If searchQueryData is already an array (from ARRAY_AGG), use it directly
      if (Array.isArray(row.searchQueryData)) {
        asinMap.get(key)!.searchQueryData.push(...row.searchQueryData);
      } else {
        // Otherwise, construct the search query data object
        asinMap.get(key)!.searchQueryData.push({
          searchQuery: row.searchQuery,
          searchQueryScore: row.searchQueryScore,
          searchQueryVolume: row.searchQueryVolume,
          impressionData: row.impressionData || {
            totalQueryImpressionCount: row.totalQueryImpressionCount,
            asinImpressionCount: row.asinImpressionCount,
            asinImpressionShare: row.asinImpressionShare
          },
          clickData: row.clickData || {
            totalClickCount: row.totalClickCount,
            totalClickRate: row.totalClickRate,
            asinClickCount: row.asinClickCount,
            asinClickShare: row.asinClickShare,
            totalMedianClickPrice: row.totalMedianClickPrice,
            asinMedianClickPrice: row.asinMedianClickPrice,
            totalSameDayShippingClickCount: row.totalSameDayShippingClickCount,
            totalOneDayShippingClickCount: row.totalOneDayShippingClickCount,
            totalTwoDayShippingClickCount: row.totalTwoDayShippingClickCount
          },
          cartAddData: row.cartAddData || {
            totalCartAddCount: row.totalCartAddCount,
            totalCartAddRate: row.totalCartAddRate,
            asinCartAddCount: row.asinCartAddCount,
            asinCartAddShare: row.asinCartAddShare,
            totalMedianCartAddPrice: row.totalMedianCartAddPrice,
            asinMedianCartAddPrice: row.asinMedianCartAddPrice,
            totalSameDayShippingCartAddCount: row.totalSameDayShippingCartAddCount,
            totalOneDayShippingCartAddCount: row.totalOneDayShippingCartAddCount,
            totalTwoDayShippingCartAddCount: row.totalTwoDayShippingCartAddCount
          },
          purchaseData: row.purchaseData || {
            totalPurchaseCount: row.totalPurchaseCount,
            totalPurchaseRate: row.totalPurchaseRate,
            asinPurchaseCount: row.asinPurchaseCount,
            asinPurchaseShare: row.asinPurchaseShare,
            totalMedianPurchasePrice: row.totalMedianPurchasePrice,
            asinMedianPurchasePrice: row.asinMedianPurchasePrice,
            totalSameDayShippingPurchaseCount: row.totalSameDayShippingPurchaseCount,
            totalOneDayShippingPurchaseCount: row.totalOneDayShippingPurchaseCount,
            totalTwoDayShippingPurchaseCount: row.totalTwoDayShippingPurchaseCount
          }
        });
      }
    }

    return {
      dataByAsin: Array.from(asinMap.values())
    };
  }

  /**
   * Perform data quality checks
   */
  private async performDataQualityChecks(
    syncLogId: number,
    data: BigQueryNestedResponse,
    results: any
  ): Promise<void> {
    // Check 1: Row count validation
    const expectedRows = data.dataByAsin.reduce(
      (sum, asin) => sum + asin.searchQueryData.length, 0
    );
    
    await this.logger.logDataQualityCheck(syncLogId, {
      check_type: 'row_count',
      check_status: results.queryRecords === expectedRows ? 'passed' : 'warning',
      source_value: expectedRows,
      target_value: results.queryRecords,
      difference: Math.abs(expectedRows - results.queryRecords),
      check_message: `Expected ${expectedRows} query records, inserted ${results.queryRecords}`
    });

    // Check 2: Share validation (shares should sum to <= 100%)
    for (const asinData of data.dataByAsin) {
      for (const queryData of asinData.searchQueryData) {
        const shareValid = 
          queryData.impressionData.asinImpressionShare <= 1 &&
          queryData.clickData.asinClickShare <= 1 &&
          queryData.cartAddData.asinCartAddShare <= 1 &&
          queryData.purchaseData.asinPurchaseShare <= 1;

        if (!shareValid) {
          await this.logger.logDataQualityCheck(syncLogId, {
            check_type: 'sum_validation',
            check_status: 'warning',
            check_message: `Share values exceed 100% for ASIN ${asinData.asin}, query ${queryData.searchQuery}`,
            table_name: 'search_query_performance',
            check_metadata: {
              asin: asinData.asin,
              searchQuery: queryData.searchQuery,
              shares: {
                impression: queryData.impressionData.asinImpressionShare,
                click: queryData.clickData.asinClickShare,
                cartAdd: queryData.cartAddData.asinCartAddShare,
                purchase: queryData.purchaseData.asinPurchaseShare
              }
            }
          });
        }
      }
    }

    // Check 3: Funnel consistency (impressions >= clicks >= cart adds >= purchases)
    for (const asinData of data.dataByAsin) {
      for (const queryData of asinData.searchQueryData) {
        const funnelValid = 
          queryData.impressionData.asinImpressionCount >= queryData.clickData.asinClickCount &&
          queryData.clickData.asinClickCount >= queryData.cartAddData.asinCartAddCount &&
          queryData.cartAddData.asinCartAddCount >= queryData.purchaseData.asinPurchaseCount;

        if (!funnelValid) {
          await this.logger.logDataQualityCheck(syncLogId, {
            check_type: 'sum_validation',
            check_status: 'failed',
            check_message: `Funnel consistency check failed for ASIN ${asinData.asin}, query ${queryData.searchQuery}`,
            table_name: 'search_query_performance',
            check_metadata: {
              asin: asinData.asin,
              searchQuery: queryData.searchQuery,
              funnel: {
                impressions: queryData.impressionData.asinImpressionCount,
                clicks: queryData.clickData.asinClickCount,
                cartAdds: queryData.cartAddData.asinCartAddCount,
                purchases: queryData.purchaseData.asinPurchaseCount
              }
            }
          });
        }
      }
    }
  }

  /**
   * Get sync status and metrics
   */
  async getSyncStatus(syncLogId?: number): Promise<SyncLogEntry | null> {
    if (!syncLogId) return null;
    return this.logger.getSyncLog(syncLogId);
  }
}