// BigQuery Schema Types - Matching the actual BigQuery structure

export interface BigQuerySQPResponse {
  dataByAsin: ASINPerformanceData[];
}

export interface ASINPerformanceData {
  startDate: string;
  endDate: string;
  asin: string;
  searchQueryData: SearchQueryData[];
}

export interface SearchQueryData {
  searchQuery: string;
  searchQueryScore?: number;
  searchQueryVolume?: number;
  impressionData: ImpressionData;
  clickData: ClickData;
  cartAddData: CartAddData;
  purchaseData: PurchaseData;
}

export interface ImpressionData {
  totalQueryImpressionCount: number;
  asinImpressionCount: number;
  asinImpressionShare: number;
}

export interface ClickData {
  totalClickCount: number;
  totalClickRate: number;
  asinClickCount: number;
  asinClickShare: number;
  totalMedianClickPrice?: number;
  asinMedianClickPrice?: number;
  totalSameDayShippingClickCount?: number;
  totalOneDayShippingClickCount?: number;
  totalTwoDayShippingClickCount?: number;
}

export interface CartAddData {
  totalCartAddCount: number;
  totalCartAddRate: number;
  asinCartAddCount: number;
  asinCartAddShare: number;
  totalMedianCartAddPrice?: number;
  asinMedianCartAddPrice?: number;
  totalSameDayShippingCartAddCount?: number;
  totalOneDayShippingCartAddCount?: number;
  totalTwoDayShippingCartAddCount?: number;
}

export interface PurchaseData {
  totalPurchaseCount: number;
  totalPurchaseRate: number;
  asinPurchaseCount: number;
  asinPurchaseShare: number;
  totalMedianPurchasePrice?: number;
  asinMedianPurchasePrice?: number;
  totalSameDayShippingPurchaseCount?: number;
  totalOneDayShippingPurchaseCount?: number;
  totalTwoDayShippingPurchaseCount?: number;
}

// Flattened types for easier processing
export interface FlattenedSQPRecord {
  startDate: string;
  endDate: string;
  asin: string;
  searchQuery: string;
  searchQueryScore?: number;
  searchQueryVolume?: number;
  
  // Impression metrics
  totalQueryImpressionCount: number;
  asinImpressionCount: number;
  asinImpressionShare: number;
  
  // Click metrics
  totalClickCount: number;
  totalClickRate: number;
  asinClickCount: number;
  asinClickShare: number;
  asinClickRate?: number; // Calculated
  totalMedianClickPrice?: number;
  asinMedianClickPrice?: number;
  
  // Cart add metrics
  totalCartAddCount: number;
  totalCartAddRate: number;
  asinCartAddCount: number;
  asinCartAddShare: number;
  asinCartAddRate?: number; // Calculated
  totalMedianCartAddPrice?: number;
  asinMedianCartAddPrice?: number;
  
  // Purchase metrics
  totalPurchaseCount: number;
  totalPurchaseRate: number;
  asinPurchaseCount: number;
  asinPurchaseShare: number;
  asinPurchaseRate?: number; // Calculated
  totalMedianPurchasePrice?: number;
  asinMedianPurchasePrice?: number;
  
  // Shipping preferences
  totalSameDayShippingClickCount?: number;
  totalOneDayShippingClickCount?: number;
  totalTwoDayShippingClickCount?: number;
  totalSameDayShippingCartAddCount?: number;
  totalOneDayShippingCartAddCount?: number;
  totalTwoDayShippingCartAddCount?: number;
  totalSameDayShippingPurchaseCount?: number;
  totalOneDayShippingPurchaseCount?: number;
  totalTwoDayShippingPurchaseCount?: number;
}

// Helper type for query options when fetching from BigQuery
export interface BigQuerySQPQueryOptions {
  dataset: string;
  table: string;
  startDate: string;
  endDate: string;
  asins?: string[];
  reportingPeriod?: 'WEEK' | 'MONTH' | 'QUARTER';
  limit?: number;
}

// Type guards
export function isBigQuerySQPResponse(data: any): data is BigQuerySQPResponse {
  return data && Array.isArray(data.dataByAsin);
}

export function hasSearchQueryData(data: any): data is ASINPerformanceData {
  return data && Array.isArray(data.searchQueryData);
}

// Utility function to flatten the nested structure
export function flattenBigQueryResponse(response: BigQuerySQPResponse): FlattenedSQPRecord[] {
  const flattened: FlattenedSQPRecord[] = [];
  
  for (const asinData of response.dataByAsin) {
    for (const queryData of asinData.searchQueryData) {
      const record: FlattenedSQPRecord = {
        startDate: asinData.startDate,
        endDate: asinData.endDate,
        asin: asinData.asin,
        searchQuery: queryData.searchQuery,
        searchQueryScore: queryData.searchQueryScore,
        searchQueryVolume: queryData.searchQueryVolume,
        
        // Impression data
        totalQueryImpressionCount: queryData.impressionData.totalQueryImpressionCount,
        asinImpressionCount: queryData.impressionData.asinImpressionCount,
        asinImpressionShare: queryData.impressionData.asinImpressionShare,
        
        // Click data
        totalClickCount: queryData.clickData.totalClickCount,
        totalClickRate: queryData.clickData.totalClickRate,
        asinClickCount: queryData.clickData.asinClickCount,
        asinClickShare: queryData.clickData.asinClickShare,
        totalMedianClickPrice: queryData.clickData.totalMedianClickPrice,
        asinMedianClickPrice: queryData.clickData.asinMedianClickPrice,
        
        // Cart add data
        totalCartAddCount: queryData.cartAddData.totalCartAddCount,
        totalCartAddRate: queryData.cartAddData.totalCartAddRate,
        asinCartAddCount: queryData.cartAddData.asinCartAddCount,
        asinCartAddShare: queryData.cartAddData.asinCartAddShare,
        totalMedianCartAddPrice: queryData.cartAddData.totalMedianCartAddPrice,
        asinMedianCartAddPrice: queryData.cartAddData.asinMedianCartAddPrice,
        
        // Purchase data
        totalPurchaseCount: queryData.purchaseData.totalPurchaseCount,
        totalPurchaseRate: queryData.purchaseData.totalPurchaseRate,
        asinPurchaseCount: queryData.purchaseData.asinPurchaseCount,
        asinPurchaseShare: queryData.purchaseData.asinPurchaseShare,
        totalMedianPurchasePrice: queryData.purchaseData.totalMedianPurchasePrice,
        asinMedianPurchasePrice: queryData.purchaseData.asinMedianPurchasePrice,
        
        // Shipping data
        totalSameDayShippingClickCount: queryData.clickData.totalSameDayShippingClickCount,
        totalOneDayShippingClickCount: queryData.clickData.totalOneDayShippingClickCount,
        totalTwoDayShippingClickCount: queryData.clickData.totalTwoDayShippingClickCount,
        totalSameDayShippingCartAddCount: queryData.cartAddData.totalSameDayShippingCartAddCount,
        totalOneDayShippingCartAddCount: queryData.cartAddData.totalOneDayShippingCartAddCount,
        totalTwoDayShippingCartAddCount: queryData.cartAddData.totalTwoDayShippingCartAddCount,
        totalSameDayShippingPurchaseCount: queryData.purchaseData.totalSameDayShippingPurchaseCount,
        totalOneDayShippingPurchaseCount: queryData.purchaseData.totalOneDayShippingPurchaseCount,
        totalTwoDayShippingPurchaseCount: queryData.purchaseData.totalTwoDayShippingPurchaseCount,
      };
      
      // Calculate ASIN-specific rates
      if (record.asinImpressionCount > 0) {
        record.asinClickRate = record.asinClickCount / record.asinImpressionCount;
      }
      if (record.asinClickCount > 0) {
        record.asinCartAddRate = record.asinCartAddCount / record.asinClickCount;
      }
      if (record.asinCartAddCount > 0) {
        record.asinPurchaseRate = record.asinPurchaseCount / record.asinCartAddCount;
      }
      
      flattened.push(record);
    }
  }
  
  return flattened;
}