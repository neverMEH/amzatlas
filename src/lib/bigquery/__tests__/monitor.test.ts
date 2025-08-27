import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PipelineMonitor } from '../monitor';
import { 
  MonitorConfig, 
  PipelineMetrics, 
  Alert, 
  AlertType,
  LogLevel 
} from '../types/pipeline';

// Mock external dependencies
vi.mock('@google-cloud/logging', () => ({
  Logging: vi.fn(() => ({
    log: vi.fn(() => ({
      write: vi.fn().mockResolvedValue(undefined),
      entry: vi.fn((metadata: any, data: any) => ({ metadata, data }))
    }))
  }))
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      not: vi.fn().mockReturnThis()
    }))
  }))
}));

describe('PipelineMonitor', () => {
  let monitor: PipelineMonitor;
  let mockCloudLogging: any;
  let mockSupabase: any;

  const testConfig: MonitorConfig = {
    pipelineId: 'test-pipeline',
    enableCloudLogging: true,
    enableMetrics: true,
    enableAlerts: true,
    alertThresholds: {
      errorRate: 0.05, // 5%
      executionTime: 3600000, // 1 hour
      dataFreshness: 86400000, // 24 hours
      memoryUsage: 1024 * 1024 * 1024, // 1GB
      queueDepth: 1000
    },
    alertChannels: ['email', 'slack'],
    logLevel: 'info' as LogLevel
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    mockSupabase = createClient('test-url', 'test-key');
    monitor = new PipelineMonitor(testConfig);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Pipeline Lifecycle Monitoring', () => {
    it('should start pipeline monitoring session', async () => {
      const runId = await monitor.startPipeline();

      expect(runId).toBeDefined();
      expect(typeof runId).toBe('string');

      const metrics = await monitor.getCurrentMetrics();
      expect(metrics.status).toBe('running');
      expect(metrics.startTime).toBeInstanceOf(Date);
    });

    it('should end pipeline monitoring with success', async () => {
      const runId = await monitor.startPipeline();
      await monitor.endPipeline('success');

      const metrics = await monitor.getCurrentMetrics();
      expect(metrics.status).toBe('completed');
      expect(metrics.endTime).toBeInstanceOf(Date);
      expect(metrics.duration).toBeGreaterThanOrEqual(0);
    });

    it('should track pipeline failures', async () => {
      await monitor.startPipeline();
      await monitor.endPipeline('failed', 'Test error message');

      const metrics = await monitor.getCurrentMetrics();
      expect(metrics.status).toBe('failed');
      expect(metrics.error).toBe('Test error message');
    });
  });

  describe('Step Metrics', () => {
    it('should record step execution metrics', async () => {
      await monitor.startPipeline();

      await monitor.recordStepMetrics('extract', {
        duration: 5000,
        recordsProcessed: 1000,
        success: true
      });

      await monitor.recordStepMetrics('transform', {
        duration: 3000,
        recordsProcessed: 950,
        success: true
      });

      const metrics = await monitor.getCurrentMetrics();
      expect(metrics.steps.extract).toEqual({
        duration: 5000,
        recordsProcessed: 1000,
        success: true
      });
      expect(metrics.steps.transform).toEqual({
        duration: 3000,
        recordsProcessed: 950,
        success: true
      });
    });

    it('should calculate cumulative metrics', async () => {
      await monitor.startPipeline();

      await monitor.recordStepMetrics('extract', {
        duration: 5000,
        recordsProcessed: 1000,
        success: true
      });

      await monitor.recordStepMetrics('transform', {
        duration: 3000,
        recordsProcessed: 950,
        success: true
      });

      // Need to end pipeline to calculate total duration
      await monitor.endPipeline('success');

      const summary = await monitor.getSummary();
      expect(summary.totalRecordsProcessed).toBe(1950);
      expect(summary.totalDuration).toBeGreaterThanOrEqual(0); // Duration depends on actual time elapsed
      expect(summary.successRate).toBe(1.0);
    });
  });

  describe('Error Tracking', () => {
    it('should record errors with context', async () => {
      const testError = new Error('Test error');
      const mockErrorData = {
        timestamp: new Date().toISOString(),
        step: 'extract',
        error: 'Test error',
        stack: testError.stack,
        context: {
          query: 'SELECT * FROM table',
          retryCount: 2
        }
      };

      // Mock the getRecentErrors response
      mockSupabase.from().select.mockReturnThis();
      mockSupabase.from().eq.mockReturnThis();
      mockSupabase.from().order.mockReturnThis();
      mockSupabase.from().limit.mockResolvedValue({
        data: [mockErrorData],
        error: null
      });

      await monitor.recordError({
        step: 'extract',
        error: testError,
        context: {
          query: 'SELECT * FROM table',
          retryCount: 2
        }
      });

      const errors = await monitor.getRecentErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        timestamp: expect.any(Date),
        step: 'extract',
        error: 'Test error',
        stack: expect.any(String),
        context: {
          query: 'SELECT * FROM table',
          retryCount: 2
        }
      });
    });

    it('should calculate error rate', async () => {
      // Mock the pipeline metrics data for error rate calculation
      const mockMetricsData = [];
      
      // Add 95 successful steps
      for (let i = 0; i < 19; i++) {
        mockMetricsData.push({
          steps: {
            extract: { duration: 1000, recordsProcessed: 10, success: true },
            transform: { duration: 1000, recordsProcessed: 10, success: true },
            load: { duration: 1000, recordsProcessed: 10, success: true },
            validate: { duration: 1000, recordsProcessed: 10, success: true },
            finalize: { duration: 1000, recordsProcessed: 10, success: true }
          }
        });
      }
      
      // Add 1 run with a failed step (5% error rate: 5 failed out of 100 total)
      mockMetricsData.push({
        steps: {
          extract: { duration: 1000, recordsProcessed: 10, success: true },
          transform: { duration: 1000, recordsProcessed: 10, success: true },
          load: { duration: 1000, recordsProcessed: 10, success: false },
          validate: { duration: 1000, recordsProcessed: 10, success: false },
          finalize: { duration: 1000, recordsProcessed: 10, success: false }
        }
      });

      mockSupabase.from().select.mockReturnThis();
      mockSupabase.from().eq.mockReturnThis();
      mockSupabase.from().order.mockReturnThis();
      mockSupabase.from().limit.mockResolvedValue({
        data: mockMetricsData,
        error: null
      });

      const errorRate = await monitor.getErrorRate();
      expect(errorRate).toBeCloseTo(0.05, 2);
    });
  });

  describe('Alerting System', () => {
    it('should trigger alert for high error rate', async () => {
      await monitor.startPipeline();

      // Simulate high error rate
      for (let i = 0; i < 10; i++) {
        if (i < 4) {
          await monitor.recordError({
            step: 'extract',
            error: new Error('Test error')
          });
        } else {
          await monitor.recordStepMetrics('extract', {
            duration: 1000,
            recordsProcessed: 100,
            success: true
          });
        }
      }

      const alerts = await monitor.checkAlerts();
      expect(alerts).toContainEqual(
        expect.objectContaining({
          type: 'error_rate',
          severity: 'critical',
          message: expect.stringContaining('Error rate')
        })
      );
    });

    it('should trigger alert for slow execution', async () => {
      await monitor.startPipeline();

      // Simulate slow execution
      vi.advanceTimersByTime(3700000); // 1 hour 10 minutes

      const alerts = await monitor.checkAlerts();
      expect(alerts).toContainEqual(
        expect.objectContaining({
          type: 'execution_time',
          severity: 'warning',
          message: expect.stringContaining('Execution time exceeded')
        })
      );
    });

    it('should trigger alert for stale data', async () => {
      await monitor.updateDataFreshness(new Date('2024-01-01T00:00:00Z'));
      
      vi.setSystemTime(new Date('2024-01-03T00:00:00Z'));

      const alerts = await monitor.checkAlerts();
      expect(alerts).toContainEqual(
        expect.objectContaining({
          type: 'data_freshness',
          severity: 'warning',
          message: expect.stringContaining('Data is stale')
        })
      );
    });

    it('should send alerts to configured channels', async () => {
      const mockEmailSender = vi.fn().mockResolvedValue(true);
      const mockSlackSender = vi.fn().mockResolvedValue(true);

      monitor.registerAlertChannel('email', mockEmailSender);
      monitor.registerAlertChannel('slack', mockSlackSender);

      const alert: Alert = {
        type: 'error_rate',
        severity: 'critical',
        message: 'High error rate detected',
        timestamp: new Date(),
        metadata: { errorRate: 0.15 }
      };

      await monitor.sendAlert(alert);

      expect(mockEmailSender).toHaveBeenCalledWith(alert);
      expect(mockSlackSender).toHaveBeenCalledWith(alert);
    });
  });

  describe('Logging', () => {
    it('should log events at appropriate levels', async () => {
      const logSpy = vi.spyOn(monitor as any, 'writeLog');

      await monitor.log('info', 'Pipeline started', { runId: '123' });
      await monitor.log('warning', 'Slow query detected', { duration: 5000 });
      await monitor.log('error', 'Query failed', { error: 'Timeout' });

      expect(logSpy).toHaveBeenCalledTimes(3);
      expect(logSpy).toHaveBeenCalledWith('info', expect.any(String), expect.any(Object));
      expect(logSpy).toHaveBeenCalledWith('warning', expect.any(String), expect.any(Object));
      expect(logSpy).toHaveBeenCalledWith('error', expect.any(String), expect.any(Object));
    });

    it('should respect log level configuration', async () => {
      const warnMonitor = new PipelineMonitor({
        ...testConfig,
        logLevel: 'warning'
      });

      const logSpy = vi.spyOn(warnMonitor as any, 'writeLog');

      await warnMonitor.log('debug', 'Debug message');
      await warnMonitor.log('info', 'Info message');
      await warnMonitor.log('warning', 'Warning message');
      await warnMonitor.log('error', 'Error message');

      expect(logSpy).toHaveBeenCalledTimes(2); // Only warning and error
    });
  });

  describe('Metrics Dashboard', () => {
    it('should provide dashboard metrics', async () => {
      await monitor.startPipeline();

      await monitor.recordStepMetrics('extract', {
        duration: 5000,
        recordsProcessed: 1000,
        success: true
      });

      const dashboard = await monitor.getDashboardMetrics();

      expect(dashboard).toEqual({
        currentStatus: 'running',
        uptime: expect.any(Number),
        totalRuns: expect.any(Number),
        successRate: expect.any(Number),
        averageExecutionTime: expect.any(Number),
        recentErrors: expect.any(Array),
        activeAlerts: expect.any(Array),
        dataFreshness: expect.any(Date)
      });
    });

    it('should track historical metrics', async () => {
      const mockHistoricalData = [
        { timestamp: new Date('2024-01-01'), duration: 3000, success: true },
        { timestamp: new Date('2024-01-02'), duration: 3500, success: true },
        { timestamp: new Date('2024-01-03'), duration: 4000, success: false }
      ];

      vi.spyOn(monitor as any, 'queryHistoricalMetrics').mockResolvedValue(mockHistoricalData);

      const history = await monitor.getHistoricalMetrics({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-03'),
        interval: 'daily'
      });

      expect(history).toHaveLength(3);
      expect(history[0].duration).toBe(3000);
    });
  });

  describe('Resource Monitoring', () => {
    it('should track memory usage', async () => {
      const mockMemoryUsage = {
        rss: 512 * 1024 * 1024, // 512MB
        heapTotal: 256 * 1024 * 1024,
        heapUsed: 128 * 1024 * 1024,
        external: 64 * 1024 * 1024
      };

      vi.spyOn(process, 'memoryUsage').mockReturnValue(mockMemoryUsage as any);

      await monitor.recordResourceMetrics();

      const resources = await monitor.getResourceMetrics();
      expect(resources.memory.rss).toBe(512 * 1024 * 1024);
      expect(resources.memory.heapUsed).toBe(128 * 1024 * 1024);
    });

    it('should alert on high memory usage', async () => {
      const mockMemoryUsage = {
        rss: 1.5 * 1024 * 1024 * 1024, // 1.5GB
        heapTotal: 1 * 1024 * 1024 * 1024,
        heapUsed: 900 * 1024 * 1024,
        external: 100 * 1024 * 1024
      };

      vi.spyOn(process, 'memoryUsage').mockReturnValue(mockMemoryUsage as any);

      await monitor.recordResourceMetrics();
      const alerts = await monitor.checkAlerts();

      expect(alerts).toContainEqual(
        expect.objectContaining({
          type: 'memory_usage',
          severity: 'warning',
          message: expect.stringContaining('Memory usage high')
        })
      );
    });
  });

  describe('Performance Analysis', () => {
    it('should detect performance degradation', async () => {
      // Simulate historical baseline
      const baseline = {
        averageDuration: 5000,
        standardDeviation: 500
      };

      vi.spyOn(monitor as any, 'getPerformanceBaseline').mockResolvedValue(baseline);

      // Record slow execution
      await monitor.recordStepMetrics('extract', {
        duration: 8000, // Significantly slower than baseline
        recordsProcessed: 1000,
        success: true
      });

      const analysis = await monitor.analyzePerformance();
      expect(analysis.isAnomalous).toBe(true);
      expect(analysis.deviationFromBaseline).toBeGreaterThan(2); // More than 2 standard deviations
    });

    it('should track throughput metrics', async () => {
      await monitor.startPipeline();

      const startTime = Date.now();
      vi.advanceTimersByTime(10000); // 10 seconds

      await monitor.recordStepMetrics('extract', {
        duration: 10000,
        recordsProcessed: 1000,
        success: true
      });

      const throughput = await monitor.getThroughput();
      expect(throughput).toBeCloseTo(100, 1); // 100 records per second
    });
  });

  describe('Cleanup and Maintenance', () => {
    it('should clean up old metrics data', async () => {
      const deleteSpy = vi.fn().mockReturnThis();
      const ltSpy = vi.fn().mockResolvedValue({ error: null });
      
      const mockFrom = vi.fn(() => ({
        delete: deleteSpy,
        lt: ltSpy,
        eq: vi.fn().mockReturnThis()
      }));

      monitor['supabase'] = {
        from: mockFrom
      } as any;

      await monitor.cleanupOldData({ daysToKeep: 30 });

      expect(mockFrom).toHaveBeenCalledTimes(3); // For metrics, errors, and logs
      expect(deleteSpy).toHaveBeenCalledTimes(3);
    });

    it('should export metrics for analysis', async () => {
      await monitor.startPipeline();
      
      await monitor.recordStepMetrics('extract', {
        duration: 5000,
        recordsProcessed: 1000,
        success: true
      });

      const exported = await monitor.exportMetrics({
        format: 'json',
        includeRawData: true
      });

      expect(exported).toHaveProperty('summary');
      expect(exported).toHaveProperty('steps');
      expect(exported).toHaveProperty('errors');
      expect(exported).toHaveProperty('alerts');
    });
  });
});