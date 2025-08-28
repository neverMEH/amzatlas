// BigQuery data types
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

// Supabase table types
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