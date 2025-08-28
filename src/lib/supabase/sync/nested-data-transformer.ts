import { 
  BigQueryNestedResponse, 
  BigQueryASINData, 
  BigQuerySearchQueryData,
  SupabaseASINPerformance,
  SupabaseSearchQueryPerformance,
  SupabaseWeeklySummary
} from './types';
import { getSupabaseClient } from '@/config/supabase.config';

export class NestedDataTransformer {
  private supabase = getSupabaseClient();

  /**
   * Transform and sync nested BigQuery response to Supabase tables
   */
  async transformAndSync(
    bigQueryResponse: BigQueryNestedResponse,
    syncLogId?: number
  ): Promise<{
    asinRecords: number;
    queryRecords: number;
    summaryRecords: number;
    errors: any[];
  }> {
    const results = {
      asinRecords: 0,
      queryRecords: 0,
      summaryRecords: 0,
      errors: [] as any[]
    };

    try {
      // Process each ASIN's data
      for (const asinData of bigQueryResponse.dataByAsin) {
        try {
          // Step 1: Insert ASIN performance record
          const asinRecord = await this.insertASINPerformance(asinData);
          if (!asinRecord) {
            results.errors.push({
              asin: asinData.asin,
              error: 'Failed to insert ASIN performance record'
            });
            continue;
          }
          results.asinRecords++;

          // Step 2: Insert search query performance records
          const queryResults = await this.insertSearchQueryPerformance(
            asinRecord.id!,
            asinData
          );
          results.queryRecords += queryResults.inserted;
          results.errors.push(...queryResults.errors);

          // Step 3: Update weekly summary records
          const summaryResults = await this.updateWeeklySummaries(
            asinData,
            syncLogId
          );
          results.summaryRecords += summaryResults.updated;
          results.errors.push(...summaryResults.errors);

        } catch (error) {
          results.errors.push({
            asin: asinData.asin,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    } catch (error) {
      results.errors.push({
        error: error instanceof Error ? error.message : 'Unknown error',
        phase: 'overall_processing'
      });
    }

    return results;
  }

  /**
   * Insert ASIN performance record
   */
  private async insertASINPerformance(
    asinData: BigQueryASINData
  ): Promise<SupabaseASINPerformance | null> {
    const { data, error } = await this.supabase
      .from('asin_performance_data')
      .upsert({
        start_date: asinData.startDate,
        end_date: asinData.endDate,
        asin: asinData.asin
      }, {
        onConflict: 'start_date,end_date,asin'
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting ASIN performance:', error);
      return null;
    }

    return data;
  }

  /**
   * Insert search query performance records
   */
  private async insertSearchQueryPerformance(
    asinPerformanceId: number,
    asinData: BigQueryASINData
  ): Promise<{ inserted: number; errors: any[] }> {
    const results = { inserted: 0, errors: [] as any[] };

    // Prepare batch of records
    const records: Omit<SupabaseSearchQueryPerformance, 'id' | 'created_at' | 'updated_at'>[] = 
      asinData.searchQueryData.map(queryData => ({
        asin_performance_id: asinPerformanceId,
        search_query: queryData.searchQuery,
        search_query_score: queryData.searchQueryScore,
        search_query_volume: queryData.searchQueryVolume,
        
        // Impression metrics
        total_query_impression_count: queryData.impressionData.totalQueryImpressionCount,
        asin_impression_count: queryData.impressionData.asinImpressionCount,
        asin_impression_share: queryData.impressionData.asinImpressionShare,
        
        // Click metrics
        total_click_count: queryData.clickData.totalClickCount,
        total_click_rate: queryData.clickData.totalClickRate,
        asin_click_count: queryData.clickData.asinClickCount,
        asin_click_share: queryData.clickData.asinClickShare,
        total_median_click_price: queryData.clickData.totalMedianClickPrice,
        asin_median_click_price: queryData.clickData.asinMedianClickPrice,
        total_same_day_shipping_click_count: queryData.clickData.totalSameDayShippingClickCount,
        total_one_day_shipping_click_count: queryData.clickData.totalOneDayShippingClickCount,
        total_two_day_shipping_click_count: queryData.clickData.totalTwoDayShippingClickCount,
        
        // Cart add metrics
        total_cart_add_count: queryData.cartAddData.totalCartAddCount,
        total_cart_add_rate: queryData.cartAddData.totalCartAddRate,
        asin_cart_add_count: queryData.cartAddData.asinCartAddCount,
        asin_cart_add_share: queryData.cartAddData.asinCartAddShare,
        total_median_cart_add_price: queryData.cartAddData.totalMedianCartAddPrice,
        asin_median_cart_add_price: queryData.cartAddData.asinMedianCartAddPrice,
        total_same_day_shipping_cart_add_count: queryData.cartAddData.totalSameDayShippingCartAddCount,
        total_one_day_shipping_cart_add_count: queryData.cartAddData.totalOneDayShippingCartAddCount,
        total_two_day_shipping_cart_add_count: queryData.cartAddData.totalTwoDayShippingCartAddCount,
        
        // Purchase metrics
        total_purchase_count: queryData.purchaseData.totalPurchaseCount,
        total_purchase_rate: queryData.purchaseData.totalPurchaseRate,
        asin_purchase_count: queryData.purchaseData.asinPurchaseCount,
        asin_purchase_share: queryData.purchaseData.asinPurchaseShare,
        total_median_purchase_price: queryData.purchaseData.totalMedianPurchasePrice,
        asin_median_purchase_price: queryData.purchaseData.asinMedianPurchasePrice,
        total_same_day_shipping_purchase_count: queryData.purchaseData.totalSameDayShippingPurchaseCount,
        total_one_day_shipping_purchase_count: queryData.purchaseData.totalOneDayShippingPurchaseCount,
        total_two_day_shipping_purchase_count: queryData.purchaseData.totalTwoDayShippingPurchaseCount,
      }));

    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const { data, error } = await this.supabase
        .from('search_query_performance')
        .upsert(batch, {
          onConflict: 'asin_performance_id,search_query'
        });

      if (error) {
        results.errors.push({
          batch: `${i}-${i + batch.length}`,
          error: error.message
        });
      } else {
        results.inserted += batch.length;
      }
    }

    return results;
  }

  /**
   * Update weekly summary records with new data
   */
  private async updateWeeklySummaries(
    asinData: BigQueryASINData,
    syncLogId?: number
  ): Promise<{ updated: number; errors: any[] }> {
    const results = { updated: 0, errors: [] as any[] };

    // Prepare summary records
    const summaryRecords = asinData.searchQueryData.map(queryData => ({
      period_start: asinData.startDate,
      period_end: asinData.endDate,
      query: queryData.searchQuery,
      asin: asinData.asin,
      
      // Legacy fields (for backward compatibility)
      total_impressions: queryData.impressionData.asinImpressionCount,
      total_clicks: queryData.clickData.asinClickCount,
      total_purchases: queryData.purchaseData.asinPurchaseCount,
      avg_ctr: queryData.impressionData.asinImpressionCount > 0 
        ? queryData.clickData.asinClickCount / queryData.impressionData.asinImpressionCount 
        : 0,
      avg_cvr: queryData.clickData.asinClickCount > 0 
        ? queryData.purchaseData.asinPurchaseCount / queryData.clickData.asinClickCount 
        : 0,
      purchases_per_impression: queryData.impressionData.asinImpressionCount > 0 
        ? queryData.purchaseData.asinPurchaseCount / queryData.impressionData.asinImpressionCount 
        : 0,
      impression_share: queryData.impressionData.asinImpressionShare,
      click_share: queryData.clickData.asinClickShare,
      purchase_share: queryData.purchaseData.asinPurchaseShare,
      
      // New fields
      search_query_score: queryData.searchQueryScore,
      search_query_volume: queryData.searchQueryVolume,
      total_query_impression_count: queryData.impressionData.totalQueryImpressionCount,
      total_click_count: queryData.clickData.totalClickCount,
      total_cart_add_count: queryData.cartAddData.totalCartAddCount,
      total_purchase_count: queryData.purchaseData.totalPurchaseCount,
      total_median_click_price: queryData.clickData.totalMedianClickPrice,
      asin_median_click_price: queryData.clickData.asinMedianClickPrice,
      total_median_cart_add_price: queryData.cartAddData.totalMedianCartAddPrice,
      asin_median_cart_add_price: queryData.cartAddData.asinMedianCartAddPrice,
      total_median_purchase_price: queryData.purchaseData.totalMedianPurchasePrice,
      asin_median_purchase_price: queryData.purchaseData.asinMedianPurchasePrice,
      cart_adds: queryData.cartAddData.asinCartAddCount,
      cart_add_rate: queryData.clickData.asinClickCount > 0 
        ? queryData.cartAddData.asinCartAddCount / queryData.clickData.asinClickCount 
        : 0,
      cart_add_share: queryData.cartAddData.asinCartAddShare,
      
      sync_log_id: syncLogId,
      last_synced_at: new Date().toISOString()
    }));

    // Upsert in batches
    const batchSize = 50;
    for (let i = 0; i < summaryRecords.length; i += batchSize) {
      const batch = summaryRecords.slice(i, i + batchSize);
      
      const { data, error } = await this.supabase
        .from('weekly_summary')
        .upsert(batch, {
          onConflict: 'period_start,query,asin'
        });

      if (error) {
        results.errors.push({
          batch: `${i}-${i + batch.length}`,
          error: error.message
        });
      } else {
        results.updated += batch.length;
      }
    }

    return results;
  }

  /**
   * Calculate derived metrics from the nested data
   */
  calculateDerivedMetrics(queryData: BigQuerySearchQueryData): {
    asinCTR: number;
    asinCVR: number;
    cartToClickRate: number;
    purchaseToCartRate: number;
    funnelCompletionRate: number;
  } {
    const asinCTR = queryData.impressionData.asinImpressionCount > 0
      ? queryData.clickData.asinClickCount / queryData.impressionData.asinImpressionCount
      : 0;

    const asinCVR = queryData.clickData.asinClickCount > 0
      ? queryData.purchaseData.asinPurchaseCount / queryData.clickData.asinClickCount
      : 0;

    const cartToClickRate = queryData.clickData.asinClickCount > 0
      ? queryData.cartAddData.asinCartAddCount / queryData.clickData.asinClickCount
      : 0;

    const purchaseToCartRate = queryData.cartAddData.asinCartAddCount > 0
      ? queryData.purchaseData.asinPurchaseCount / queryData.cartAddData.asinCartAddCount
      : 0;

    const funnelCompletionRate = queryData.impressionData.asinImpressionCount > 0
      ? queryData.purchaseData.asinPurchaseCount / queryData.impressionData.asinImpressionCount
      : 0;

    return {
      asinCTR,
      asinCVR,
      cartToClickRate,
      purchaseToCartRate,
      funnelCompletionRate
    };
  }

  /**
   * Validate nested data structure
   */
  validateNestedData(data: any): data is BigQueryNestedResponse {
    if (!data || typeof data !== 'object') return false;
    if (!Array.isArray(data.dataByAsin)) return false;

    return data.dataByAsin.every((asinData: any) => {
      if (!asinData.startDate || !asinData.endDate || !asinData.asin) return false;
      if (!Array.isArray(asinData.searchQueryData)) return false;

      return asinData.searchQueryData.every((queryData: any) => {
        return (
          queryData.searchQuery &&
          queryData.impressionData &&
          queryData.clickData &&
          queryData.cartAddData &&
          queryData.purchaseData
        );
      });
    });
  }
}