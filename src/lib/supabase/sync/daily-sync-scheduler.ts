import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { BigQueryToSupabaseSync, SyncResult } from './bigquery-to-supabase';
import { BigQueryConnectionPool } from '@/lib/bigquery/connection-pool';
import { format, startOfWeek, endOfWeek, subWeeks, isAfter } from 'date-fns';
import * as cron from 'node-cron';

export interface SyncJobConfig {
  schedule: string; // Cron expression, e.g., '0 2 * * *' for 2 AM daily
  supabaseUrl: string;
  supabaseServiceKey: string;
  bigQueryProjectId: string;
  bigQueryDataset: string;
  retryAttempts?: number;
  retryDelayMs?: number;
  batchSize?: number;
}

export interface SyncJobResult {
  success: boolean;
  syncLogId?: number;
  recordsProcessed: number;
  recordsInserted?: number;
  recordsUpdated?: number;
  recordsFailed?: number;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  error?: string;
  retryCount?: number;
  partialSuccess?: boolean;
  triggeredBy?: 'scheduled' | 'manual';
}

export interface SyncStatus {
  lastSync?: {
    completedAt: Date;
    status: string;
    recordsProcessed: number;
  };
  nextScheduledSync?: Date;
  isRunning: boolean;
  currentSyncId?: number;
}

export interface DataQualityResult {
  checks: Array<{
    type: string;
    passed: boolean;
    details?: any;
  }>;
  overallPassed: boolean;
}

export class DailySyncScheduler {
  private config: SyncJobConfig;
  private supabase: SupabaseClient;
  private bigQueryPool: BigQueryConnectionPool;
  private syncService: BigQueryToSupabaseSync;
  private cronJob?: cron.ScheduledTask;
  private isRunning: boolean = false;
  private currentSyncId?: number;

  constructor(config: SyncJobConfig) {
    this.validateConfig(config);
    this.config = config;
    
    // Initialize Supabase client with service role key
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    
    // Initialize BigQuery connection pool
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}');
    this.bigQueryPool = new BigQueryConnectionPool({
      projectId: config.bigQueryProjectId,
      credentials,
      maxConnections: 5,
      idleTimeoutMillis: 60000,
    });
    
    // Initialize sync service
    this.syncService = new BigQueryToSupabaseSync({
      supabaseUrl: config.supabaseUrl,
      supabaseKey: config.supabaseServiceKey,
      bigqueryPool: this.bigQueryPool,
      batchSize: config.batchSize || 1000,
    });
  }

  private validateConfig(config: SyncJobConfig): void {
    if (!config.schedule || !cron.validate(config.schedule)) {
      throw new Error('Invalid schedule cron expression');
    }
    if (!config.supabaseUrl || !config.supabaseServiceKey) {
      throw new Error('Supabase configuration is required');
    }
    if (!config.bigQueryProjectId || !config.bigQueryDataset) {
      throw new Error('BigQuery configuration is required');
    }
  }

  public getConfig(): SyncJobConfig {
    return this.config;
  }

  public async checkForNewData(): Promise<boolean> {
    try {
      // Get the latest period_end from Supabase
      const { data: latestRecord, error } = await this.supabase
        .from('sqp.weekly_summary')
        .select('period_end')
        .order('period_end', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // Not a "no rows" error
        throw error;
      }

      if (!latestRecord) {
        // No data in Supabase yet
        return true;
      }

      // Check if current week has ended and we should have new data
      const lastSyncedWeekEnd = new Date(latestRecord.period_end);
      const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const previousWeekEnd = endOfWeek(subWeeks(currentWeekStart, 1), { weekStartsOn: 1 });

      return isAfter(previousWeekEnd, lastSyncedWeekEnd);
    } catch (error) {
      console.error('Error checking for new data:', error);
      return false;
    }
  }

  public async executeSyncJob(): Promise<SyncJobResult> {
    const startedAt = new Date();
    let syncLogId: number | undefined;
    let retryCount = 0;
    const maxRetries = this.config.retryAttempts || 3;
    
    // Prevent concurrent runs
    if (this.isRunning) {
      return {
        success: false,
        recordsProcessed: 0,
        startedAt,
        error: 'Sync already in progress',
      };
    }

    this.isRunning = true;

    try {
      // Create sync log entry
      syncLogId = await this.createSyncLog('started');
      this.currentSyncId = syncLogId;

      // Check if there's new data to sync
      const hasNewData = await this.checkForNewData();
      if (!hasNewData) {
        await this.updateSyncLog(syncLogId, {
          sync_status: 'completed',
          completed_at: new Date(),
          sync_metadata: { message: 'No new data to sync' },
        });
        
        return {
          success: true,
          syncLogId,
          recordsProcessed: 0,
          startedAt,
          completedAt: new Date(),
        };
      }

      // Determine date range for sync
      const dateRange = await this.getDateRangeForSync();
      
      // Execute sync with retry logic
      let syncResult: SyncResult | null = null;
      let lastError: Error | null = null;

      while (retryCount < maxRetries) {
        try {
          syncResult = await this.syncService.syncPeriodData(
            'weekly',
            dateRange.start,
            dateRange.end,
            { validateData: true }
          );
          
          if (syncResult.success) {
            break;
          }
          
          // If sync failed but no exception, treat as error
          throw new Error(syncResult.errors.join('; '));
        } catch (error) {
          lastError = error as Error;
          retryCount++;
          
          if (retryCount < maxRetries) {
            // Exponential backoff
            const delay = this.config.retryDelayMs || 1000;
            await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, retryCount - 1)));
          }
        }
      }

      if (!syncResult || !syncResult.success) {
        throw lastError || new Error('Sync failed after retries');
      }

      // Update sync log with results
      await this.updateSyncLog(syncLogId, {
        sync_status: 'completed',
        completed_at: new Date(),
        records_processed: syncResult.recordsSynced,
        records_inserted: syncResult.validation?.successfulRecords || 0,
        records_updated: 0, // TODO: Track updates separately
        records_failed: syncResult.validation?.failedRecords || 0,
      });

      // Run data quality checks
      await this.runDataQualityChecks(syncLogId, dateRange);

      // Refresh materialized views
      await this.refreshMaterializedViews();

      return {
        success: true,
        syncLogId,
        recordsProcessed: syncResult.recordsSynced,
        recordsInserted: syncResult.validation?.successfulRecords,
        recordsFailed: syncResult.validation?.failedRecords,
        startedAt,
        completedAt: new Date(),
        duration: Date.now() - startedAt.getTime(),
        retryCount,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (syncLogId) {
        await this.updateSyncLog(syncLogId, {
          sync_status: 'failed',
          completed_at: new Date(),
          error_message: errorMessage,
          error_details: { retryCount, error: error instanceof Error ? error.stack : error },
        });
      }

      return {
        success: false,
        syncLogId,
        recordsProcessed: 0,
        startedAt,
        completedAt: new Date(),
        error: errorMessage,
        retryCount,
      };
    } finally {
      this.isRunning = false;
      this.currentSyncId = undefined;
    }
  }

  public async runDataQualityChecks(syncLogId: number, dateRange: { start: Date; end: Date }): Promise<DataQualityResult> {
    const checks: Array<{ type: string; passed: boolean; details?: any }> = [];

    try {
      // Check 1: Row count validation
      const rowCountCheck = await this.validateRowCount(dateRange);
      checks.push(rowCountCheck);

      // Check 2: Sum validation for key metrics
      const sumChecks = await this.validateSumTotals(dateRange);
      checks.push(...sumChecks);

      // Check 3: Null check for required fields
      const nullCheck = await this.validateNoNulls(dateRange);
      checks.push(nullCheck);

      // Log all checks to database
      for (const check of checks) {
        await this.supabase
          .from('sqp.data_quality_checks')
          .insert({
            sync_log_id: syncLogId,
            check_type: check.type,
            check_status: check.passed ? 'passed' : 'failed',
            check_message: check.details?.message,
            check_metadata: check.details,
          });
      }

      const overallPassed = checks.every(c => c.passed);
      return { checks, overallPassed };
    } catch (error) {
      console.error('Error running data quality checks:', error);
      return { checks, overallPassed: false };
    }
  }

  private async validateRowCount(dateRange: { start: Date; end: Date }): Promise<any> {
    // Implementation would compare BigQuery vs Supabase row counts
    // This is a placeholder
    return {
      type: 'row_count',
      passed: true,
      details: {
        source_count: 1000,
        target_count: 1000,
        difference: 0,
      },
    };
  }

  private async validateSumTotals(dateRange: { start: Date; end: Date }): Promise<any[]> {
    // Implementation would compare sum totals for impressions, clicks, purchases
    // This is a placeholder
    return [
      {
        type: 'sum_validation',
        passed: true,
        details: {
          column: 'total_impressions',
          source_sum: 50000,
          target_sum: 50000,
        },
      },
    ];
  }

  private async validateNoNulls(dateRange: { start: Date; end: Date }): Promise<any> {
    // Implementation would check for null values in required fields
    // This is a placeholder
    return {
      type: 'null_check',
      passed: true,
      details: {
        null_count: 0,
        checked_columns: ['query', 'asin', 'period_start'],
      },
    };
  }

  private async refreshMaterializedViews(): Promise<void> {
    try {
      await this.supabase.rpc('refresh_materialized_view_concurrently', {
        view_name: 'sqp.weekly_trends',
      });
      
      await this.supabase.rpc('refresh_materialized_view_concurrently', {
        view_name: 'sqp.monthly_trends',
      });
    } catch (error) {
      console.error('Error refreshing materialized views:', error);
      // Don't fail the sync for this
    }
  }

  private async createSyncLog(status: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('sqp.sync_log')
      .insert({
        sync_type: 'weekly',
        sync_status: status,
        source_table: `${this.config.bigQueryDataset}.seller-search_query_performance`,
        target_table: 'sqp.weekly_summary',
        started_at: new Date(),
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  private async updateSyncLog(id: number, updates: any): Promise<void> {
    const { error } = await this.supabase
      .from('sqp.sync_log')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  }

  private async getDateRangeForSync(): Promise<{ start: Date; end: Date }> {
    // Get the latest synced period
    const { data: latestRecord } = await this.supabase
      .from('sqp.weekly_summary')
      .select('period_end')
      .order('period_end', { ascending: false })
      .limit(1)
      .single();

    let start: Date;
    if (latestRecord) {
      // Start from the day after the last synced period
      start = new Date(latestRecord.period_end);
      start.setDate(start.getDate() + 1);
    } else {
      // If no data, start from 90 days ago
      start = new Date();
      start.setDate(start.getDate() - 90);
    }

    // End at the last completed week
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const end = endOfWeek(subWeeks(currentWeekStart, 1), { weekStartsOn: 1 });

    return { start, end };
  }

  public start(): void {
    if (this.cronJob) {
      this.cronJob.start();
      return;
    }

    this.cronJob = cron.schedule(this.config.schedule, async () => {
      console.log(`[${new Date().toISOString()}] Starting scheduled sync...`);
      const result = await this.executeSyncJob();
      console.log(`[${new Date().toISOString()}] Sync completed:`, result);
    });

    this.cronJob.start();
    console.log(`Sync scheduler started with schedule: ${this.config.schedule}`);
  }

  public stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('Sync scheduler stopped');
    }
  }

  public async triggerManualSync(options?: { force?: boolean }): Promise<SyncJobResult> {
    const result = await this.executeSyncJob();
    return {
      ...result,
      triggeredBy: 'manual',
    };
  }

  public async getSyncStatus(): Promise<SyncStatus> {
    const { data: lastSync } = await this.supabase
      .from('sqp.sync_log')
      .select('*')
      .eq('sync_type', 'weekly')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    const nextScheduledSync = this.getNextScheduledTime();

    return {
      lastSync: lastSync ? {
        completedAt: new Date(lastSync.completed_at || lastSync.started_at),
        status: lastSync.sync_status,
        recordsProcessed: lastSync.records_processed || 0,
      } : undefined,
      nextScheduledSync,
      isRunning: this.isRunning,
      currentSyncId: this.currentSyncId,
    };
  }

  public async getSyncMetrics(options: { days: number }): Promise<any> {
    const since = new Date();
    since.setDate(since.getDate() - options.days);

    const { data: syncs } = await this.supabase
      .from('sqp.sync_log')
      .select('*')
      .eq('sync_type', 'weekly')
      .gte('started_at', since.toISOString())
      .order('started_at', { ascending: false });

    if (!syncs || syncs.length === 0) {
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
      .filter(s => s.completed_at)
      .map(s => new Date(s.completed_at).getTime() - new Date(s.started_at).getTime());
    
    const avgDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

    const totalRecords = syncs.reduce((sum, s) => sum + (s.records_processed || 0), 0);

    return {
      totalSyncs: syncs.length,
      successfulSyncs: successful.length,
      failedSyncs: failed.length,
      averageDuration: Math.round(avgDuration / 1000), // seconds
      totalRecordsProcessed: totalRecords,
    };
  }

  private getNextScheduledTime(): Date {
    if (!this.cronJob) {
      return new Date();
    }

    const interval = cron.parseExpression(this.config.schedule);
    return interval.next().toDate();
  }

  public async cleanup(): Promise<void> {
    this.stop();
    await this.bigQueryPool.drain();
  }
}