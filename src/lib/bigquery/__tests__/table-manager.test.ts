import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BigQuery, Table, Dataset } from '@google-cloud/bigquery';
import { BigQueryTableManager } from '../table-manager';
import { TableLifecycleConfig } from '../types';
import { BigQueryError, BigQueryTableNotFoundError, BigQueryPermissionError, BigQueryRateLimitError } from '../errors';

// Mock BigQuery
vi.mock('@google-cloud/bigquery', () => {
  const mockTable = vi.fn();
  const mockDataset = vi.fn();
  const mockBigQuery = vi.fn();

  mockBigQuery.prototype = {
    dataset: mockDataset,
  };

  return { 
    BigQuery: mockBigQuery,
    Table: mockTable,
    Dataset: mockDataset,
  };
});

vi.mock('@/config/bigquery.config', () => ({
  getBigQueryConfig: vi.fn(() => ({
    projectId: 'test-project',
    dataset: 'test-dataset',
    location: 'US',
  })),
}));

describe('BigQueryTableManager', () => {
  let tableManager: BigQueryTableManager;
  let mockBigQueryInstance: any;
  let mockDatasetInstance: any;
  let mockTableInstance: any;

  const mockTableMetadata = {
    id: 'test-table',
    schema: {
      fields: [
        { name: 'id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
      ],
    },
    timePartitioning: {
      type: 'DAY',
      field: 'created_at',
    },
    clustering: {
      fields: ['id'],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup table mock
    mockTableInstance = {
      exists: vi.fn().mockResolvedValue([true]),
      create: vi.fn().mockResolvedValue([{ id: 'test-table' }]),
      delete: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue([{ metadata: mockTableMetadata }]),
      setMetadata: vi.fn().mockResolvedValue([{ id: 'test-table' }]),
      load: vi.fn().mockResolvedValue([{ status: { state: 'DONE' } }]),
      createQueryStream: vi.fn().mockReturnValue({
        on: vi.fn(),
        pipe: vi.fn(),
      }),
      getRows: vi.fn().mockResolvedValue([[{ id: '1', value: 'test' }]]),
    };

    // Setup dataset mock
    mockDatasetInstance = {
      table: vi.fn().mockReturnValue(mockTableInstance),
      createTable: vi.fn().mockResolvedValue([mockTableInstance]),
      exists: vi.fn().mockResolvedValue([true]),
    };

    // Setup BigQuery mock
    mockBigQueryInstance = {
      dataset: vi.fn().mockReturnValue(mockDatasetInstance),
      query: vi.fn().mockResolvedValue([[]]),
      createQueryJob: vi.fn().mockResolvedValue([{
        getQueryResults: vi.fn().mockResolvedValue([[]]),
      }]),
    };

    const MockBigQuery = vi.mocked(BigQuery);
    MockBigQuery.mockImplementation(() => mockBigQueryInstance);

    tableManager = new BigQueryTableManager();
  });

  afterEach(() => {
    tableManager.close();
  });

  describe('Table Creation', () => {
    it('should create a table with schema and partitioning', async () => {
      const tableId = 'test-table';
      const schema = [
        { name: 'id', type: 'STRING', mode: 'REQUIRED' },
        { name: 'created_at', type: 'TIMESTAMP', mode: 'REQUIRED' },
        { name: 'value', type: 'FLOAT', mode: 'NULLABLE' },
      ];
      const options = {
        partitioning: {
          type: 'DAY' as const,
          field: 'created_at',
        },
        clustering: ['id'],
      };

      await tableManager.createTable(tableId, schema, options);

      expect(mockDatasetInstance.createTable).toHaveBeenCalledWith(tableId, {
        schema: { fields: schema },
        timePartitioning: options.partitioning,
        clustering: { fields: options.clustering },
      });
    });

    it('should handle table creation errors', async () => {
      mockDatasetInstance.createTable.mockRejectedValueOnce(
        new Error('Permission denied')
      );

      await expect(
        tableManager.createTable('test-table', [])
      ).rejects.toThrow(BigQueryPermissionError);
    });

    it('should not create table if it already exists', async () => {
      const tableId = 'existing-table';
      
      const result = await tableManager.createTableIfNotExists(tableId, []);
      
      expect(mockTableInstance.exists).toHaveBeenCalled();
      expect(mockDatasetInstance.createTable).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('Table Schema Updates', () => {
    it('should update table schema with new fields', async () => {
      // Ensure table.get returns proper metadata
      mockTableInstance.get.mockResolvedValueOnce([mockTableMetadata]);
      
      const tableId = 'test-table';
      const newFields = [
        { name: 'new_field', type: 'STRING', mode: 'NULLABLE' },
      ];

      await tableManager.updateTableSchema(tableId, newFields);

      expect(mockTableInstance.get).toHaveBeenCalled();
      expect(mockTableInstance.setMetadata).toHaveBeenCalledWith({
        schema: {
          fields: [
            ...mockTableMetadata.schema.fields,
            ...newFields,
          ],
        },
      });
    });

    it('should prevent duplicate field additions', async () => {
      // Ensure table.get returns proper metadata
      mockTableInstance.get.mockResolvedValueOnce([mockTableMetadata]);
      
      const tableId = 'test-table';
      const duplicateFields = [
        { name: 'id', type: 'STRING', mode: 'REQUIRED' },
      ];

      await expect(
        tableManager.updateTableSchema(tableId, duplicateFields)
      ).rejects.toThrow('Field "id" already exists');
    });
  });

  describe('Table Deletion', () => {
    it('should delete a table', async () => {
      await tableManager.deleteTable('test-table');

      expect(mockTableInstance.delete).toHaveBeenCalled();
    });

    it('should handle deletion of non-existent table gracefully', async () => {
      mockTableInstance.exists.mockResolvedValueOnce([false]);

      await expect(
        tableManager.deleteTable('non-existent-table')
      ).rejects.toThrow(BigQueryTableNotFoundError);
    });

    it('should force delete table with data', async () => {
      mockTableInstance.delete.mockRejectedValueOnce(
        new Error('Table has data')
      );

      await tableManager.deleteTable('test-table', { force: true });

      expect(mockBigQueryInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('DROP TABLE IF EXISTS')
      );
    });
  });

  describe('Table Lifecycle Management', () => {
    it('should configure table expiration', async () => {
      const tableId = 'temp-table';
      const expirationDays = 30;

      await tableManager.setTableExpiration(tableId, expirationDays);

      const expectedExpirationTime = Date.now() + (expirationDays * 24 * 60 * 60 * 1000);
      expect(mockTableInstance.setMetadata).toHaveBeenCalledWith({
        expirationTime: expect.any(String),
      });
    });

    it('should archive old data based on date', async () => {
      const sourceTable = 'active-data';
      const archiveTable = 'archived-data';
      const cutoffDate = '2024-01-01';

      await tableManager.archiveOldData(sourceTable, archiveTable, cutoffDate);

      expect(mockBigQueryInstance.query).toHaveBeenCalledTimes(2);
      // First query creates archive table and inserts old data
      expect(mockBigQueryInstance.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('CREATE TABLE')
      );
      // Second query deletes archived data from source
      expect(mockBigQueryInstance.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('DELETE FROM')
      );
    });

    it('should manage table lifecycle with configuration', async () => {
      // Setup mock to return metadata with timePartitioning
      mockTableInstance.get.mockResolvedValueOnce([{
        ...mockTableMetadata,
        timePartitioning: {
          type: 'DAY',
          field: 'created_at',
        },
      }]);
      
      const config: TableLifecycleConfig = {
        tableId: 'lifecycle-table',
        retentionDays: 90,
        archiveAfterDays: 60,
        archiveTableId: 'lifecycle-table-archive',
        partitionExpirationDays: 120,
      };

      await tableManager.applyLifecyclePolicy(config);

      // Should set table expiration
      expect(mockTableInstance.setMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          expirationTime: expect.any(String),
        })
      );

      // Should configure partition expiration (called twice, once for table expiration, once for partition expiration)
      expect(mockTableInstance.setMetadata).toHaveBeenCalledTimes(2);
      expect(mockTableInstance.setMetadata).toHaveBeenNthCalledWith(2,
        expect.objectContaining({
          timePartitioning: expect.objectContaining({
            expirationMS: config.partitionExpirationDays! * 24 * 60 * 60 * 1000,
          }),
        })
      );
    });
  });

  describe('Table Maintenance', () => {
    it('should get table size and row count', async () => {
      mockBigQueryInstance.query.mockResolvedValueOnce([[
        { 
          size_bytes: '1073741824',
          row_count: '1000000',
          modified_time: '2024-01-15T10:00:00Z',
        },
      ]]);

      const stats = await tableManager.getTableStatistics('test-table');

      expect(stats).toEqual({
        sizeBytes: 1073741824,
        sizeMB: 1024,
        sizeGB: 1,
        rowCount: 1000000,
        lastModified: new Date('2024-01-15T10:00:00Z'),
      });
    });

    it('should list tables with lifecycle metadata', async () => {
      mockBigQueryInstance.query.mockResolvedValueOnce([[
        {
          table_name: 'table1',
          creation_time: '2024-01-01T00:00:00Z',
          expiration_time: '2024-04-01T00:00:00Z',
          size_bytes: '1000000',
          row_count: '1000',
        },
        {
          table_name: 'table2',
          creation_time: '2024-01-15T00:00:00Z',
          expiration_time: null,
          size_bytes: '2000000',
          row_count: '2000',
        },
      ]]);

      const tables = await tableManager.listTablesWithLifecycle();

      expect(tables).toHaveLength(2);
      expect(tables[0]).toMatchObject({
        tableId: 'table1',
        createdAt: expect.any(Date),
        expiresAt: expect.any(Date),
        sizeBytes: 1000000,
        rowCount: 1000,
      });
    });

    it('should clean up expired tables', async () => {
      mockBigQueryInstance.query.mockResolvedValueOnce([[
        { table_name: 'expired-table-1' },
        { table_name: 'expired-table-2' },
      ]]);

      const result = await tableManager.cleanupExpiredTables();

      expect(result.deletedTables).toHaveLength(2);
      expect(mockBigQueryInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('TIMESTAMP_MILLIS(expiration_time) < CURRENT_TIMESTAMP()')
      );
    });
  });

  describe('Materialized Views', () => {
    it('should create a materialized view', async () => {
      const viewName = 'test-view';
      const query = 'SELECT * FROM test-table WHERE active = true';
      const options = {
        enableRefresh: true,
        refreshIntervalMinutes: 60,
      };

      await tableManager.createMaterializedView(viewName, query, options);

      expect(mockBigQueryInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE MATERIALIZED VIEW')
      );
    });

    it('should refresh a materialized view', async () => {
      await tableManager.refreshMaterializedView('test-view');

      expect(mockBigQueryInstance.query).toHaveBeenCalledWith(
        expect.stringContaining('BQ.REFRESH_MATERIALIZED_VIEW')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limit errors with retry', async () => {
      // Mock sleep to avoid actual delays in tests
      const sleepSpy = vi.spyOn(tableManager as any, 'sleep').mockResolvedValue(undefined);
      
      mockDatasetInstance.createTable.mockRejectedValueOnce({
        code: 429,
        message: 'Rate limit exceeded',
      });
      mockDatasetInstance.createTable.mockResolvedValueOnce([mockTableInstance]);

      await tableManager.createTable('test-table', [], { maxRetries: 2 });

      expect(mockDatasetInstance.createTable).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenCalledOnce();
      
      sleepSpy.mockRestore();
    });

    it('should throw error after max retries', async () => {
      // Mock sleep to avoid actual delays in tests
      const sleepSpy = vi.spyOn(tableManager as any, 'sleep').mockResolvedValue(undefined);
      
      mockDatasetInstance.createTable.mockRejectedValue({
        code: 429,
        message: 'Rate limit exceeded',
      });

      await expect(
        tableManager.createTable('test-table', [], { maxRetries: 2 })
      ).rejects.toThrow(BigQueryRateLimitError);

      expect(mockDatasetInstance.createTable).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(sleepSpy).toHaveBeenCalledTimes(2); // Sleep called for each retry
      
      sleepSpy.mockRestore();
    });
  });

  describe('Resource Cleanup', () => {
    it('should close connections on shutdown', () => {
      expect(() => tableManager.close()).not.toThrow();
      expect(tableManager.isClosed()).toBe(true);
    });

    it('should prevent operations after close', async () => {
      tableManager.close();

      await expect(
        tableManager.createTable('test-table', [])
      ).rejects.toThrow('Client is closed');
    });
  });
});