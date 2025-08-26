// Core SQP data types
export interface SQPRecord {
  query: string;
  asin: string;
  impressions: number;
  clicks: number;
  purchases: number;
  query_date: string;
  updated_at?: string;
  click_share?: number;
  purchase_share?: number;
}

export interface SQPMetrics {
  impressions: number;
  clicks: number;
  purchases: number;
  ctr: number;
  cvr: number;
  purchaseShare: number;
}

// Query types
export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface QueryFilters {
  dateRange?: DateRange;
  asins?: string[];
  keywords?: string[];
  minImpressions?: number;
  minClicks?: number;
  minPurchases?: number;
  maxResults?: number;
}

export interface PaginationOptions {
  limit: number;
  offset?: number;
  cursor?: string;
}

export interface QueryOptions {
  filters?: QueryFilters;
  pagination?: PaginationOptions;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  optimizePartitions?: boolean;
  validateData?: boolean;
  strictValidation?: boolean;
}

// Extraction types
export interface ExtractionResult<T = SQPRecord> {
  data: T[];
  recordCount: number;
  executionTimeMs?: number;
  bytesProcessed?: number;
  validationErrors?: ValidationError[];
  metadata?: Record<string, any>;
}

export interface StreamingOptions {
  onData: (chunk: SQPRecord[]) => void | Promise<void>;
  onProgress?: (progress: ProgressInfo) => void;
  onError?: (error: Error) => void;
  batchSize?: number;
  maxConcurrency?: number;
}

export interface ProgressInfo {
  processed: number;
  total?: number;
  percentage?: number;
  bytesProcessed?: number;
  currentBatch?: number;
}

export interface IncrementalOptions {
  lastProcessedTime?: string;
  column?: string;
  table?: string;
  batchSize?: number;
}

export interface WatermarkOptions {
  table: string;
  watermarkColumn: string;
  lastWatermark: string | number | Date;
}

export interface ExtractionState {
  id: string;
  lastRun?: Date;
  lastWatermark?: string | number;
  recordsProcessed: number;
  status: 'idle' | 'running' | 'completed' | 'failed';
  error?: string;
}

// Validation types
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface ValidationError {
  index?: number;
  record: Partial<SQPRecord>;
  errors: string[];
}

export interface BatchValidationResult {
  valid: boolean;
  validCount: number;
  invalidCount: number;
  errors: ValidationError[];
}

export interface DuplicateCheckResult {
  hasDuplicates: boolean;
  duplicateGroups: Array<{
    key: string;
    indices: number[];
    count: number;
  }>;
}

export interface AnomalyDetectionResult {
  index: number;
  record: SQPRecord;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

export interface CompletenessResult {
  completenessScore: number;
  missingFields: string[];
  recordsWithMissingFields: number;
}

// Query builder types
export interface CompetitiveAnalysisParams {
  keywords: string[];
  compareASINs: string[];
  dateRange?: DateRange;
  metrics?: string[];
}

export interface TrendAnalysisParams {
  metrics: string[];
  granularity: 'daily' | 'weekly' | 'monthly';
  periods: number;
  dateRange?: DateRange;
}

export interface KeywordDiscoveryParams {
  seedKeywords: string[];
  minPurchases: number;
  minCVR: number;
  maxResults?: number;
}

// Configuration types
export interface QueryConfig {
  projectId: string;
  dataset: string;
  tables: {
    sqpRaw: string;
    sqpProcessed: string;
    sqpMetrics: string;
  };
}

export interface ValidatorConfig {
  customRules?: ValidationRule[];
  businessRules?: BusinessRules;
  anomalyThresholds?: AnomalyThresholds;
}

export interface ValidationRule {
  name: string;
  validate: (record: SQPRecord) => string | null;
}

export interface BusinessRules {
  maxCTR?: number;
  maxCVR?: number;
  minQueryLength?: number;
  requiredFields?: string[];
}

export interface AnomalyThresholds {
  impressionSpike?: number;
  clickSpike?: number;
  purchaseSpike?: number;
  ctrDeviation?: number;
}

// Result types for complex queries
export interface CompetitiveAnalysisResult {
  keyword: string;
  asin: string;
  marketShare: number;
  relativePerformance: number;
  rank: number;
  metrics: SQPMetrics;
}

export interface TrendAnalysisResult {
  date: string;
  metric: string;
  value: number;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  movingAverage?: number;
  standardDeviation?: number;
}

export interface KeywordDiscoveryResult {
  keyword: string;
  relevanceScore: number;
  metrics: SQPMetrics;
  relatedKeywords?: string[];
}

// Error types
export interface QueryError extends Error {
  code?: string;
  details?: {
    query?: string;
    parameters?: Record<string, any>;
    line?: number;
    column?: number;
  };
}