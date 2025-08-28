import { SupabaseClient } from '@supabase/supabase-js';
import {
  SyncLogEntry,
  DataQualityCheck,
  ErrorDetail,
  PerformanceMetrics,
  SyncMetrics,
  Alert,
  AlertConfig,
} from './types';

export type { SyncLogEntry, DataQualityCheck } from './types';

export class SyncLogger {
  private supabase: SupabaseClient;
  private defaultAlertConfig: AlertConfig = {
    consecutiveFailureThreshold: 2,
    longRunningSyncThresholdMinutes: 15,
    dataQualityThresholds: {
      rowCountDifferencePercent: 1,
      sumValidationDifferencePercent: 0.1,
      nullCountThreshold: 0,
    },
  };

  constructor(supabase: SupabaseClient, alertConfig?: Partial<AlertConfig>) {
    this.supabase = supabase;
    if (alertConfig) {
      this.defaultAlertConfig = { ...this.defaultAlertConfig, ...alertConfig };
    }
  }

  /**
   * Start a new sync and create log entry
   */
  public async startSync(entry: Omit<SyncLogEntry, 'id' | 'created_at'>): Promise<number> {
    const { data, error } = await this.supabase
      .from('sqp.sync_log')
      .insert({
        ...entry,
        started_at: entry.started_at || new Date(),
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create sync log: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Complete a sync with success status
   */
  public async completeSync(
    logId: number,
    result: {
      records_processed: number;
      records_inserted: number;
      records_updated: number;
      records_failed: number;
      metadata?: any;
    }
  ): Promise<void> {
    const { error } = await this.supabase
      .from('sqp.sync_log')
      .update({
        sync_status: 'completed',
        completed_at: new Date(),
        ...result,
        sync_metadata: result.metadata,
      })
      .eq('id', logId);

    if (error) {
      throw new Error(`Failed to update sync log: ${error.message}`);
    }
  }

  /**
   * Mark sync as failed
   */
  public async failSync(
    logId: number,
    error: Error,
    additionalData?: {
      records_processed?: number;
      partial?: boolean;
    }
  ): Promise<void> {
    const { error: updateError } = await this.supabase
      .from('sqp.sync_log')
      .update({
        sync_status: 'failed',
        completed_at: new Date(),
        error_message: error.message,
        error_details: {
          stack: error.stack,
          ...additionalData,
        },
        records_processed: additionalData?.records_processed,
      })
      .eq('id', logId);

    if (updateError) {
      console.error('Failed to update sync log with failure:', updateError);
    }
  }

  /**
   * Log a single data quality check
   */
  public async logDataQualityCheck(
    syncLogId: number,
    check: Omit<DataQualityCheck, 'id' | 'sync_log_id' | 'created_at'>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('sqp.data_quality_checks')
      .insert({
        sync_log_id: syncLogId,
        ...check,
      });

    if (error) {
      console.error('Failed to log data quality check:', error);
    }
  }

  /**
   * Log multiple data quality checks
   */
  public async logDataQualityChecks(
    syncLogId: number,
    checks: Array<Omit<DataQualityCheck, 'id' | 'sync_log_id' | 'created_at'>>
  ): Promise<void> {
    const checksWithSyncId = checks.map(check => ({
      sync_log_id: syncLogId,
      ...check,
    }));

    const { error } = await this.supabase
      .from('sqp.data_quality_checks')
      .insert(checksWithSyncId);

    if (error) {
      console.error('Failed to log data quality checks:', error);
    }
  }

  /**
   * Log record-level errors
   */
  public async logRecordErrors(syncLogId: number, errors: ErrorDetail[]): Promise<void> {
    // Get existing sync log
    const { data: syncLog, error: fetchError } = await this.supabase
      .from('sqp.sync_log')
      .select('error_details')
      .eq('id', syncLogId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch sync log:', fetchError);
      return;
    }

    const existingErrors = syncLog?.error_details?.record_errors || [];
    const updatedErrors = [...existingErrors, ...errors];

    const { error: updateError } = await this.supabase
      .from('sqp.sync_log')
      .update({
        error_details: {
          ...syncLog?.error_details,
          record_errors: updatedErrors,
          total_record_errors: updatedErrors.length,
        },
      })
      .eq('id', syncLogId);

    if (updateError) {
      console.error('Failed to log record errors:', updateError);
    }
  }

  /**
   * Summarize errors by type
   */
  public summarizeErrors(errors: Array<{ type: string; count: number }>): {
    total: number;
    byType: Record<string, number>;
    mostCommon: string;
  } {
    const total = errors.reduce((sum, e) => sum + e.count, 0);
    const byType = errors.reduce((acc, e) => {
      acc[e.type] = e.count;
      return acc;
    }, {} as Record<string, number>);

    const mostCommon = errors.reduce((prev, current) => 
      current.count > prev.count ? current : prev
    ).type;

    return { total, byType, mostCommon };
  }

  /**
   * Calculate sync duration
   */
  public calculateDuration(
    startTime: Date,
    endTime: Date
  ): {
    seconds: number;
    minutes: number;
    formatted: string;
  } {
    const durationMs = endTime.getTime() - startTime.getTime();
    const seconds = Math.floor(durationMs / 1000);
    const minutes = seconds / 60;

    const mins = Math.floor(minutes);
    const secs = seconds % 60;
    const formatted = `${mins}m ${secs}s`;

    return { seconds, minutes, formatted };
  }

  /**
   * Log performance metrics
   */
  public async logPerformanceMetrics(
    syncLogId: number,
    metrics: PerformanceMetrics
  ): Promise<void> {
    const { data: syncLog, error: fetchError } = await this.supabase
      .from('sqp.sync_log')
      .select('sync_metadata')
      .eq('id', syncLogId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch sync log:', fetchError);
      return;
    }

    const { error: updateError } = await this.supabase
      .from('sqp.sync_log')
      .update({
        sync_metadata: {
          ...syncLog?.sync_metadata,
          performance: metrics,
        },
      })
      .eq('id', syncLogId);

    if (updateError) {
      console.error('Failed to log performance metrics:', updateError);
    }
  }

  /**
   * Get sync history
   */
  public async getSyncHistory(options: {
    limit?: number;
    type?: string;
    status?: string;
  } = {}): Promise<SyncLogEntry[]> {
    let query = this.supabase
      .from('sqp.sync_log')
      .select('*')
      .order('started_at', { ascending: false });

    if (options.type) {
      query = query.eq('sync_type', options.type);
    }

    if (options.status) {
      query = query.eq('sync_status', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to get sync history:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get sync success rate
   */
  public async getSuccessRate(options: { days?: number; type?: string } = {}): Promise<{
    total: number;
    successful: number;
    failed: number;
    rate: number;
    percentage: number;
  }> {
    let query = this.supabase
      .from('sqp.sync_log')
      .select('sync_status');

    if (options.days) {
      const since = new Date();
      since.setDate(since.getDate() - options.days);
      query = query.gte('started_at', since.toISOString());
    }

    if (options.type) {
      query = query.eq('sync_type', options.type);
    }

    const { data, error } = await query;

    if (error || !data) {
      return { total: 0, successful: 0, failed: 0, rate: 0, percentage: 0 };
    }

    const total = data.length;
    const successful = data.filter(d => d.sync_status === 'completed').length;
    const failed = data.filter(d => d.sync_status === 'failed').length;
    const rate = total > 0 ? successful / total : 0;
    const percentage = rate * 100;

    return { total, successful, failed, rate, percentage };
  }

  /**
   * Check for alerts based on recent sync history
   */
  public async checkForAlerts(): Promise<Alert> {
    const recentSyncs = await this.getSyncHistory({ limit: 3 });

    // Check for consecutive failures
    const consecutiveFailures = recentSyncs
      .slice(0, this.defaultAlertConfig.consecutiveFailureThreshold)
      .filter(s => s.sync_status === 'failed');

    if (consecutiveFailures.length >= this.defaultAlertConfig.consecutiveFailureThreshold) {
      return {
        alert: true,
        reason: 'consecutive_failures',
        details: {
          count: consecutiveFailures.length,
          errors: consecutiveFailures.map(s => s.error_message),
        },
        severity: 'critical',
      };
    }

    return { alert: false, reason: 'no_issues' };
  }

  /**
   * Check for long-running sync
   */
  public async checkForLongRunningSync(): Promise<Alert> {
    const { data: runningSync, error } = await this.supabase
      .from('sqp.sync_log')
      .select('*')
      .eq('sync_status', 'started')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !runningSync) {
      return { alert: false, reason: 'no_running_sync' };
    }

    const startTime = new Date(runningSync.started_at!);
    const duration = this.calculateDuration(startTime, new Date());

    if (duration.minutes > this.defaultAlertConfig.longRunningSyncThresholdMinutes) {
      return {
        alert: true,
        reason: 'long_running',
        severity: 'high',
        details: { 
          syncId: runningSync.id, 
          startedAt: runningSync.started_at,
          duration: duration.minutes,
          threshold: this.defaultAlertConfig.longRunningSyncThresholdMinutes,
        },
      };
    }

    return { alert: false, reason: 'normal_duration' };
  }

  /**
   * Clean up old sync logs
   */
  public async cleanupOldLogs(options: { retentionDays: number }): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.retentionDays);

    const { data, error } = await this.supabase
      .from('sqp.sync_log')
      .delete()
      .lt('started_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      console.error('Failed to cleanup old logs:', error);
      return 0;
    }

    return data?.length || 0;
  }

  /**
   * Get sync metrics for a time period
   */
  public async getMetrics(options: { 
    days: number; 
    groupBy?: 'day' | 'week' | 'month' 
  }): Promise<SyncMetrics> {
    const since = new Date();
    since.setDate(since.getDate() - options.days);

    const { data: syncs, error } = await this.supabase
      .from('sqp.sync_log')
      .select('*')
      .gte('started_at', since.toISOString())
      .order('started_at', { ascending: false });

    if (error || !syncs) {
      return {
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        averageDuration: 0,
        totalRecordsProcessed: 0,
      };
    }

    const successful = syncs.filter(s => s.sync_status === 'completed');
    const failed = syncs.filter(s => s.sync_status === 'failed');

    const durations = successful
      .filter(s => s.completed_at && s.started_at)
      .map(s => {
        const start = new Date(s.started_at!);
        const end = new Date(s.completed_at!);
        return this.calculateDuration(start, end).seconds;
      });

    const avgDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

    const totalRecords = syncs.reduce((sum, s) => sum + (s.records_processed || 0), 0);

    return {
      totalSyncs: syncs.length,
      successfulSyncs: successful.length,
      failedSyncs: failed.length,
      averageDuration: avgDuration,
      totalRecordsProcessed: totalRecords,
      successRate: syncs.length > 0 ? successful.length / syncs.length : 0,
      errorRate: syncs.length > 0 ? failed.length / syncs.length : 0,
    };
  }
}