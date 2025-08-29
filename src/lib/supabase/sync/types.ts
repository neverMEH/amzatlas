// BigQuery data types - Legacy flat structure (deprecated)
export interface BigQuerySQPData {
  search_query: string;
  asin: string;
  product_name?: string;
  date: string | { value: string } | Date;
  impressions: number | null;
  clicks: number | null;
  purchases: number | null;
  ctr?: number | null;
  cvr?: number | null;
  marketplace?: string;
  category?: string;
  // Additional fields that might come from BigQuery
  impression_rank?: number;
  click_rank?: number;
  purchase_rank?: number;
}

// New BigQuery nested structure
export interface BigQueryNestedResponse {
  dataByAsin: BigQueryASINData[];
}

export interface BigQueryASINData {
  startDate: string;
  endDate: string;
  asin: string;
  productName?: string;
  clientName?: string;
  searchQueryData: BigQuerySearchQueryData[];
}

export interface BigQuerySearchQueryData {
  searchQuery: string;
  searchQueryScore?: number;
  searchQueryVolume?: number;
  impressionData: {
    totalQueryImpressionCount: number;
    asinImpressionCount: number;
    asinImpressionShare: number;
  };
  clickData: {
    totalClickCount: number;
    totalClickRate: number;
    asinClickCount: number;
    asinClickShare: number;
    totalMedianClickPrice?: number;
    asinMedianClickPrice?: number;
    totalSameDayShippingClickCount?: number;
    totalOneDayShippingClickCount?: number;
    totalTwoDayShippingClickCount?: number;
  };
  cartAddData: {
    totalCartAddCount: number;
    totalCartAddRate: number;
    asinCartAddCount: number;
    asinCartAddShare: number;
    totalMedianCartAddPrice?: number;
    asinMedianCartAddPrice?: number;
    totalSameDayShippingCartAddCount?: number;
    totalOneDayShippingCartAddCount?: number;
    totalTwoDayShippingCartAddCount?: number;
  };
  purchaseData: {
    totalPurchaseCount: number;
    totalPurchaseRate: number;
    asinPurchaseCount: number;
    asinPurchaseShare: number;
    totalMedianPurchasePrice?: number;
    asinMedianPurchasePrice?: number;
    totalSameDayShippingPurchaseCount?: number;
    totalOneDayShippingPurchaseCount?: number;
    totalTwoDayShippingPurchaseCount?: number;
  };
}

// Supabase table types
export interface SupabaseASINPerformance {
  id?: number;
  start_date: string;
  end_date: string;
  asin: string;
  product_title?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseSearchQueryPerformance {
  id?: number;
  asin_performance_id: number;
  search_query: string;
  search_query_score?: number;
  search_query_volume?: number;
  
  // Impression metrics
  total_query_impression_count: number;
  asin_impression_count: number;
  asin_impression_share: number;
  
  // Click metrics
  total_click_count: number;
  total_click_rate: number;
  asin_click_count: number;
  asin_click_share: number;
  total_median_click_price?: number;
  asin_median_click_price?: number;
  total_same_day_shipping_click_count?: number;
  total_one_day_shipping_click_count?: number;
  total_two_day_shipping_click_count?: number;
  
  // Cart add metrics
  total_cart_add_count: number;
  total_cart_add_rate: number;
  asin_cart_add_count: number;
  asin_cart_add_share: number;
  total_median_cart_add_price?: number;
  asin_median_cart_add_price?: number;
  total_same_day_shipping_cart_add_count?: number;
  total_one_day_shipping_cart_add_count?: number;
  total_two_day_shipping_cart_add_count?: number;
  
  // Purchase metrics
  total_purchase_count: number;
  total_purchase_rate: number;
  asin_purchase_count: number;
  asin_purchase_share: number;
  total_median_purchase_price?: number;
  asin_median_purchase_price?: number;
  total_same_day_shipping_purchase_count?: number;
  total_one_day_shipping_purchase_count?: number;
  total_two_day_shipping_purchase_count?: number;
  
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseWeeklySummary {
  id?: number;
  period_start: string;
  period_end: string;
  query: string;
  asin: string;
  total_impressions: number;
  total_clicks: number;
  total_purchases: number;
  avg_ctr: number;
  avg_cvr: number;
  purchases_per_impression: number;
  impression_share: number;
  click_share: number;
  purchase_share: number;
  min_impressions?: number;
  max_impressions?: number;
  avg_impressions?: number;
  stddev_impressions?: number;
  
  // New fields from BigQuery schema
  search_query_score?: number;
  search_query_volume?: number;
  total_query_impression_count?: number;
  total_click_count?: number;
  total_cart_add_count?: number;
  total_purchase_count?: number;
  total_median_click_price?: number;
  asin_median_click_price?: number;
  total_median_cart_add_price?: number;
  asin_median_cart_add_price?: number;
  total_median_purchase_price?: number;
  asin_median_purchase_price?: number;
  cart_adds?: number;
  cart_add_rate?: number;
  cart_add_share?: number;
  
  created_at?: string;
  updated_at?: string;
  bigquery_sync_id?: string;
  sync_log_id?: number;
  last_synced_at?: string;
}

export interface SupabaseMonthlySummary {
  id?: number;
  period_start: string;
  period_end: string;
  year: number;
  month: number;
  query: string;
  asin: string;
  total_impressions: number;
  total_clicks: number;
  total_purchases: number;
  avg_ctr: number;
  avg_cvr: number;
  purchases_per_impression: number;
  impression_share: number;
  click_share: number;
  purchase_share: number;
  active_weeks: number;
  created_at?: string;
  updated_at?: string;
}

// Sync log types
export interface SyncLogEntry {
  id?: number;
  sync_type: 'weekly' | 'monthly' | 'quarterly';
  sync_status: 'started' | 'completed' | 'failed';
  started_at?: Date;
  completed_at?: Date;
  source_table: string;
  target_table: string;
  period_start?: Date;
  period_end?: Date;
  records_processed?: number;
  records_inserted?: number;
  records_updated?: number;
  records_failed?: number;
  error_message?: string;
  error_details?: any;
  sync_metadata?: any;
  created_at?: Date;
}

export interface DataQualityCheck {
  id?: number;
  sync_log_id?: number;
  check_type: 'row_count' | 'sum_validation' | 'null_check' | 'duplicate_check';
  check_status: 'passed' | 'failed' | 'warning';
  source_value?: number;
  target_value?: number;
  difference?: number;
  difference_pct?: number;
  table_name?: string;
  column_name?: string;
  check_query?: string;
  check_message?: string;
  check_metadata?: any;
  created_at?: Date;
}

// Transformation options
export interface TransformOptions {
  periodStart: string;
  periodEnd: string;
  calculateShares?: boolean;
  validateData?: boolean;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

// Sync-related types
export interface DateRange {
  start: Date;
  end: Date;
}

export interface WeekBoundaries {
  periodStart: string;
  periodEnd: string;
}

export interface StatisticalMetrics {
  min: number;
  max: number;
  avg: number;
  stddev: number;
}

export interface ShareMetrics {
  impression_share: number;
  click_share: number;
  purchase_share: number;
}

export interface ErrorDetail {
  record?: any;
  error: string;
  timestamp: Date;
  field?: string;
}

export interface PerformanceMetrics {
  records_per_second: number;
  memory_used_mb: number;
  cpu_percentage?: number;
  api_calls?: number;
  duration_seconds?: number;
}

export interface SyncMetrics {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  averageDuration: number; // seconds
  totalRecordsProcessed: number;
  successRate?: number;
  errorRate?: number;
}

export interface AlertConfig {
  consecutiveFailureThreshold: number;
  longRunningSyncThresholdMinutes: number;
  dataQualityThresholds: {
    rowCountDifferencePercent: number;
    sumValidationDifferencePercent: number;
    nullCountThreshold: number;
  };
}

export interface Alert {
  alert: boolean;
  reason: string;
  details?: any;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  timestamp?: Date;
}