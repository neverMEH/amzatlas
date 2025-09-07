import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SQPDataExtractor } from '../extractors/sqp-data-extractor';
import { BigQueryClient } from '../client';
import { BigQueryConnectionPool } from '../connection-pool';
import { DataValidator } from '../validators/data-validator';

// Mock dependencies
vi.mock('../client');
vi.mock('../connection-pool');
vi.mock('../validators/data-validator');
vi.mock('@/config/bigquery.config', () => ({
  getBigQueryConfig: vi.fn(() => ({
    projectId: 'test-project',
    dataset: 'test_dataset',
    location: 'US',
  })),
  getTableNames: vi.fn(() => ({
    sqpRaw: 'sqp_raw_test',
    sqpProcessed: 'sqp_processed_test',
    sqpMetrics: 'sqp_metrics_test',
    processingLogs: 'processing_logs_test',
  })),
  getFullTableName: vi.fn((tableName: string) => `test-project.test_dataset.${tableName}`),
}));

describe('SQPDataExtractor', () => {
  let extractor: SQPDataExtractor;
  let mockPool: any;
  let mockClient: any;
  let mockValidator: any;

  beforeEach(() => {
    // Setup mocks
    mockClient = {
      query: vi.fn(),
      estimateQueryCost: vi.fn(),
    };

    mockPool = {
      withClient: vi.fn((callback) => callback(mockClient)),
      acquire: vi.fn().mockResolvedValue(mockClient),
      release: vi.fn(),
    };

    mockValidator = {
      validateSQPRecord: vi.fn().mockReturnValue({ valid: true }),
      validateBatch: vi.fn().mockReturnValue({ valid: true, errors: [] }),
    };

    (BigQueryConnectionPool as any).mockReturnValue(mockPool);
    (DataValidator as any).mockReturnValue(mockValidator);

    extractor = new SQPDataExtractor(mockPool);
  });

  describe('Basic Extraction', () => {
    it('should extract SQP data for date range', async () => {
      const mockData = [
        {
          query: 'yoga mat',
          asin: 'B001234567',
          impressions: 1000,
          clicks: 50,
          purchases: 5,
          query_date: '2024-01-15',
        },
      ];

      mockClient.query.mockResolvedValue(mockData);

      const result = await extractor.extractSQPData({
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      expect(result.data).toEqual(mockData);
      expect(result.recordCount).toBe(1);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        })
      );
    });

    it('should handle empty results', async () => {
      mockClient.query.mockResolvedValue([]);

      const result = await extractor.extractSQPData({
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      expect(result.data).toEqual([]);
      expect(result.recordCount).toBe(0);
    });

    it('should apply filters correctly', async () => {
      mockClient.query.mockResolvedValue([]);
      
      await extractor.extractSQPData({
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        asins: ['B001234567'],
        keywords: ['yoga mat'],
        minImpressions: 100,
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          asins: ['B001234567'],
          keywords: ['yoga mat'],
          minImpressions: 100,
        })
      );
    });
  });

  describe('Streaming Extraction', () => {
    it('should stream large datasets', async () => {
      const chunks: any[] = [];
      let processedCount = 0;

      // Mock the query to return data
      mockClient.query.mockResolvedValue(new Array(1000).fill({ id: 1 }));
      
      await extractor.streamSQPData(
        {
          dateRange: {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
          },
        },
        {
          onData: (chunk) => {
            chunks.push(chunk);
            processedCount += chunk.length;
          },
          onProgress: vi.fn(),
          batchSize: 1000,
        }
      );

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should report progress during streaming', async () => {
      const onProgress = vi.fn();
      
      // Simulate multiple batches
      mockClient.query
        .mockResolvedValueOnce(new Array(1000).fill({ id: 1 }))
        .mockResolvedValueOnce(new Array(500).fill({ id: 2 }))
        .mockResolvedValueOnce([]);

      await extractor.streamSQPData(
        { dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' } },
        {
          onData: vi.fn(),
          onProgress,
          batchSize: 1000,
        }
      );

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          processed: expect.any(Number),
          total: expect.any(Number),
          percentage: expect.any(Number),
        })
      );
    });

    it('should handle streaming errors gracefully', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Query failed'));
      
      const onError = vi.fn();
      
      await extractor.streamSQPData(
        { dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' } },
        {
          onData: vi.fn(),
          onError,
          batchSize: 1000,
        }
      );

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Incremental Extraction', () => {
    it('should extract data incrementally based on timestamp', async () => {
      const lastProcessed = '2024-01-15T10:00:00Z';
      const mockNewData = [
        { id: 1, updated_at: '2024-01-15T11:00:00Z' },
        { id: 2, updated_at: '2024-01-15T12:00:00Z' },
      ];

      mockClient.query.mockResolvedValue(mockNewData);

      const result = await extractor.extractIncremental({
        lastProcessedTime: lastProcessed,
        column: 'updated_at',
      });

      expect(result.data).toEqual(mockNewData);
      expect(result.newWatermark).toBe('2024-01-15T12:00:00Z');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('updated_at > @lastProcessedTime'),
        expect.objectContaining({ lastProcessedTime: lastProcessed })
      );
    });

    it('should handle watermark-based extraction', async () => {
      mockClient.query.mockResolvedValue([]);
      
      const result = await extractor.extractIncremental({
        lastProcessedTime: '2024-01-15',
        watermarkColumn: 'query_date',
        column: 'query_date',
      });

      expect(mockClient.query).toHaveBeenCalled();
    });

    it('should track extraction state', async () => {
      const state = await extractor.getExtractionState('daily_sqp_extract');
      
      expect(state).toHaveProperty('lastRun');
      expect(state).toHaveProperty('lastWatermark');
      expect(state).toHaveProperty('recordsProcessed');
    });
  });

  describe('Data Validation', () => {
    it('should validate extracted records', async () => {
      const mockData = [
        { query: 'yoga mat', impressions: 1000, clicks: 50 },
        { query: '', impressions: -10, clicks: 5 }, // Invalid
      ];

      mockClient.query.mockResolvedValue(mockData);
      mockValidator.validateSQPRecord
        .mockReturnValueOnce({ valid: true })
        .mockReturnValueOnce({ 
          valid: false, 
          errors: ['Empty query', 'Negative impressions'] 
        });

      const result = await extractor.extractSQPData({
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        validateData: true,
      });

      // Since we're using validateBatch, check the length
      expect(result.validationErrors).toHaveLength(2);
    });

    it('should filter out invalid records when strict mode enabled', async () => {
      const mockData = [
        { query: 'yoga mat', impressions: 1000 },
        { query: '', impressions: -10 }, // Invalid
      ];

      mockClient.query.mockResolvedValue(mockData);
      mockValidator.validateSQPRecord
        .mockReturnValueOnce({ valid: true })
        .mockReturnValueOnce({ valid: false });

      mockValidator.validateBatch.mockReturnValue({
        valid: true,
        errors: [{ index: 1, errors: ['Invalid'] }]
      });
      
      const result = await extractor.extractSQPData({
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        validateData: true,
        strictValidation: true,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].query).toBe('yoga mat');
    });
  });

  describe('Performance Optimization', () => {
    it('should estimate query cost before execution', async () => {
      mockClient.estimateQueryCost.mockResolvedValue({
        estimatedBytes: 1073741824,
        estimatedCostUSD: 0.005,
      });

      const estimate = await extractor.estimateExtractionCost({
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      expect(estimate.estimatedCostUSD).toBe(0.005);
      expect(estimate.estimatedRecords).toBeGreaterThan(0);
    });

    it('should use partition pruning for date queries', async () => {
      mockClient.query.mockResolvedValue([]);
      
      await extractor.extractSQPData({
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
        optimizePartitions: true,
      });

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('_PARTITIONDATE'),
        expect.any(Object)
      );
    });

    it('should batch queries for multiple ASINs', async () => {
      const manyASINs = new Array(100).fill(0).map((_, i) => `B${String(i).padStart(9, '0')}`);

      mockClient.query.mockResolvedValue([]);
      
      // Use extractBatchedASINs for batch processing
      await extractor.extractBatchedASINs(
        manyASINs,
        { startDate: '2024-01-01', endDate: '2024-01-31' },
        50
      );

      // Should split into batches
      expect(mockClient.query).toHaveBeenCalledTimes(2); // 100 ASINs / 50 per batch
    });
  });

  describe('Error Handling', () => {
    it('should retry failed extractions', async () => {
      mockClient.query
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce([]);

      const result = await extractor.extractSQPData({
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });

      expect(mockClient.query).toHaveBeenCalledTimes(2);
      expect(result.data).toEqual([]);
    });

    it('should handle quota exceeded errors', async () => {
      mockClient.query.mockRejectedValue(new Error('Quota exceeded'));

      await expect(
        extractor.extractSQPData({
          dateRange: {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
          },
        })
      ).rejects.toThrow('Quota exceeded');
    });

    it('should provide detailed error information', async () => {
      mockClient.query.mockRejectedValue(
        new Error('Invalid query syntax at line 5')
      );

      try {
        await extractor.extractSQPData({
          dateRange: {
            startDate: '2024-01-01',
            endDate: '2024-01-31',
          },
        });
      } catch (error: any) {
        expect(error.details).toHaveProperty('operation');
        expect(error.details).toHaveProperty('filters');
      }
    });
  });
});