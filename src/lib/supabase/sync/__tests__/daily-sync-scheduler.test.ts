import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DailySyncScheduler, SyncJobConfig, SyncJobResult } from '../daily-sync-scheduler';
import { BigQueryToSupabaseSync } from '../bigquery-to-supabase';
import { createClient } from '@supabase/supabase-js';
import * as cron from 'node-cron';

// Mock dependencies
vi.mock('@supabase/supabase-js');
vi.mock('../bigquery-to-supabase');
const mockCronJob = {
  start: vi.fn(),
  stop: vi.fn(),
  destroy: vi.fn(),
};
vi.mock('node-cron', () => ({
  schedule: vi.fn(() => mockCronJob),
  validate: vi.fn(() => true),
}));
vi.mock('@/lib/bigquery/connection-pool', () => ({
  BigQueryConnectionPool: vi.fn((config, options) => ({
    acquire: vi.fn(),
    release: vi.fn(),
    close: vi.fn(),
  })),
}));

describe('DailySyncScheduler', () => {
  let scheduler: DailySyncScheduler;
  let mockSupabaseClient: any;
  let mockSync: any;
  let mockCron: any;

  const testConfig: SyncJobConfig = {
    schedule: '0 2 * * *', // 2 AM daily
    supabaseUrl: 'https://test.supabase.co',
    supabaseServiceKey: 'test-service-key',
    bigQueryProjectId: 'test-project',
    bigQueryDataset: 'test_dataset',
    retryAttempts: 3,
    retryDelayMs: 1000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock environment variable
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = JSON.stringify({
      type: 'service_account',
      project_id: 'test-project',
      private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
      client_email: 'test@test.iam.gserviceaccount.com',
    });
    
    // Mock Supabase client with chainable methods
    const createChainableMock = () => {
      const mock: any = {};
      
      // Create default chain that returns itself
      const defaultChain = {
        from: vi.fn(() => mock),
        select: vi.fn(() => mock),
        insert: vi.fn(() => mock),
        update: vi.fn(() => mock),
        eq: vi.fn(() => mock),
        order: vi.fn(() => mock),
        limit: vi.fn(() => mock),
        single: vi.fn(() => Promise.resolve({ data: { id: 1, period_end: '2025-08-21' }, error: null })),
        gte: vi.fn(() => mock),
        lt: vi.fn(() => mock),
        delete: vi.fn(() => mock),
        rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };
      
      // Apply all methods to mock
      Object.assign(mock, defaultChain);
      
      // Create special from method that handles different table patterns
      mock.from = vi.fn((table: string) => {
        const tableMock = { ...mock };
        
        // Handle insert chain pattern
        tableMock.insert = vi.fn((data: any) => {
          const insertChain = { ...mock };
          insertChain.select = vi.fn((columns?: string) => {
            const selectChain = { ...mock };
            selectChain.single = vi.fn(() => Promise.resolve({ 
              data: { id: 1, ...data }, 
              error: null 
            }));
            return selectChain;
          });
          // Direct resolution support
          if (!data || typeof data === 'object') {
            return insertChain;
          }
          return Promise.resolve({ data: [{ id: 1 }], error: null });
        });
        
        // Handle update chain
        tableMock.update = vi.fn((data: any) => {
          const updateChain = { ...mock };
          updateChain.eq = vi.fn(() => Promise.resolve({ 
            data: [{ id: 1, ...data }], 
            error: null 
          }));
          return updateChain;
        });
        
        return tableMock;
      });
      
      return mock;
    };
    
    mockSupabaseClient = createChainableMock();
    
    vi.mocked(createClient).mockReturnValue(mockSupabaseClient);

    // Mock BigQueryToSupabaseSync
    mockSync = {
      syncPeriodData: vi.fn().mockResolvedValue({
        success: true,
        recordsSynced: 1000,
        errors: [],
        validation: {
          totalRecords: 1000,
          successfulRecords: 1000,
          failedRecords: 0,
          distinctQueries: 50,
          distinctASINs: 100,
          dataQualityScore: 0.95,
        },
      }),
    };
    
    vi.mocked(BigQueryToSupabaseSync).mockImplementation(() => mockSync);

    // Mock node-cron
    mockCron = {
      schedule: vi.fn().mockReturnValue({
        start: vi.fn(),
        stop: vi.fn(),
        destroy: vi.fn(),
      }),
    };
  });

  afterEach(() => {
    if (scheduler) {
      scheduler.stop();
    }
  });

  describe('Initialization', () => {
    it('should initialize with proper configuration', () => {
      scheduler = new DailySyncScheduler(testConfig);
      expect(scheduler).toBeDefined();
      expect(scheduler.getConfig()).toEqual(testConfig);
    });

    it('should validate configuration on init', () => {
      const invalidConfig = { ...testConfig, schedule: '' };
      expect(() => new DailySyncScheduler(invalidConfig as any)).toThrow('Invalid schedule');
    });
  });

  describe('Sync Detection', () => {
    it('should detect new weekly data to sync', async () => {
      // Mock last synced date as 2025-08-14
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { period_end: '2025-08-14' },
        error: null,
      });

      scheduler = new DailySyncScheduler(testConfig);
      const hasNewData = await scheduler.checkForNewData();

      expect(hasNewData).toBe(true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('sqp.weekly_summary');
    });

    it('should detect when no new data is available', async () => {
      // Mock last synced date as current week
      const currentWeekEnd = new Date();
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { period_end: currentWeekEnd.toISOString().split('T')[0] },
        error: null,
      });

      scheduler = new DailySyncScheduler(testConfig);
      const hasNewData = await scheduler.checkForNewData();

      expect(hasNewData).toBe(false);
    });
  });

  describe('Sync Execution', () => {
    it('should execute sync for new weekly data', async () => {
      scheduler = new DailySyncScheduler(testConfig);
      
      // Mock checkForNewData to return true
      vi.spyOn(scheduler, 'checkForNewData').mockResolvedValueOnce(true);
      
      // Mock getDateRangeForSync
      vi.spyOn(scheduler as any, 'getDateRangeForSync').mockResolvedValueOnce({
        start: new Date('2025-08-14'),
        end: new Date('2025-08-21'),
      });
      
      const result = await scheduler.executeSyncJob();
      
      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(1000);
      expect(mockSync.syncPeriodData).toHaveBeenCalledWith(
        'weekly',
        expect.any(Date),
        expect.any(Date),
        expect.objectContaining({ validateData: true })
      );
    });

    it('should log sync results to sync_log table', async () => {
      scheduler = new DailySyncScheduler(testConfig);
      
      // Mock checkForNewData to return true
      vi.spyOn(scheduler, 'checkForNewData').mockResolvedValueOnce(true);
      
      // Mock getDateRangeForSync
      vi.spyOn(scheduler as any, 'getDateRangeForSync').mockResolvedValueOnce({
        start: new Date('2025-08-14'),
        end: new Date('2025-08-21'),
      });
      
      await scheduler.executeSyncJob();
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('sqp.sync_log');
      
      // Check that the from() chain was called with insert
      const fromCalls = mockSupabaseClient.from.mock.calls;
      const syncLogCalls = fromCalls.filter(call => call[0] === 'sqp.sync_log');
      expect(syncLogCalls.length).toBeGreaterThan(0);
      
      // The from().insert() should have been called
      const fromResult = mockSupabaseClient.from.mock.results[0].value;
      expect(fromResult.insert).toHaveBeenCalled();
    });

    it('should handle sync failures with retry', async () => {
      mockSync.syncPeriodData
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ success: true, recordsSynced: 500, errors: [] });

      scheduler = new DailySyncScheduler(testConfig);
      
      // Mock checkForNewData to return true
      vi.spyOn(scheduler, 'checkForNewData').mockResolvedValueOnce(true);
      
      // Mock getDateRangeForSync
      vi.spyOn(scheduler as any, 'getDateRangeForSync').mockResolvedValueOnce({
        start: new Date('2025-08-14'),
        end: new Date('2025-08-21'),
      });
      
      const result = await scheduler.executeSyncJob();

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(2);
      expect(mockSync.syncPeriodData).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      mockSync.syncPeriodData.mockRejectedValue(new Error('Persistent error'));

      scheduler = new DailySyncScheduler(testConfig);
      
      // Mock checkForNewData to return true
      vi.spyOn(scheduler, 'checkForNewData').mockResolvedValueOnce(true);
      
      // Mock getDateRangeForSync
      vi.spyOn(scheduler as any, 'getDateRangeForSync').mockResolvedValueOnce({
        start: new Date('2025-08-14'),
        end: new Date('2025-08-21'),
      });
      
      const result = await scheduler.executeSyncJob();

      expect(result.success).toBe(false);
      expect(result.retryCount).toBe(3);
      expect(result.error).toContain('Persistent error');
    });
  });

  describe('Data Quality Checks', () => {
    it('should run data quality checks after successful sync', async () => {
      scheduler = new DailySyncScheduler(testConfig);
      
      // Mock checkForNewData to return true
      vi.spyOn(scheduler, 'checkForNewData').mockResolvedValueOnce(true);
      
      // Mock getDateRangeForSync
      vi.spyOn(scheduler as any, 'getDateRangeForSync').mockResolvedValueOnce({
        start: new Date('2025-08-14'),
        end: new Date('2025-08-21'),
      });
      
      await scheduler.executeSyncJob();

      // The sync should create log entries and run quality checks
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('sqp.sync_log');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('sqp.data_quality_checks');
    });

    it('should validate sum totals between source and target', async () => {
      scheduler = new DailySyncScheduler(testConfig);
      
      const validation = await scheduler.runDataQualityChecks(1, {
        start: new Date('2025-08-14'),
        end: new Date('2025-08-21'),
      });

      expect(validation.checks).toContainEqual(
        expect.objectContaining({
          type: 'sum_validation',
          passed: expect.any(Boolean),
        })
      );
    });
  });

  describe('Scheduler Management', () => {
    it('should start and stop the cron job', () => {
      // Clear mock calls before test
      mockCronJob.start.mockClear();
      mockCronJob.stop.mockClear();

      scheduler = new DailySyncScheduler(testConfig);
      scheduler.start();

      expect(vi.mocked(cron).schedule).toHaveBeenCalledWith('0 2 * * *', expect.any(Function));
      expect(mockCronJob.start).toHaveBeenCalled();

      scheduler.stop();
      expect(mockCronJob.stop).toHaveBeenCalled();
    });

    it('should handle manual trigger', async () => {
      scheduler = new DailySyncScheduler(testConfig);
      
      // Mock checkForNewData to return true
      vi.spyOn(scheduler, 'checkForNewData').mockResolvedValueOnce(true);
      
      // Mock getDateRangeForSync
      vi.spyOn(scheduler as any, 'getDateRangeForSync').mockResolvedValueOnce({
        start: new Date('2025-08-14'),
        end: new Date('2025-08-21'),
      });
      
      const result = await scheduler.triggerManualSync({ force: true });
      
      expect(result.success).toBe(true);
      expect(result.triggeredBy).toBe('manual');
    });
  });

  describe('Monitoring Integration', () => {
    it('should expose sync status for monitoring endpoint', async () => {
      scheduler = new DailySyncScheduler(testConfig);
      
      // Mock checkForNewData to return true
      vi.spyOn(scheduler, 'checkForNewData').mockResolvedValueOnce(true);
      
      // Mock getDateRangeForSync
      vi.spyOn(scheduler as any, 'getDateRangeForSync').mockResolvedValueOnce({
        start: new Date('2025-08-14'),
        end: new Date('2025-08-21'),
      });
      
      await scheduler.executeSyncJob();

      const status = await scheduler.getSyncStatus();

      expect(status).toHaveProperty('isRunning', false);
      // The currentSyncId is cleared after execution
      expect(status.currentSyncId).toBeUndefined();
    });

    it('should track sync metrics', async () => {
      scheduler = new DailySyncScheduler(testConfig);
      await scheduler.executeSyncJob();

      const metrics = await scheduler.getSyncMetrics({ days: 7 });

      expect(metrics).toMatchObject({
        totalSyncs: expect.any(Number),
        successfulSyncs: expect.any(Number),
        failedSyncs: expect.any(Number),
        averageDuration: expect.any(Number),
        totalRecordsProcessed: expect.any(Number),
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty data gracefully', async () => {
      mockSync.syncPeriodData.mockResolvedValueOnce({
        success: true,
        recordsSynced: 0,
        errors: [],
      });

      scheduler = new DailySyncScheduler(testConfig);
      
      // Mock checkForNewData to return true
      vi.spyOn(scheduler, 'checkForNewData').mockResolvedValueOnce(true);
      
      // Mock getDateRangeForSync
      vi.spyOn(scheduler as any, 'getDateRangeForSync').mockResolvedValueOnce({
        start: new Date('2025-08-14'),
        end: new Date('2025-08-21'),
      });
      
      const result = await scheduler.executeSyncJob();

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(0);
    });

    it('should handle partial sync failures', async () => {
      // Mock sync to always return failure
      mockSync.syncPeriodData
        .mockResolvedValueOnce({
          success: false,
          recordsSynced: 500,
          errors: ['Failed to sync 500 records'],
        })
        .mockResolvedValueOnce({
          success: false,
          recordsSynced: 500,
          errors: ['Failed to sync 500 records'],
        })
        .mockResolvedValueOnce({
          success: false,
          recordsSynced: 500,
          errors: ['Failed to sync 500 records'],
        });

      scheduler = new DailySyncScheduler(testConfig);
      
      // Mock checkForNewData to return true
      vi.spyOn(scheduler, 'checkForNewData').mockResolvedValueOnce(true);
      
      // Mock getDateRangeForSync
      vi.spyOn(scheduler as any, 'getDateRangeForSync').mockResolvedValueOnce({
        start: new Date('2025-08-14'),
        end: new Date('2025-08-21'),
      });
      
      const result = await scheduler.executeSyncJob();

      expect(result.success).toBe(false);
      expect(result.retryCount).toBe(3);
      expect(result.error).toContain('Failed to sync 500 records');
    });

    it('should prevent concurrent sync runs', async () => {
      scheduler = new DailySyncScheduler(testConfig);
      
      // Start first sync
      const sync1 = scheduler.executeSyncJob();
      
      // Try to start second sync immediately
      const sync2 = scheduler.executeSyncJob();

      const result2 = await sync2;
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('already in progress');

      await sync1; // Clean up
    });
  });
});