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

// Transformation types
export interface TransformationOptions {
  includeShareMetrics?: boolean;
  includeRanking?: boolean;
  movingAveragePeriod?: number;
  customAggregations?: Record<string, (records: any[]) => any>;
  batchSize?: number;
  continueOnError?: boolean;
}

export interface AggregatedMetrics extends SQPMetrics {
  date: string;
  period?: PeriodType;
  periodStart?: string;
  periodEnd?: string;
  query: string;
  asin: string;
  totalImpressions: number;
  totalClicks: number;
  totalPurchases: number;
  avgCTR: number;
  avgCVR: number;
  purchasesPerImpression: number;
  impressionShare?: number;
  clickShare?: number;
  purchaseShare?: number;
}

export interface WeeklyTrend {
  week: string;
  impressions: number;
  clicks: number;
  purchases: number;
  impressionsWoW: number;
  impressionsWoWPercent: number;
  clicksWoW: number;
  clicksWoWPercent: number;
  purchasesWoW: number;
  purchasesWoWPercent: number;
  trend: 'growing' | 'declining' | 'stable';
  purchasesMA?: number;
  ctrMA?: number;
  cvrMA?: number;
}

export interface KeywordPerformanceScore {
  query: string;
  performanceScore: number;
  tier: 'A' | 'B' | 'C' | 'D';
  rank?: number;
  components: {
    volumeScore: number;
    efficiencyScore: number;
    valueScore: number;
    consistencyScore: number;
  };
  metrics: {
    ctr: number;
    cvr: number;
    aov: number;
    rpi: number; // Revenue per impression
  };
}

export interface MarketShareData {
  [keyword: string]: {
    totalMarket: number;
    competitors: number;
    shares: {
      [asin: string]: {
        purchases: number;
        share: number;
        rank: number;
      };
    };
  };
}

export interface MarketOpportunity {
  keyword: string;
  marketSize: number;
  currentShare: number;
  growthRate: number;
  competitorCount: number;
  opportunityScore: number;
  estimatedPotential: number;
}

export interface DerivedMetrics {
  ctr: number;
  cvr: number;
  purchasesPerThousandImpressions: number;
  clicksPerPurchase: number;
  impressionsPerPurchase: number;
  qualityScore: number;
}

export interface AdvancedMetrics extends DerivedMetrics {
  roas: number; // Return on ad spend
  acos: number; // Advertising cost of sale
  profitMargin: number;
  ltv: number; // Lifetime value
  cac: number; // Customer acquisition cost
}

export interface DataQualityReport {
  missingDates: string[];
  anomalies: AnomalyDetectionResult[];
  inconsistencies: Array<{
    date: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  qualityScore: number;
  coverageScore: number;
}

export interface BatchProcessResult {
  batchesProcessed: number;
  totalRecords: number;
  successfulBatches: number;
  errors: Array<{
    batch: number;
    error: string;
    recordsAffected: number;
  }>;
}

export interface AggregationConfig {
  dimensions: string[];
  metrics: string[];
  includeStats?: boolean;
  customAggregations?: Record<string, (records: any[]) => any>;
}

// Period types
export type PeriodType = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface PeriodComparison {
  period: PeriodType;
  currentPeriod: string;
  previousPeriod: string;
  query: string;
  asin: string;
  currentMetrics: {
    impressions: number;
    clicks: number;
    purchases: number;
    ctr: number;
    cvr: number;
  };
  previousMetrics: {
    impressions: number;
    clicks: number;
    purchases: number;
    ctr: number;
    cvr: number;
  };
  changes: {
    impressions: number;
    impressionsPercent: number;
    clicks: number;
    clicksPercent: number;
    purchases: number;
    purchasesPercent: number;
    ctr: number;
    cvr: number;
  };
}