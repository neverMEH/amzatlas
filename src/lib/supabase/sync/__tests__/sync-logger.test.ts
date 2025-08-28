import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncLogger, SyncLogEntry, DataQualityCheck } from '../sync-logger';
import { createClient } from '@supabase/supabase-js';

vi.mock('@supabase/supabase-js');

describe('SyncLogger', () => {
  let logger: SyncLogger;
  let mockSupabaseClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    const createMockChain = (finalValue: any = { data: null, error: null }) => {
      const chain: any = {
        from: vi.fn(() => chain),
        insert: vi.fn(() => chain),
        update: vi.fn(() => chain),
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        gte: vi.fn(() => chain),
        lt: vi.fn(() => chain),
        order: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        single: vi.fn(() => Promise.resolve(finalValue)),
        delete: vi.fn(() => chain),
      };
      return chain;
    };
    
    mockSupabaseClient = createMockChain();
    mockSupabaseClient.from = vi.fn((table: string) => {
      const chain = createMockChain({ data: [{ id: 1 }], error: null });
      
      // For insert operations, we need to support chaining with select
      chain.insert = vi.fn(() => {
        const insertChain = { ...chain };
        insertChain.select = vi.fn(() => {
          const selectChain = { ...insertChain };
          selectChain.single = vi.fn(async () => ({ data: { id: 1 }, error: null }));
          return selectChain;
        });
        // Support direct promise resolution too
        insertChain.then = async (cb: any) => {
          const result = { data: [{ id: 1 }], error: null };
          return cb(result);
        };
        return insertChain;
      });
      
      // For single calls without insert
      chain.single = vi.fn(async () => ({ data: { id: 1 }, error: null }));
      
      // For update operations
      chain.update = vi.fn(() => {
        const updateChain = createMockChain({ data: [{ id: 1 }], error: null });
        updateChain.eq = vi.fn(() => ({ 
          data: [{ id: 1 }], 
          error: null,
          then: async (cb: any) => cb({ data: [{ id: 1 }], error: null })
        }));
        return updateChain;
      });
      
      return chain;
    });
    
    vi.mocked(createClient).mockReturnValue(mockSupabaseClient);
    
    logger = new SyncLogger(mockSupabaseClient);
  });

  describe('Sync Logging', () => {
    it('should create a new sync log entry', async () => {
      const logEntry: SyncLogEntry = {
        sync_type: 'weekly',
        sync_status: 'started',
        source_table: 'bigquery.sqp_data',
        target_table: 'sqp.weekly_summary',
        period_start: new Date('2025-08-14'),
        period_end: new Date('2025-08-21'),
      };

      const logId = await logger.startSync(logEntry);

      expect(logId).toBe(1);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('sqp.sync_log');
    });

    it('should update sync log with completion status', async () => {
      const logId = 1;
      const result = {
        records_processed: 1000,
        records_inserted: 800,
        records_updated: 200,
        records_failed: 0,
      };

      await logger.completeSync(logId, result);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('sqp.sync_log');
      // The chain creates a new object, so check the from().update() was called
      const fromCall = mockSupabaseClient.from.mock.results[0].value;
      expect(fromCall.update).toHaveBeenCalled();
    });

    it('should handle sync failures', async () => {
      const logId = 1;
      const error = new Error('BigQuery connection timeout');
      
      await logger.failSync(logId, error, {
        records_processed: 500,
        partial: true,
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('sqp.sync_log');
    });
  });

  describe('Data Quality Checks', () => {
    it('should log data quality check results', async () => {
      const syncLogId = 1;
      const check: DataQualityCheck = {
        check_type: 'row_count',
        check_status: 'passed',
        source_value: 1000,
        target_value: 1000,
        difference: 0,
        difference_pct: 0,
        table_name: 'sqp.weekly_summary',
      };

      await logger.logDataQualityCheck(syncLogId, check);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('sqp.data_quality_checks');
    });

    it('should batch log multiple quality checks', async () => {
      const syncLogId = 1;
      const checks: DataQualityCheck[] = [
        {
          check_type: 'row_count',
          check_status: 'passed',
          source_value: 1000,
          target_value: 1000,
        },
        {
          check_type: 'sum_validation',
          check_status: 'warning',
          source_value: 50000,
          target_value: 49998,
          difference: 2,
          difference_pct: 0.004,
          column_name: 'total_impressions',
        },
        {
          check_type: 'null_check',
          check_status: 'failed',
          source_value: 0,
          target_value: 5,
          column_name: 'asin',
          check_message: 'Found 5 null ASINs',
        },
      ];

      await logger.logDataQualityChecks(syncLogId, checks);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('sqp.data_quality_checks');
    });
  });

  describe('Error Tracking', () => {
    it('should aggregate error types', () => {
      const errors = [
        { type: 'validation', count: 10 },
        { type: 'constraint', count: 5 },
        { type: 'network', count: 2 },
      ];

      const summary = logger.summarizeErrors(errors);

      expect(summary).toEqual({
        total: 17,
        byType: {
          validation: 10,
          constraint: 5,
          network: 2,
        },
        mostCommon: 'validation',
      });
    });
  });

  describe('Sync Metrics', () => {
    it('should calculate sync duration', () => {
      const startTime = new Date('2025-08-28T02:00:00Z');
      const endTime = new Date('2025-08-28T02:05:30Z');
      
      const duration = logger.calculateDuration(startTime, endTime);
      
      expect(duration).toEqual({
        seconds: 330,
        minutes: 5.5,
        formatted: '5m 30s',
      });
    });
  });

  describe('Cleanup', () => {
    it('should clean up old sync logs', async () => {
      await logger.cleanupOldLogs({ retentionDays: 30 });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('sqp.sync_log');
    });
  });
});