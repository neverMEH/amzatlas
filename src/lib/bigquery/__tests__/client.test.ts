import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BigQuery } from '@google-cloud/bigquery';
import { BigQueryClient } from '../client';
import { BigQueryError } from '../errors';

// Mock the BigQuery module
vi.mock('@google-cloud/bigquery', () => {
  const mockQuery = vi.fn();
  const mockDataset = vi.fn();
  const mockGetDatasets = vi.fn();
  const mockCreateQueryJob = vi.fn();
  
  const BigQueryMock = vi.fn(() => ({
    query: mockQuery,
    dataset: mockDataset,
    getDatasets: mockGetDatasets,
    createQueryJob: mockCreateQueryJob,
  }));

  return { BigQuery: BigQueryMock };
});

describe('BigQueryClient', () => {
  let client: BigQueryClient;
  let mockBigQueryInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset environment variables
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = JSON.stringify({
      type: 'service_account',
      project_id: 'test-project',
      private_key_id: 'test-key-id',
      private_key: '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----',
      client_email: 'test@test-project.iam.gserviceaccount.com',
    });
    process.env.BIGQUERY_PROJECT_ID = 'test-project';
    process.env.BIGQUERY_DATASET = 'test_dataset';
    process.env.BIGQUERY_LOCATION = 'US';
  });

  afterEach(() => {
    if (client) {
      client.close();
    }
  });

  describe('Authentication', () => {
    it('should successfully authenticate with valid credentials', async () => {
      client = new BigQueryClient();
      mockBigQueryInstance = (BigQuery as any).mock.results[0].value;
      
      mockBigQueryInstance.getDatasets.mockResolvedValue([[{ id: 'test_dataset' }]]);
      
      const isAuthenticated = await client.testConnection();
      expect(isAuthenticated).toBe(true);
      expect(mockBigQueryInstance.getDatasets).toHaveBeenCalled();
    });

    it('should throw error when credentials are missing', () => {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
      
      expect(() => new BigQueryClient()).toThrow(BigQueryError);
    });

    it('should throw error when credentials are invalid JSON', () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = 'invalid-json';
      
      expect(() => new BigQueryClient()).toThrow(BigQueryError);
    });

    it('should handle authentication errors gracefully', async () => {
      client = new BigQueryClient();
      mockBigQueryInstance = (BigQuery as any).mock.results[0].value;
      
      mockBigQueryInstance.getDatasets.mockRejectedValue(new Error('Authentication failed'));
      
      const isAuthenticated = await client.testConnection();
      expect(isAuthenticated).toBe(false);
    });
  });

  describe('Connection Pool Management', () => {
    it('should reuse existing BigQuery instance', () => {
      client = new BigQueryClient();
      const instance1 = client.getClient();
      const instance2 = client.getClient();
      
      expect(instance1).toBe(instance2);
    });

    it('should properly close connections', () => {
      client = new BigQueryClient();
      client.close();
      
      expect(() => client.getClient()).toThrow('BigQuery client has been closed');
    });

    it('should handle concurrent requests', async () => {
      client = new BigQueryClient();
      mockBigQueryInstance = (BigQuery as any).mock.results[0].value;
      
      mockBigQueryInstance.query.mockResolvedValue([[{ count: 100 }]]);
      
      const promises = Array(10).fill(null).map(() => 
        client.query('SELECT COUNT(*) as count FROM test_table')
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      expect(mockBigQueryInstance.query).toHaveBeenCalledTimes(10);
    });
  });

  describe('Query Execution', () => {
    beforeEach(() => {
      client = new BigQueryClient();
      mockBigQueryInstance = (BigQuery as any).mock.results[0].value;
    });

    it('should execute simple query successfully', async () => {
      const mockData = [{ id: 1, name: 'test' }];
      mockBigQueryInstance.query.mockResolvedValue([mockData]);
      
      const result = await client.query('SELECT * FROM test_table');
      
      expect(result).toEqual(mockData);
      expect(mockBigQueryInstance.query).toHaveBeenCalledWith({
        query: 'SELECT * FROM test_table',
        location: 'US',
        useLegacySql: false,
      });
    });

    it('should handle parameterized queries', async () => {
      const mockData = [{ id: 1 }];
      mockBigQueryInstance.query.mockResolvedValue([mockData]);
      
      const params = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };
      
      const result = await client.query(
        'SELECT * FROM test_table WHERE date BETWEEN @startDate AND @endDate',
        params
      );
      
      expect(result).toEqual(mockData);
      expect(mockBigQueryInstance.query).toHaveBeenCalledWith({
        query: 'SELECT * FROM test_table WHERE date BETWEEN @startDate AND @endDate',
        location: 'US',
        useLegacySql: false,
        params,
      });
    });

    it('should handle query timeouts', async () => {
      mockBigQueryInstance.query.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 100)
        )
      );
      
      await expect(
        client.query('SELECT * FROM test_table', undefined, { timeoutMs: 50 })
      ).rejects.toThrow('Query timeout');
    });

    it('should validate SQL syntax', async () => {
      await expect(
        client.query('SELCT * FROM test_table') // Intentional typo
      ).rejects.toThrow('Invalid SQL query');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      client = new BigQueryClient();
      mockBigQueryInstance = (BigQuery as any).mock.results[0].value;
    });

    it('should retry transient errors', async () => {
      let callCount = 0;
      mockBigQueryInstance.query.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Service temporarily unavailable'));
        }
        return Promise.resolve([[{ count: 100 }]]);
      });
      
      const result = await client.query('SELECT COUNT(*) FROM test_table');
      
      expect(result).toEqual([{ count: 100 }]);
      expect(mockBigQueryInstance.query).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-transient errors', async () => {
      mockBigQueryInstance.query.mockRejectedValue(new Error('Permission denied'));
      
      await expect(
        client.query('SELECT * FROM test_table')
      ).rejects.toThrow('Permission denied');
      
      expect(mockBigQueryInstance.query).toHaveBeenCalledTimes(1);
    });

    it('should respect retry limits', async () => {
      mockBigQueryInstance.query.mockRejectedValue(
        new Error('Service temporarily unavailable')
      );
      
      await expect(
        client.query('SELECT * FROM test_table')
      ).rejects.toThrow('Service temporarily unavailable');
      
      expect(mockBigQueryInstance.query).toHaveBeenCalledTimes(3); // Default max retries
    });
  });

  describe('Cost Estimation', () => {
    beforeEach(() => {
      client = new BigQueryClient();
      mockBigQueryInstance = (BigQuery as any).mock.results[0].value;
    });

    it('should estimate query cost before execution', async () => {
      const mockJobStats = {
        statistics: {
          query: {
            totalBytesBilled: '1073741824', // 1GB
            cacheHit: false,
          },
        },
      };
      
      mockBigQueryInstance.createQueryJob.mockResolvedValue([
        { 
          getMetadata: vi.fn().mockResolvedValue([mockJobStats]),
        }
      ]);
      
      const estimate = await client.estimateQueryCost('SELECT * FROM large_table');
      
      expect(estimate).toEqual({
        estimatedBytes: 1073741824,
        estimatedCostUSD: 0.004883, // $5 per TB (1GB = 0.004883)
        cacheHit: false,
      });
    });

    it('should handle dry run errors', async () => {
      mockBigQueryInstance.createQueryJob.mockRejectedValue(
        new Error('Invalid query')
      );
      
      await expect(
        client.estimateQueryCost('INVALID SQL')
      ).rejects.toThrow('Failed to estimate query cost');
    });
  });
});