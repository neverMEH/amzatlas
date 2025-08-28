import { getSupabaseClient } from '@/config/supabase.config';
import { 
  SupabaseASINPerformance, 
  SupabaseSearchQueryPerformance 
} from '@/lib/supabase/sync/types';

export interface SearchPerformanceMetrics {
  asin: string;
  searchQuery: string;
  searchQueryScore?: number;
  searchQueryVolume?: number;
  impressions: number;
  clicks: number;
  cartAdds: number;
  purchases: number;
  impressionShare: number;
  clickShare: number;
  cartAddShare: number;
  purchaseShare: number;
  ctr: number;
  cartAddRate: number;
  conversionRate: number;
  funnelCompletionRate: number;
  asinMedianPurchasePrice?: number;
  totalMedianPurchasePrice?: number;
}

export interface MarketShareData {
  asin: string;
  searchQuery: string;
  totalMarketPurchases: number;
  asinPurchases: number;
  marketShare: number;
  rank: number;
  trend?: number; // Week over week change
}

export interface FunnelAnalysis {
  asin: string;
  searchQuery: string;
  impressions: number;
  clicks: number;
  cartAdds: number;
  purchases: number;
  impressionToClickRate: number;
  clickToCartRate: number;
  cartToPurchaseRate: number;
  overallConversionRate: number;
}

export interface PriceAnalysis {
  asin: string;
  searchQuery: string;
  medianClickPrice?: number;
  medianCartAddPrice?: number;
  medianPurchasePrice?: number;
  marketMedianPrice?: number;
  priceCompetitiveness?: number; // ASIN price vs market median
}

export interface ShippingPreferences {
  sameDayRatio: number;
  oneDayRatio: number;
  twoDayRatio: number;
  totalCount: number;
}

export class SQPNestedService {
  private supabase = getSupabaseClient();

  /**
   * Get search performance metrics for date range
   */
  async getSearchPerformanceMetrics(
    startDate: string,
    endDate: string,
    filters?: {
      asins?: string[];
      searchQueries?: string[];
      minVolume?: number;
      limit?: number;
    }
  ): Promise<SearchPerformanceMetrics[]> {
    let query = this.supabase
      .from('search_performance_summary')
      .select('*')
      .gte('start_date', startDate)
      .lte('end_date', endDate);

    if (filters?.asins?.length) {
      query = query.in('asin', filters.asins);
    }

    if (filters?.searchQueries?.length) {
      query = query.in('search_query', filters.searchQueries);
    }

    if (filters?.minVolume) {
      query = query.gte('search_query_volume', filters.minVolume);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query
      .order('asin_purchase_share', { ascending: false })
      .order('search_query_volume', { ascending: false });

    if (error) {
      console.error('Error fetching search performance:', error);
      throw error;
    }

    // Transform to metrics format
    return (data || []).map(row => ({
      asin: row.asin,
      searchQuery: row.search_query,
      searchQueryScore: row.search_query_score,
      searchQueryVolume: row.search_query_volume,
      impressions: row.asin_impression_count,
      clicks: row.asin_click_count,
      cartAdds: row.asin_cart_add_count,
      purchases: row.asin_purchase_count,
      impressionShare: row.asin_impression_share,
      clickShare: row.asin_click_share,
      cartAddShare: row.asin_cart_add_share,
      purchaseShare: row.asin_purchase_share,
      ctr: row.asin_click_rate || 0,
      cartAddRate: row.asin_cart_add_rate || 0,
      conversionRate: row.asin_purchase_conversion_rate || 0,
      funnelCompletionRate: row.asin_impression_count > 0 
        ? row.asin_purchase_count / row.asin_impression_count 
        : 0,
      asinMedianPurchasePrice: row.asin_median_purchase_price,
      totalMedianPurchasePrice: row.total_median_purchase_price,
    }));
  }

  /**
   * Get market share data by search query
   */
  async getMarketShareByQuery(
    searchQuery: string,
    startDate: string,
    endDate: string,
    limit: number = 10
  ): Promise<MarketShareData[]> {
    const { data, error } = await this.supabase
      .from('search_performance_summary')
      .select('*')
      .eq('search_query', searchQuery)
      .gte('start_date', startDate)
      .lte('end_date', endDate)
      .order('asin_purchase_share', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching market share:', error);
      throw error;
    }

    // Calculate ranks and format response
    return (data || []).map((row, index) => ({
      asin: row.asin,
      searchQuery: row.search_query,
      totalMarketPurchases: row.total_purchase_count,
      asinPurchases: row.asin_purchase_count,
      marketShare: row.asin_purchase_share * 100,
      rank: index + 1,
    }));
  }

  /**
   * Get funnel analysis for ASINs
   */
  async getFunnelAnalysis(
    asins: string[],
    startDate: string,
    endDate: string
  ): Promise<FunnelAnalysis[]> {
    const { data, error } = await this.supabase
      .from('search_performance_summary')
      .select('*')
      .in('asin', asins)
      .gte('start_date', startDate)
      .lte('end_date', endDate)
      .order('search_query_volume', { ascending: false });

    if (error) {
      console.error('Error fetching funnel data:', error);
      throw error;
    }

    return (data || []).map(row => {
      const impressions = row.asin_impression_count || 0;
      const clicks = row.asin_click_count || 0;
      const cartAdds = row.asin_cart_add_count || 0;
      const purchases = row.asin_purchase_count || 0;

      return {
        asin: row.asin,
        searchQuery: row.search_query,
        impressions,
        clicks,
        cartAdds,
        purchases,
        impressionToClickRate: impressions > 0 ? clicks / impressions : 0,
        clickToCartRate: clicks > 0 ? cartAdds / clicks : 0,
        cartToPurchaseRate: cartAdds > 0 ? purchases / cartAdds : 0,
        overallConversionRate: impressions > 0 ? purchases / impressions : 0,
      };
    });
  }

  /**
   * Get price analysis comparing ASIN prices to market
   */
  async getPriceAnalysis(
    asins: string[],
    startDate: string,
    endDate: string
  ): Promise<PriceAnalysis[]> {
    const { data, error } = await this.supabase
      .from('search_performance_summary')
      .select('*')
      .in('asin', asins)
      .gte('start_date', startDate)
      .lte('end_date', endDate)
      .not('asin_median_purchase_price', 'is', null);

    if (error) {
      console.error('Error fetching price data:', error);
      throw error;
    }

    return (data || []).map(row => ({
      asin: row.asin,
      searchQuery: row.search_query,
      medianClickPrice: row.asin_median_click_price,
      medianCartAddPrice: row.asin_median_cart_add_price,
      medianPurchasePrice: row.asin_median_purchase_price,
      marketMedianPrice: row.total_median_purchase_price,
      priceCompetitiveness: row.total_median_purchase_price && row.asin_median_purchase_price
        ? ((row.total_median_purchase_price - row.asin_median_purchase_price) / 
           row.total_median_purchase_price) * 100
        : undefined,
    }));
  }

  /**
   * Get shipping preferences analysis
   */
  async getShippingPreferences(
    startDate: string,
    endDate: string,
    metric: 'click' | 'cart_add' | 'purchase' = 'purchase'
  ): Promise<ShippingPreferences> {
    const { data, error } = await this.supabase
      .from('search_query_performance')
      .select(`
        total_same_day_shipping_${metric}_count,
        total_one_day_shipping_${metric}_count,
        total_two_day_shipping_${metric}_count
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) {
      console.error('Error fetching shipping preferences:', error);
      throw error;
    }

    // Aggregate shipping counts
    const totals = (data || []).reduce((acc, row) => {
      acc.sameDay += row[`total_same_day_shipping_${metric}_count`] || 0;
      acc.oneDay += row[`total_one_day_shipping_${metric}_count`] || 0;
      acc.twoDay += row[`total_two_day_shipping_${metric}_count`] || 0;
      return acc;
    }, { sameDay: 0, oneDay: 0, twoDay: 0 });

    const totalCount = totals.sameDay + totals.oneDay + totals.twoDay;

    return {
      sameDayRatio: totalCount > 0 ? totals.sameDay / totalCount : 0,
      oneDayRatio: totalCount > 0 ? totals.oneDay / totalCount : 0,
      twoDayRatio: totalCount > 0 ? totals.twoDay / totalCount : 0,
      totalCount,
    };
  }

  /**
   * Get top performing queries by various metrics
   */
  async getTopQueries(
    metric: 'volume' | 'purchases' | 'conversion_rate' | 'market_share',
    startDate: string,
    endDate: string,
    limit: number = 20
  ): Promise<Array<{
    searchQuery: string;
    value: number;
    totalImpressions: number;
    totalPurchases: number;
  }>> {
    let orderColumn: string;
    let orderDirection: 'asc' | 'desc' = 'desc';

    switch (metric) {
      case 'volume':
        orderColumn = 'search_query_volume';
        break;
      case 'purchases':
        orderColumn = 'total_purchase_count';
        break;
      case 'conversion_rate':
        orderColumn = 'total_purchase_rate';
        break;
      case 'market_share':
        orderColumn = 'asin_purchase_share';
        break;
      default:
        orderColumn = 'search_query_volume';
    }

    const { data, error } = await this.supabase
      .from('search_performance_summary')
      .select(`
        search_query,
        search_query_volume,
        total_query_impression_count,
        total_purchase_count,
        total_purchase_rate,
        asin_purchase_share
      `)
      .gte('start_date', startDate)
      .lte('end_date', endDate)
      .order(orderColumn, { ascending: orderDirection === 'asc' })
      .limit(limit);

    if (error) {
      console.error('Error fetching top queries:', error);
      throw error;
    }

    // Group by search query and aggregate
    const queryMap = new Map<string, any>();
    
    (data || []).forEach(row => {
      const existing = queryMap.get(row.search_query) || {
        totalImpressions: 0,
        totalPurchases: 0,
        maxShare: 0,
        volume: row.search_query_volume || 0,
      };
      
      existing.totalImpressions = Math.max(existing.totalImpressions, row.total_query_impression_count || 0);
      existing.totalPurchases = Math.max(existing.totalPurchases, row.total_purchase_count || 0);
      existing.maxShare = Math.max(existing.maxShare, row.asin_purchase_share || 0);
      
      queryMap.set(row.search_query, existing);
    });

    return Array.from(queryMap.entries())
      .map(([searchQuery, stats]) => {
        let value: number;
        switch (metric) {
          case 'volume':
            value = stats.volume;
            break;
          case 'purchases':
            value = stats.totalPurchases;
            break;
          case 'conversion_rate':
            value = stats.totalImpressions > 0 
              ? (stats.totalPurchases / stats.totalImpressions) * 100 
              : 0;
            break;
          case 'market_share':
            value = stats.maxShare * 100;
            break;
          default:
            value = 0;
        }

        return {
          searchQuery,
          value,
          totalImpressions: stats.totalImpressions,
          totalPurchases: stats.totalPurchases,
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }
}