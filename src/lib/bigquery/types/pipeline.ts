export type PipelineStatus = 'idle' | 'locked' | 'running' | 'completed' | 'failed' | 'cancelled';
export type StepType = 'extract' | 'transform' | 'load' | 'custom';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType = 'error_rate' | 'execution_time' | 'data_freshness' | 'memory_usage' | 'queue_depth' | 'custom';
export type LogLevel = 'debug' | 'info' | 'warning' | 'error';

export interface PipelineConfig {
  name: string;
  schedule: string; // Cron expression
  maxRetries: number;
  retryDelayMs: number;
  steps: PipelineStep[];
  monitoring?: {
    enableAlerts: boolean;
    alertThresholds?: AlertThresholds;
  };
}

export interface PipelineStep {
  name: string;
  type: StepType;
  config: Record<string, any>;
  dependencies?: string[];
  timeout?: number;
  retryable?: boolean;
}

export interface PipelineState {
  pipelineId: string;
  status: PipelineStatus;
  lastRunTime: Date | null;
  lastSuccessTime: Date | null;
  currentStep: string | null;
  stepData: Record<string, any>;
  metadata: Record<string, any>;
}

export interface PipelineResult {
  success: boolean;
  runId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  stepsCompleted: number;
  totalSteps: number;
  error?: string;
  warnings?: Warning[];
  alerts?: Alert[];
  metrics?: PipelineMetrics;
}

export interface StepResult {
  stepName: string;
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number;
  recordsProcessed?: number;
  error?: string;
  data?: any;
}

export interface PipelineMetrics {
  pipelineId: string;
  runId: string;
  status: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  steps: Record<string, StepMetrics>;
  totalRecordsProcessed?: number;
  error?: string;
}

export interface StepMetrics {
  duration: number;
  recordsProcessed: number;
  success: boolean;
  error?: string;
}

export interface Alert {
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface Warning {
  type: string;
  message: string;
  timestamp?: Date;
}

export interface AlertThresholds {
  errorRate: number; // Percentage as decimal (0.05 = 5%)
  executionTime: number; // Milliseconds
  dataFreshness: number; // Milliseconds since last update
  memoryUsage?: number; // Bytes
  queueDepth?: number; // Number of items
}

export interface MonitorConfig {
  pipelineId: string;
  enableCloudLogging: boolean;
  enableMetrics: boolean;
  enableAlerts: boolean;
  alertThresholds: AlertThresholds;
  alertChannels: string[];
  logLevel: LogLevel;
}

export interface StateTransition {
  id?: number;
  pipelineId: string;
  fromStatus: PipelineStatus;
  toStatus: PipelineStatus;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface RecoveryPoint {
  canRecover: boolean;
  lastCompletedStep: string | null;
  nextStep: string | null;
  stepData: Record<string, any>;
}

export interface DashboardMetrics {
  currentStatus: string;
  uptime: number;
  totalRuns: number;
  successRate: number;
  averageExecutionTime: number;
  recentErrors: any[];
  activeAlerts: Alert[];
  dataFreshness: Date;
}

export interface ResourceMetrics {
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  cpu?: {
    user: number;
    system: number;
  };
}

export interface PerformanceAnalysis {
  isAnomalous: boolean;
  deviationFromBaseline: number;
  recommendation?: string;
}

export interface ExportOptions {
  format: 'json' | 'csv';
  includeRawData: boolean;
  startDate?: Date;
  endDate?: Date;
}

export type AlertChannel = (alert: Alert) => Promise<void>;