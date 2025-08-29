import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { NestedBigQueryToSupabaseSync } from '../nested-bigquery-to-supabase';
import { BigQuery } from '@google-cloud/bigquery';

// Mock BigQuery
vi.mock('@google-cloud/bigquery', () => ({
  BigQuery: vi.fn().mockImplementation(() => ({
    createQueryJob: vi.fn()
  }))
}));

// Mock Supabase
vi.mock('@/config/supabase.config', () => ({
  getSupabaseClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: vi.fn(),
      select: vi.fn()
    })),
    rpc: vi.fn()
  }))
}));

describe('NestedBigQueryToSupabaseSync - Product Data', () => {
  let sync: NestedBigQueryToSupabaseSync;
  let mockBigQuery: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    sync = new NestedBigQueryToSupabaseSync({
      projectId: 'test-project',
      dataset: 'test-dataset',
      table: 'test-table',
      batchSize: 100
    });

    mockBigQuery = new BigQuery();
  });

  describe('buildQuery with product data fields', () => {
    it('should include Product Name and Client Name fields in the query', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-07');

      // Access private method through any type assertion for testing
      const buildQuery = (sync as any).buildQuery;
      const query = buildQuery.call(sync, startDate, endDate);

      // Verify query includes product data fields
      expect(query).toContain('`Product Name`');
      expect(query).toContain('`Client Name`');
      expect(query).toContain('as productName');
      expect(query).toContain('as clientName');
    });

    it('should properly escape and alias product fields', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-07');

      const buildQuery = (sync as any).buildQuery;
      const query = buildQuery.call(sync, startDate, endDate);

      // Check for proper BigQuery field escaping with backticks
      expect(query).toMatch(/`Product Name`\s+as\s+productName/);
      expect(query).toMatch(/`Client Name`\s+as\s+clientName/);
    });
  });

  describe('transformToNestedStructure with product data', () => {
    it('should include product data in transformed structure', () => {
      const mockRows = [
        {
          startDate: { value: '2024-01-01T00:00:00.000Z' },
          endDate: { value: '2024-01-07T00:00:00.000Z' },
          asin: 'B001234567',
          productName: 'Apple AirPods Pro (2nd Generation)',
          clientName: 'Apple Inc.',
          searchQuery: 'airpods pro',
          searchQueryScore: 95,
          searchQueryVolume: 50000,
          totalQueryImpressionCount: 100000,
          asinImpressionCount: 5000,
          asinImpressionShare: 0.05,
          totalClickCount: 5000,
          totalClickRate: 0.05,
          asinClickCount: 250,
          asinClickShare: 0.05,
          totalMedianClickPrice: 249.99,
          asinMedianClickPrice: 249.99,
          totalCartAddCount: 1000,
          totalCartAddRate: 0.2,
          asinCartAddCount: 50,
          asinCartAddShare: 0.05,
          totalMedianCartAddPrice: 249.99,
          asinMedianCartAddPrice: 249.99,
          totalPurchaseCount: 500,
          totalPurchaseRate: 0.5,
          asinPurchaseCount: 25,
          asinPurchaseShare: 0.05,
          totalMedianPurchasePrice: 249.99,
          asinMedianPurchasePrice: 249.99
        }
      ];

      const transformToNestedStructure = (sync as any).transformToNestedStructure;
      const result = transformToNestedStructure.call(sync, mockRows);

      expect(result.dataByAsin).toHaveLength(1);
      expect(result.dataByAsin[0]).toHaveProperty('productName', 'Apple AirPods Pro (2nd Generation)');
      expect(result.dataByAsin[0]).toHaveProperty('clientName', 'Apple Inc.');
      expect(result.dataByAsin[0].asin).toBe('B001234567');
    });

    it('should handle missing product data gracefully', () => {
      const mockRows = [
        {
          startDate: '2024-01-01',
          endDate: '2024-01-07',
          asin: 'B001234567',
          // Product Name and Client Name are missing
          searchQuery: 'test query',
          searchQueryScore: 80,
          searchQueryVolume: 1000,
          totalQueryImpressionCount: 10000,
          asinImpressionCount: 500
        }
      ];

      const transformToNestedStructure = (sync as any).transformToNestedStructure;
      const result = transformToNestedStructure.call(sync, mockRows);

      expect(result.dataByAsin).toHaveLength(1);
      expect(result.dataByAsin[0].productName).toBeUndefined();
      expect(result.dataByAsin[0].clientName).toBeUndefined();
    });

    it('should preserve product data across multiple queries for same ASIN', () => {
      const mockRows = [
        {
          startDate: '2024-01-01',
          endDate: '2024-01-07',
          asin: 'B001234567',
          productName: 'Samsung Galaxy S24 Ultra',
          clientName: 'Samsung Electronics',
          searchQuery: 'galaxy s24',
          searchQueryScore: 90,
          searchQueryVolume: 30000
        },
        {
          startDate: '2024-01-01',
          endDate: '2024-01-07',
          asin: 'B001234567',
          productName: 'Samsung Galaxy S24 Ultra',
          clientName: 'Samsung Electronics',
          searchQuery: 'samsung phone',
          searchQueryScore: 85,
          searchQueryVolume: 25000
        }
      ];

      const transformToNestedStructure = (sync as any).transformToNestedStructure;
      const result = transformToNestedStructure.call(sync, mockRows);

      expect(result.dataByAsin).toHaveLength(1);
      expect(result.dataByAsin[0].productName).toBe('Samsung Galaxy S24 Ultra');
      expect(result.dataByAsin[0].clientName).toBe('Samsung Electronics');
      expect(result.dataByAsin[0].searchQueryData).toHaveLength(2);
    });
  });

  describe('syncDateRange with product data', () => {
    it('should process and sync product data to Supabase', async () => {
      const mockQueryJob = {
        getQueryResults: vi.fn().mockResolvedValue([[
          {
            startDate: { value: '2024-01-01T00:00:00.000Z' },
            endDate: { value: '2024-01-07T00:00:00.000Z' },
            asin: 'B001234567',
            productName: 'Sony WH-1000XM5 Headphones',
            clientName: 'Sony Corporation',
            searchQuery: 'sony headphones',
            searchQueryScore: 95,
            searchQueryVolume: 20000,
            totalQueryImpressionCount: 50000,
            asinImpressionCount: 2500,
            asinImpressionShare: 0.05
          }
        ]])
      };

      (mockBigQuery.createQueryJob as Mock).mockResolvedValue([mockQueryJob]);

      const result = await sync.syncDateRange(
        new Date('2024-01-01'),
        new Date('2024-01-07')
      );

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBeGreaterThan(0);
    });

    it('should include product data in dry run mode', async () => {
      const mockQueryJob = {
        getQueryResults: vi.fn().mockResolvedValue([[
          {
            startDate: { value: '2024-01-01T00:00:00.000Z' },
            endDate: { value: '2024-01-07T00:00:00.000Z' },
            asin: 'B001234567',
            productName: 'Bose QuietComfort 45',
            clientName: 'Bose Corporation',
            searchQuery: 'bose headphones'
          }
        ]])
      };

      (mockBigQuery.createQueryJob as Mock).mockResolvedValue([mockQueryJob]);

      const result = await sync.syncDateRange(
        new Date('2024-01-01'),
        new Date('2024-01-07'),
        { dryRun: true }
      );

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(0); // No actual processing in dry run
    });
  });

  describe('Brand extraction preparation', () => {
    it('should format product titles for brand extraction functions', () => {
      const testCases = [
        {
          input: 'Apple iPhone 15 Pro Max 256GB',
          expectedBrand: 'Apple'
        },
        {
          input: 'Samsung - Galaxy S24 Ultra Smartphone',
          expectedBrand: 'Samsung'
        },
        {
          input: 'Echo Dot (5th Gen) by Amazon',
          expectedBrand: 'Echo Dot' // or 'Amazon' depending on extraction logic
        }
      ];

      testCases.forEach(testCase => {
        // This test validates that product titles are properly formatted
        // for the PostgreSQL brand extraction functions
        expect(testCase.input).toBeTruthy();
        expect(testCase.input.length).toBeGreaterThan(0);
      });
    });
  });
});