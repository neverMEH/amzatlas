import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PipelineOrchestrator } from '../pipeline-orchestrator';
import { PipelineConfig, PipelineStep, PipelineResult } from '../types/pipeline';
import { BigQueryClient } from '../client';
import { DataExtractor } from '../data-extractor';
import { DataTransformer } from '../data-transformer';
import { BigQueryToSupabaseSync } from '../bigquery-to-supabase-sync';
import { PipelineStateManager } from '../state-manager';
import { PipelineMonitor } from '../monitor';

// Mock dependencies
vi.mock('../client');
vi.mock('../data-extractor');
vi.mock('../data-transformer');
vi.mock('../bigquery-to-supabase-sync');
vi.mock('../state-manager');
vi.mock('../monitor');

describe('PipelineOrchestrator', () => {
  let orchestrator: PipelineOrchestrator;
  let mockClient: any;
  let mockExtractor: any;
  let mockTransformer: any;
  let mockSync: any;
  let mockStateManager: any;
  let mockMonitor: any;

  const testConfig: PipelineConfig = {
    name: 'test-pipeline',
    schedule: '0 */6 * * *', // Every 6 hours
    maxRetries: 3,
    retryDelayMs: 1000,
    steps: [
      {
        name: 'extract',
        type: 'extract',
        config: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          batchSize: 1000
        }
      },
      {
        name: 'transform',
        type: 'transform',
        config: {
          aggregationLevel: 'daily'
        }
      },
      {
        name: 'load',
        type: 'load',
        config: {
          targetTable: 'sqp_daily_summary'
        }
      }
    ],
    monitoring: {
      enableAlerts: true,
      alertThresholds: {
        errorRate: 0.05,
        executionTime: 3600000, // 1 hour
        dataFreshness: 86400000 // 24 hours
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      query: vi.fn().mockResolvedValue([]),
      close: vi.fn()
    };

    mockExtractor = {
      extract: vi.fn().mockResolvedValue({
        data: [],
        metadata: { recordCount: 0 }
      })
    };

    mockTransformer = {
      transform: vi.fn().mockResolvedValue({
        data: [],
        metadata: { recordCount: 0 }
      })
    };

    mockSync = {
      syncToBigQuery: vi.fn().mockResolvedValue({
        success: true,
        recordsProcessed: 0
      })
    };

    mockStateManager = {
      getState: vi.fn().mockResolvedValue({
        lastRunTime: null,
        lastSuccessTime: null,
        status: 'idle'
      }),
      updateState: vi.fn().mockResolvedValue(undefined),
      lockPipeline: vi.fn().mockResolvedValue(true),
      unlockPipeline: vi.fn().mockResolvedValue(undefined),
      saveStepData: vi.fn().mockResolvedValue(undefined),
      getRecoveryPoint: vi.fn().mockResolvedValue({
        canRecover: false,
        lastCompletedStep: null,
        nextStep: null,
        stepData: {}
      })
    };

    mockMonitor = {
      startPipeline: vi.fn().mockResolvedValue('test-run-id'),
      endPipeline: vi.fn().mockResolvedValue(undefined),
      recordStepMetrics: vi.fn().mockResolvedValue(undefined),
      recordError: vi.fn().mockResolvedValue(undefined),
      checkAlerts: vi.fn().mockResolvedValue([]),
      log: vi.fn().mockResolvedValue(undefined),
      getCurrentMetrics: vi.fn().mockResolvedValue({
        pipelineId: 'test-pipeline',
        runId: 'test-run-id',
        status: 'running',
        startTime: new Date(),
        steps: {}
      })
    };

    // Mock constructor implementations
    (BigQueryClient as any).mockImplementation(() => mockClient);
    (DataExtractor as any).mockImplementation(() => mockExtractor);
    (DataTransformer as any).mockImplementation(() => mockTransformer);
    (BigQueryToSupabaseSync as any).mockImplementation(() => mockSync);
    (PipelineStateManager as any).mockImplementation(() => mockStateManager);
    (PipelineMonitor as any).mockImplementation(() => mockMonitor);

    orchestrator = new PipelineOrchestrator(testConfig);
  });

  afterEach(() => {
    if (orchestrator) {
      orchestrator.shutdown();
    }
  });

  describe('Pipeline Execution', () => {
    it('should execute all pipeline steps successfully', async () => {
      const mockExtractData = [
        { asin: 'B001', keyword: 'test', impressions: 100 }
      ];
      const mockTransformData = [
        { asin: 'B001', total_impressions: 100, avg_ctr: 0.05 }
      ];

      mockExtractor.extract.mockResolvedValue({
        data: mockExtractData,
        metadata: { recordCount: 1 }
      });

      mockTransformer.transform.mockResolvedValue({
        data: mockTransformData,
        metadata: { recordCount: 1 }
      });

      const result = await orchestrator.execute();

      expect(result.success).toBe(true);
      expect(result.stepsCompleted).toBe(3);
      expect(mockExtractor.extract).toHaveBeenCalledTimes(1);
      expect(mockTransformer.transform).toHaveBeenCalledWith(mockExtractData);
      expect(mockSync.syncToBigQuery).toHaveBeenCalledWith(mockTransformData, 'sqp_daily_summary');
      expect(mockMonitor.endPipeline).toHaveBeenCalledWith('success');
    });

    it('should handle step failures with retry logic', async () => {
      mockExtractor.extract
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          data: [],
          metadata: { recordCount: 0 }
        });

      const result = await orchestrator.execute();

      expect(result.success).toBe(true);
      expect(mockExtractor.extract).toHaveBeenCalledTimes(3);
      expect(mockMonitor.recordError).toHaveBeenCalledTimes(2);
    });

    it('should fail after maximum retries exceeded', async () => {
      mockExtractor.extract.mockRejectedValue(new Error('Persistent failure'));

      const result = await orchestrator.execute();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Step extract failed after 3 retries: Persistent failure');
      expect(mockExtractor.extract).toHaveBeenCalledTimes(4); // Initial + 3 retries
      expect(mockMonitor.endPipeline).toHaveBeenCalledWith('failed');
    });

    it('should prevent concurrent pipeline executions', async () => {
      mockStateManager.lockPipeline
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const promise1 = orchestrator.execute();
      const promise2 = orchestrator.execute();

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Pipeline is already running');
    });
  });

  describe('Step Dependencies', () => {
    it('should respect step dependencies and execution order', async () => {
      const executionOrder: string[] = [];

      mockExtractor.extract.mockImplementation(async () => {
        executionOrder.push('extract');
        return { data: [], metadata: { recordCount: 0 } };
      });

      mockTransformer.transform.mockImplementation(async () => {
        executionOrder.push('transform');
        return { data: [], metadata: { recordCount: 0 } };
      });

      mockSync.syncToBigQuery.mockImplementation(async () => {
        executionOrder.push('load');
        return { success: true, recordsProcessed: 0 };
      });

      await orchestrator.execute();

      expect(executionOrder).toEqual(['extract', 'transform', 'load']);
    });

    it('should skip dependent steps if parent step fails', async () => {
      mockExtractor.extract.mockRejectedValue(new Error('Extract failed'));

      const result = await orchestrator.execute();

      expect(result.success).toBe(false);
      expect(mockTransformer.transform).not.toHaveBeenCalled();
      expect(mockSync.syncToBigQuery).not.toHaveBeenCalled();
    });
  });

  describe('State Management', () => {
    it('should update pipeline state throughout execution', async () => {
      await orchestrator.execute();

      expect(mockStateManager.updateState).toHaveBeenCalledWith({
        status: 'running',
        currentStep: 'extract'
      });
      expect(mockStateManager.updateState).toHaveBeenCalledWith({
        status: 'running',
        currentStep: 'transform'
      });
      expect(mockStateManager.updateState).toHaveBeenCalledWith({
        status: 'running',
        currentStep: 'load'
      });
      expect(mockStateManager.updateState).toHaveBeenCalledWith({
        status: 'completed',
        lastSuccessTime: expect.any(Date)
      });
    });

    it('should handle state recovery from previous failures', async () => {
      mockStateManager.getState.mockResolvedValue({
        lastRunTime: new Date('2024-01-01T00:00:00Z'),
        lastSuccessTime: new Date('2023-12-31T00:00:00Z'),
        status: 'failed',
        currentStep: 'transform',
        stepData: {
          extract: { completed: true, data: [] }
        }
      });

      await orchestrator.execute({ resumeFromFailure: true });

      expect(mockExtractor.extract).not.toHaveBeenCalled();
      expect(mockTransformer.transform).toHaveBeenCalled();
    });
  });

  describe('Monitoring and Alerting', () => {
    it('should track metrics for each pipeline step', async () => {
      await orchestrator.execute();

      expect(mockMonitor.recordStepMetrics).toHaveBeenCalledWith('extract', {
        duration: expect.any(Number),
        recordsProcessed: 0,
        success: true
      });
      expect(mockMonitor.recordStepMetrics).toHaveBeenCalledWith('transform', {
        duration: expect.any(Number),
        recordsProcessed: 0,
        success: true
      });
      expect(mockMonitor.recordStepMetrics).toHaveBeenCalledWith('load', {
        duration: expect.any(Number),
        recordsProcessed: 0,
        success: true
      });
    });

    it('should trigger alerts when thresholds are exceeded', async () => {
      mockMonitor.checkAlerts.mockResolvedValue([
        {
          type: 'execution_time',
          severity: 'warning',
          message: 'Pipeline execution time exceeded threshold'
        }
      ]);

      const result = await orchestrator.execute();

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].type).toBe('execution_time');
    });

    it('should record errors with context', async () => {
      const testError = new Error('Test error');
      mockExtractor.extract.mockRejectedValue(testError);

      await orchestrator.execute();

      expect(mockMonitor.recordError).toHaveBeenCalledWith({
        step: 'extract',
        error: testError,
        context: {
          config: testConfig.steps[0].config,
          retryCount: expect.any(Number)
        }
      });
    });
  });

  describe('Scheduling', () => {
    it('should parse cron expression correctly', () => {
      const schedule = orchestrator.getSchedule();
      expect(schedule.expression).toBe('0 */6 * * *');
      expect(schedule.nextRun).toBeInstanceOf(Date);
    });

    it('should calculate next run time accurately', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      const nextRun = orchestrator.calculateNextRun(now);
      expect(nextRun).toEqual(new Date('2024-01-01T18:00:00Z'));
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ENETWORK';
      mockExtractor.extract.mockRejectedValue(networkError);

      const result = await orchestrator.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
      expect(mockMonitor.recordError).toHaveBeenCalledWith(
        expect.objectContaining({
          error: networkError,
          step: 'extract'
        })
      );
    });

    it('should handle quota errors with backoff', async () => {
      const quotaError = new Error('Quota exceeded');
      (quotaError as any).code = 'QUOTA_EXCEEDED';
      mockExtractor.extract
        .mockRejectedValueOnce(quotaError)
        .mockResolvedValueOnce({
          data: [],
          metadata: { recordCount: 0 }
        });

      const result = await orchestrator.execute();

      expect(result.success).toBe(true);
      // Verify backoff was applied
      expect(mockExtractor.extract).toHaveBeenCalledTimes(2);
    });

    it('should handle authentication errors without retry', async () => {
      const authError = new Error('Authentication failed');
      (authError as any).code = 'UNAUTHENTICATED';
      mockExtractor.extract.mockRejectedValue(authError);

      const result = await orchestrator.execute();

      expect(result.success).toBe(false);
      expect(mockExtractor.extract).toHaveBeenCalledTimes(1); // No retries
      expect(result.error).toContain('Authentication failed');
    });
  });

  describe('Data Quality Checks', () => {
    it('should validate data quality between steps', async () => {
      const invalidData = [
        { asin: null, keyword: 'test', impressions: -100 }
      ];

      mockExtractor.extract.mockResolvedValue({
        data: invalidData,
        metadata: { recordCount: 1 }
      });

      const result = await orchestrator.execute();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Data quality check failed');
      expect(mockTransformer.transform).not.toHaveBeenCalled();
    });

    it('should detect data freshness issues', async () => {
      mockExtractor.extract.mockResolvedValue({
        data: [],
        metadata: { 
          recordCount: 0,
          lastDataTimestamp: new Date('2023-01-01')
        }
      });

      const result = await orchestrator.execute();

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          type: 'stale_data',
          message: expect.stringContaining('Data is older than expected')
        })
      );
    });
  });

  describe('Shutdown and Cleanup', () => {
    it('should gracefully shutdown all components', async () => {
      orchestrator.shutdown();

      expect(mockClient.close).toHaveBeenCalled();
      expect(mockStateManager.unlockPipeline).toHaveBeenCalled();
    });

    it('should handle shutdown during pipeline execution', async () => {
      const executionPromise = orchestrator.execute();
      
      // Shutdown after a small delay
      setTimeout(() => orchestrator.shutdown(), 10);

      const result = await executionPromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Pipeline shutdown requested');
    });
  });
});