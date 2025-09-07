import { Logging } from '@google-cloud/logging';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  MonitorConfig, 
  PipelineMetrics, 
  Alert, 
  AlertType,
  LogLevel,
  StepMetrics,
  DashboardMetrics,
  ResourceMetrics,
  PerformanceAnalysis,
  ExportOptions,
  AlertChannel
} from './types/pipeline';
import { randomUUID } from 'crypto';

export class PipelineMonitor {
  private config: MonitorConfig;
  private cloudLogging: Logging | null = null;
  private supabase: SupabaseClient;
  private currentRunId: string | null = null;
  private currentMetrics: PipelineMetrics | null = null;
  private alertChannels: Map<string, AlertChannel> = new Map();
  private logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warning: 2,
    error: 3
  };

  constructor(config: MonitorConfig) {
    this.config = config;

    // Initialize Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize Google Cloud Logging if enabled
    if (config.enableCloudLogging) {
      try {
        this.cloudLogging = new Logging();
      } catch (error) {
        console.warn('Failed to initialize Google Cloud Logging:', error);
      }
    }

    // Register default alert channels
    this.registerDefaultAlertChannels();
  }

  async startPipeline(): Promise<string> {
    const runId = randomUUID();
    this.currentRunId = runId;
    
    this.currentMetrics = {
      pipelineId: this.config.pipelineId,
      runId,
      status: 'running',
      startTime: new Date(),
      steps: {}
    };

    await this.persistMetrics();
    await this.log('info', 'Pipeline started', { runId });

    return runId;
  }

  async endPipeline(status: 'success' | 'failed', error?: string): Promise<void> {
    if (!this.currentMetrics) {
      return;
    }

    this.currentMetrics.status = status === 'success' ? 'completed' : 'failed';
    this.currentMetrics.endTime = new Date();
    this.currentMetrics.duration = 
      this.currentMetrics.endTime.getTime() - this.currentMetrics.startTime.getTime();
    
    if (error) {
      this.currentMetrics.error = error;
    }

    // Calculate total records processed
    this.currentMetrics.totalRecordsProcessed = Object.values(this.currentMetrics.steps)
      .reduce((sum, step) => sum + (step.recordsProcessed || 0), 0);

    await this.persistMetrics();
    await this.log('info', `Pipeline ${status}`, { 
      runId: this.currentRunId, 
      duration: this.currentMetrics.duration,
      error 
    });

    this.currentRunId = null;
  }

  async recordStepMetrics(stepName: string, metrics: StepMetrics): Promise<void> {
    if (!this.currentMetrics) {
      return;
    }

    this.currentMetrics.steps[stepName] = metrics;
    await this.persistMetrics();

    await this.log('info', `Step ${stepName} completed`, {
      stepName,
      duration: metrics.duration,
      recordsProcessed: metrics.recordsProcessed,
      success: metrics.success
    });
  }

  async recordError(error: {
    step: string;
    error: Error;
    context?: any;
  }): Promise<void> {
    const errorData = {
      timestamp: new Date(),
      runId: this.currentRunId,
      step: error.step,
      error: error.error.message,
      stack: error.error.stack,
      context: error.context
    };

    try {
      await this.supabase
        .from('pipeline_errors')
        .insert({
          pipeline_id: this.config.pipelineId,
          run_id: this.currentRunId,
          step: error.step,
          error: error.error.message,
          stack: error.error.stack,
          context: error.context,
          timestamp: errorData.timestamp.toISOString()
        });
    } catch (err) {
      console.error('Failed to record error:', err);
    }

    await this.log('error', `Error in step ${error.step}`, errorData);
  }

  async checkAlerts(): Promise<Alert[]> {
    const alerts: Alert[] = [];

    if (!this.config.enableAlerts) {
      return alerts;
    }

    // Check error rate
    const errorRate = await this.getErrorRate();
    if (errorRate > this.config.alertThresholds.errorRate) {
      alerts.push({
        type: 'error_rate',
        severity: 'critical',
        message: `Error rate (${(errorRate * 100).toFixed(2)}%) exceeds threshold (${(this.config.alertThresholds.errorRate * 100).toFixed(2)}%)`,
        timestamp: new Date(),
        metadata: { errorRate }
      });
    }

    // Check execution time
    if (this.currentMetrics && !this.currentMetrics.endTime) {
      const executionTime = Date.now() - this.currentMetrics.startTime.getTime();
      if (executionTime > this.config.alertThresholds.executionTime) {
        alerts.push({
          type: 'execution_time',
          severity: 'warning',
          message: `Execution time exceeded threshold (${Math.round(executionTime / 60000)} minutes)`,
          timestamp: new Date(),
          metadata: { executionTime }
        });
      }
    }

    // Check data freshness
    const dataFreshness = await this.getDataFreshness();
    if (dataFreshness) {
      const age = Date.now() - dataFreshness.getTime();
      if (age > this.config.alertThresholds.dataFreshness) {
        alerts.push({
          type: 'data_freshness',
          severity: 'warning',
          message: `Data is stale (${Math.round(age / 3600000)} hours old)`,
          timestamp: new Date(),
          metadata: { lastUpdateTime: dataFreshness }
        });
      }
    }

    // Check memory usage
    if (this.config.alertThresholds.memoryUsage) {
      const memoryUsage = process.memoryUsage();
      if (memoryUsage.rss > this.config.alertThresholds.memoryUsage) {
        alerts.push({
          type: 'memory_usage',
          severity: 'warning',
          message: `Memory usage high (${Math.round(memoryUsage.rss / (1024 * 1024))}MB)`,
          timestamp: new Date(),
          metadata: { memoryUsage }
        });
      }
    }

    // Send alerts
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }

    return alerts;
  }

  async sendAlert(alert: Alert): Promise<void> {
    for (const channelName of this.config.alertChannels) {
      const channel = this.alertChannels.get(channelName);
      if (channel) {
        try {
          await channel(alert);
        } catch (error) {
          console.error(`Failed to send alert via ${channelName}:`, error);
        }
      }
    }
  }

  registerAlertChannel(name: string, handler: AlertChannel): void {
    this.alertChannels.set(name, handler);
  }

  private registerDefaultAlertChannels(): void {
    // Email channel (placeholder)
    this.registerAlertChannel('email', async (alert) => {
      // In a real implementation, this would send an email
      console.log('Email alert:', alert);
    });

    // Slack channel (placeholder)
    this.registerAlertChannel('slack', async (alert) => {
      // In a real implementation, this would post to Slack
      console.log('Slack alert:', alert);
    });
  }

  async log(level: LogLevel, message: string, metadata?: any): Promise<void> {
    // Check if we should log this level
    if (this.logLevels[level] < this.logLevels[this.config.logLevel]) {
      return;
    }

    const logEntry = {
      timestamp: new Date(),
      level,
      message,
      metadata: {
        ...metadata,
        pipelineId: this.config.pipelineId,
        runId: this.currentRunId
      }
    };

    // Log to console
    console.log(`[${level.toUpperCase()}] ${message}`, metadata || '');

    // Log to cloud if enabled
    if (this.config.enableCloudLogging) {
      await this.writeLog(level, message, metadata);
    }

    // Store critical logs in database
    if (level === 'error' || level === 'warning') {
      try {
        await this.supabase
          .from('pipeline_logs')
          .insert({
            pipeline_id: this.config.pipelineId,
            run_id: this.currentRunId,
            level,
            message,
            metadata: logEntry.metadata,
            timestamp: logEntry.timestamp.toISOString()
          });
      } catch (error) {
        console.error('Failed to persist log:', error);
      }
    }
  }

  private async writeLog(level: LogLevel, message: string, metadata?: any): Promise<void> {
    if (!this.cloudLogging) {
      return;
    }

    try {
      const log = this.cloudLogging.log('pipeline-monitor');
      const entry = log.entry(
        {
          severity: level.toUpperCase(),
          resource: { type: 'global' }
        },
        {
          message,
          ...metadata,
          pipelineId: this.config.pipelineId,
          runId: this.currentRunId
        }
      );

      await log.write(entry);
    } catch (error) {
      console.error('Failed to write to cloud logging:', error);
    }
  }

  async getCurrentMetrics(): Promise<PipelineMetrics> {
    if (!this.currentMetrics) {
      throw new Error('No active pipeline run');
    }
    return { ...this.currentMetrics };
  }

  async getErrorRate(): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('pipeline_metrics')
        .select('steps')
        .eq('pipeline_id', this.config.pipelineId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error || !data || data.length === 0) {
        return 0;
      }

      let totalSteps = 0;
      let failedSteps = 0;

      for (const metric of data) {
        const steps = metric.steps || {};
        for (const step of Object.values(steps) as StepMetrics[]) {
          totalSteps++;
          if (!step.success) {
            failedSteps++;
          }
        }
      }

      return totalSteps > 0 ? failedSteps / totalSteps : 0;
    } catch (error) {
      console.error('Failed to calculate error rate:', error);
      return 0;
    }
  }

  async getRecentErrors(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('pipeline_errors')
        .select('*')
        .eq('pipeline_id', this.config.pipelineId)
        .order('timestamp', { ascending: false })
        .limit(20);

      if (error) {
        throw error;
      }

      return (data || []).map(row => ({
        timestamp: new Date(row.timestamp),
        step: row.step,
        error: row.error,
        stack: row.stack,
        context: row.context
      }));
    } catch (error) {
      console.error('Failed to get recent errors:', error);
      return [];
    }
  }

  async updateDataFreshness(timestamp: Date): Promise<void> {
    try {
      await this.supabase
        .from('pipeline_metadata')
        .upsert({
          pipeline_id: this.config.pipelineId,
          key: 'data_freshness',
          value: timestamp.toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'pipeline_id,key'
        });
    } catch (error) {
      console.error('Failed to update data freshness:', error);
    }
  }

  private async getDataFreshness(): Promise<Date | null> {
    try {
      const { data, error } = await this.supabase
        .from('pipeline_metadata')
        .select('value')
        .eq('pipeline_id', this.config.pipelineId)
        .eq('key', 'data_freshness')
        .single();

      if (error || !data) {
        return null;
      }

      return new Date(data.value);
    } catch (error) {
      console.error('Failed to get data freshness:', error);
      return null;
    }
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const [
      currentStatus,
      totalRuns,
      successRate,
      averageExecutionTime,
      recentErrors,
      activeAlerts,
      dataFreshness
    ] = await Promise.all([
      this.getCurrentStatus(),
      this.getTotalRuns(),
      this.getSuccessRate(),
      this.getAverageExecutionTime(),
      this.getRecentErrors(),
      this.checkAlerts(),
      this.getDataFreshness()
    ]);

    return {
      currentStatus,
      uptime: Date.now(), // Placeholder
      totalRuns,
      successRate,
      averageExecutionTime,
      recentErrors,
      activeAlerts,
      dataFreshness: dataFreshness || new Date()
    };
  }

  private async getCurrentStatus(): Promise<string> {
    return this.currentMetrics?.status || 'idle';
  }

  private async getTotalRuns(): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('pipeline_metrics')
        .select('*', { count: 'exact', head: true })
        .eq('pipeline_id', this.config.pipelineId);

      return count || 0;
    } catch {
      return 0;
    }
  }

  private async getSuccessRate(): Promise<number> {
    try {
      const { data } = await this.supabase
        .from('pipeline_metrics')
        .select('status')
        .eq('pipeline_id', this.config.pipelineId)
        .limit(100);

      if (!data || data.length === 0) {
        return 1.0;
      }

      const successCount = data.filter(m => m.status === 'completed').length;
      return successCount / data.length;
    } catch {
      return 0;
    }
  }

  private async getAverageExecutionTime(): Promise<number> {
    try {
      const { data } = await this.supabase
        .from('pipeline_metrics')
        .select('duration')
        .eq('pipeline_id', this.config.pipelineId)
        .not('duration', 'is', null)
        .limit(20);

      if (!data || data.length === 0) {
        return 0;
      }

      const total = data.reduce((sum, m) => sum + (m.duration || 0), 0);
      return total / data.length;
    } catch {
      return 0;
    }
  }

  async recordResourceMetrics(): Promise<void> {
    const memory = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const metrics: ResourceMetrics = {
      memory: {
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
        external: memory.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      }
    };

    await this.log('debug', 'Resource metrics', metrics);
  }

  async getResourceMetrics(): Promise<ResourceMetrics> {
    return {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    };
  }

  async analyzePerformance(): Promise<PerformanceAnalysis> {
    const baseline = await this.getPerformanceBaseline();
    const current = this.currentMetrics?.duration || 0;

    if (!baseline || current === 0) {
      return {
        isAnomalous: false,
        deviationFromBaseline: 0
      };
    }

    const deviation = Math.abs(current - baseline.averageDuration) / baseline.standardDeviation;
    const isAnomalous = deviation > 2; // More than 2 standard deviations

    return {
      isAnomalous,
      deviationFromBaseline: deviation,
      recommendation: isAnomalous ? 
        'Performance significantly deviates from baseline. Investigate potential causes.' : 
        undefined
    };
  }

  private async getPerformanceBaseline(): Promise<{
    averageDuration: number;
    standardDeviation: number;
  } | null> {
    // Placeholder - would calculate from historical data
    return {
      averageDuration: 5000,
      standardDeviation: 500
    };
  }

  async getThroughput(): Promise<number> {
    if (!this.currentMetrics) {
      return 0;
    }

    const totalRecords = this.currentMetrics.totalRecordsProcessed || 0;
    const duration = this.currentMetrics.duration || 
      (Date.now() - this.currentMetrics.startTime.getTime());

    return duration > 0 ? (totalRecords / duration) * 1000 : 0; // Records per second
  }

  async getSummary(): Promise<{
    totalRecordsProcessed: number;
    totalDuration: number;
    successRate: number;
  }> {
    if (!this.currentMetrics) {
      return {
        totalRecordsProcessed: 0,
        totalDuration: 0,
        successRate: 0
      };
    }

    const steps = Object.values(this.currentMetrics.steps);
    const totalRecords = steps.reduce((sum, step) => sum + (step.recordsProcessed || 0), 0);
    const totalDuration = this.currentMetrics.duration || 0;
    const successCount = steps.filter(step => step.success).length;
    const successRate = steps.length > 0 ? successCount / steps.length : 0;

    return {
      totalRecordsProcessed: totalRecords,
      totalDuration,
      successRate
    };
  }

  async cleanupOldData(options: { daysToKeep: number }): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.daysToKeep);

    try {
      // Clean up metrics
      await this.supabase
        .from('pipeline_metrics')
        .delete()
        .eq('pipeline_id', this.config.pipelineId)
        .lt('created_at', cutoffDate.toISOString());

      // Clean up errors
      await this.supabase
        .from('pipeline_errors')
        .delete()
        .eq('pipeline_id', this.config.pipelineId)
        .lt('timestamp', cutoffDate.toISOString());

      // Clean up logs
      await this.supabase
        .from('pipeline_logs')
        .delete()
        .eq('pipeline_id', this.config.pipelineId)
        .lt('timestamp', cutoffDate.toISOString());

    } catch (error) {
      console.error('Failed to cleanup old data:', error);
    }
  }

  async exportMetrics(options: ExportOptions): Promise<any> {
    const summary = await this.getSummary();
    const errors = await this.getRecentErrors();
    const alerts = await this.checkAlerts();

    return {
      summary,
      steps: this.currentMetrics?.steps || {},
      errors,
      alerts,
      metadata: {
        exportDate: new Date(),
        format: options.format,
        pipelineId: this.config.pipelineId
      }
    };
  }

  private async persistMetrics(): Promise<void> {
    if (!this.currentMetrics) {
      return;
    }

    try {
      await this.supabase
        .from('pipeline_metrics')
        .upsert({
          pipeline_id: this.config.pipelineId,
          run_id: this.currentMetrics.runId,
          status: this.currentMetrics.status,
          start_time: this.currentMetrics.startTime.toISOString(),
          end_time: this.currentMetrics.endTime?.toISOString() || null,
          duration: this.currentMetrics.duration || null,
          steps: this.currentMetrics.steps,
          total_records_processed: this.currentMetrics.totalRecordsProcessed || 0,
          error: this.currentMetrics.error || null,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'run_id'
        });
    } catch (error) {
      console.error('Failed to persist metrics:', error);
    }
  }

  async getHistoricalMetrics(options: {
    startDate: Date;
    endDate: Date;
    interval: 'hourly' | 'daily' | 'weekly';
  }): Promise<any[]> {
    return this.queryHistoricalMetrics(options);
  }

  private async queryHistoricalMetrics(options: {
    startDate: Date;
    endDate: Date;
    interval: 'hourly' | 'daily' | 'weekly';
  }): Promise<any[]> {
    // Placeholder - would query and aggregate historical data
    return [];
  }
}