import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BigQueryDataInspector } from '../data-inspector';
import { BigQueryConnectionPool } from '../connection-pool';
import { BigQueryClient } from '../client';
import { InspectionReport, ASINDistribution, DataQualityMetrics } from '../types';

// Mock the dependencies
vi.mock('../connection-pool');
vi.mock('../client');

describe('BigQueryDataInspector', () => {
  let inspector: BigQueryDataInspector;
  let mockPool: BigQueryConnectionPool;
  let mockClient: BigQueryClient;

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      dataset: vi.fn(),
      getDatasets: vi.fn(),
    } as any;
    
    mockPool = {
      acquire: vi.fn().mockResolvedValue(mockClient),
      release: vi.fn(),
    } as any;
    
    inspector = new BigQueryDataInspector(mockPool);
  });

  describe('inspectTableSchema', () => {
    it('should retrieve and analyze table schema', async () => {
      const mockSchema = [
        { name: 'query', type: 'STRING', mode: 'REQUIRED' },
        { name: 'asin', type: 'STRING', mode: 'REQUIRED' },
        { name: 'impressions', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'clicks', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'purchases', type: 'INTEGER', mode: 'NULLABLE' },
        { name: 'query_date', type: 'DATE', mode: 'REQUIRED' },
      ];

      const mockDataset = {
        table: vi.fn().mockReturnValue({
          getMetadata: vi.fn().mockResolvedValue([{ schema: { fields: mockSchema } }]),
        }),
      };
      
      vi.mocked(mockClient.dataset).mockReturnValue(mockDataset);

      const schema = await inspector.inspectTableSchema('project.dataset.table');
      
      expect(schema).toHaveLength(6);
      expect(schema[0]).toEqual({
        name: 'query',
        type: 'STRING',
        mode: 'REQUIRED',
      });
    });
  });

  describe('analyzeASINDistribution', () => {
    it('should analyze ASIN distribution for a given query and date range', async () => {
      const mockQueryResult = [
        {
          total_asins: 3,
          avg_asins_per_day: 2.5,
          median_impressions: 3000,
          total_impressions: 9000,
          total_clicks: 400,
          total_purchases: 32,
          top_asins: [
            { asin: 'B001', count: 150, impressions: 5000, clicks: 250, purchases: 20, rank: 1 },
            { asin: 'B002', count: 100, impressions: 3000, clicks: 120, purchases: 10, rank: 2 },
            { asin: 'B003', count: 50, impressions: 1000, clicks: 30, purchases: 2, rank: 3 },
          ],
        },
      ];

      // Mock BigQuery client query method - it returns [rows]
      vi.mocked(mockClient.query).mockResolvedValue([mockQueryResult] as any);

      const distribution = await inspector.analyzeASINDistribution(
        'project.dataset.sqp_raw',
        'laptop stand',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );
      

      expect(distribution).toEqual({
        query: 'laptop stand',
        totalASINs: 3,
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        },
        topASINs: [
          { asin: 'B001', count: 150, impressions: 5000, clicks: 250, purchases: 20, rank: 1 },
          { asin: 'B002', count: 100, impressions: 3000, clicks: 120, purchases: 10, rank: 2 },
          { asin: 'B003', count: 50, impressions: 1000, clicks: 30, purchases: 2, rank: 3 },
        ],
        metrics: {
          avgASINsPerDay: 2.5,
          medianImpressions: 3000,
          totalImpressions: 9000,
          totalClicks: 400,
          totalPurchases: 32,
        },
      });
    });

    it('should handle empty results gracefully', async () => {
      vi.mocked(mockClient.query).mockResolvedValue([[]]);

      const distribution = await inspector.analyzeASINDistribution(
        'project.dataset.sqp_raw',
        'nonexistent query',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(distribution.totalASINs).toBe(0);
      expect(distribution.topASINs).toEqual([]);
    });
  });

  describe('compareDataQuality', () => {
    it('should compare data quality between BigQuery and Supabase', async () => {
      const mockBQResult = [[{ total_rows: 1000, distinct_queries: 50, distinct_asins: 200 }]];
      const mockSupabaseResult = { total_rows: 980, distinct_queries: 50, distinct_asins: 195 };

      vi.mocked(mockClient.query).mockResolvedValue(mockBQResult as any);

      const comparison = await inspector.compareDataQuality(
        'project.dataset.sqp_raw',
        mockSupabaseResult,
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(comparison).toEqual({
        bigquery: {
          totalRows: 1000,
          distinctQueries: 50,
          distinctASINs: 200,
        },
        supabase: {
          totalRows: 980,
          distinctQueries: 50,
          distinctASINs: 195,
        },
        discrepancies: {
          rowCountDiff: 20,
          rowCountDiffPercent: 2.0,
          queryCountDiff: 0,
          asinCountDiff: 5,
          asinCountDiffPercent: 2.5,
        },
        quality: {
          dataCompleteness: 98.0,
          schemaConsistency: true,
          hasDiscrepancies: true,
        },
      });
    });
  });

  describe('generateSamplingStrategies', () => {
    it('should generate different ASIN sampling strategies', async () => {
      const mockDistribution: ASINDistribution = {
        query: 'laptop stand',
        totalASINs: 100,
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        },
        topASINs: [
          { asin: 'B001', count: 500, impressions: 10000, clicks: 500, purchases: 50, rank: 1 },
          { asin: 'B002', count: 300, impressions: 6000, clicks: 240, purchases: 20, rank: 2 },
          { asin: 'B003', count: 200, impressions: 4000, clicks: 120, purchases: 10, rank: 3 },
        ],
        metrics: {
          avgASINsPerDay: 3.2,
          medianImpressions: 100,
          totalImpressions: 50000,
          totalClicks: 2000,
          totalPurchases: 150,
        },
      };

      const strategies = inspector.generateSamplingStrategies(mockDistribution);

      expect(strategies).toEqual({
        all: {
          name: 'All ASINs',
          description: 'Include all 100 ASINs',
          estimatedRows: expect.any(Number),
          asins: null,
        },
        top1: {
          name: 'Top ASIN Only',
          description: 'Only the #1 ASIN by impressions',
          estimatedRows: expect.any(Number),
          asins: ['B001'],
        },
        top5: {
          name: 'Top 5 ASINs',
          description: 'Top 5 ASINs by impressions',
          estimatedRows: expect.any(Number),
          asins: ['B001', 'B002', 'B003'],
        },
        top10: {
          name: 'Top 10 ASINs',
          description: 'Top 10 ASINs by impressions',
          estimatedRows: expect.any(Number),
          asins: expect.any(Array),
        },
        representative: {
          name: 'Representative Sample',
          description: 'Statistically representative sample (10%)',
          estimatedRows: expect.any(Number),
          asins: expect.any(Array),
        },
      });
    });
  });

  describe('generateInspectionReport', () => {
    it('should generate a comprehensive inspection report', async () => {
      const mockTableList = ['sqp_raw', 'sqp_processed'];
      const mockQueries = ['laptop stand', 'monitor arm'];
      
      // Mock all the inspector methods that generateInspectionReport will call
      vi.spyOn(inspector, 'inspectTableSchema').mockResolvedValue([
        { name: 'query', type: 'STRING', mode: 'REQUIRED' },
        { name: 'asin', type: 'STRING', mode: 'REQUIRED' },
      ]);
      
      vi.spyOn(inspector, 'analyzeASINDistribution').mockResolvedValue({
        query: 'laptop stand',
        totalASINs: 50,
        dateRange: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
        topASINs: [],
        metrics: {
          avgASINsPerDay: 2.5,
          medianImpressions: 100,
          totalImpressions: 10000,
          totalClicks: 500,
          totalPurchases: 25,
        },
      });

      const report = await inspector.generateInspectionReport({
        tables: mockTableList,
        queries: mockQueries,
        dateRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        },
      });

      expect(report).toMatchObject({
        timestamp: expect.any(Date),
        config: {
          tables: mockTableList,
          queries: mockQueries,
          dateRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-31'),
          },
        },
        schemas: expect.any(Object),
        distributions: expect.any(Object),
        recommendations: expect.any(Array),
      });
    });
  });

  describe('validateDataStructure', () => {
    it('should validate data structure between periods', async () => {
      const mockWeeklyData = [[
        { period_start: '2024-01-01', query: 'laptop stand', asin: 'B001', total_impressions: 1000 },
      ]];
      
      const mockMonthlyData = [[
        { year: 2024, month: 1, query: 'laptop stand', asin: 'B001', total_impressions: 4000 },
      ]];

      vi.mocked(mockClient.query)
        .mockResolvedValueOnce(mockWeeklyData as any)
        .mockResolvedValueOnce(mockMonthlyData as any);

      const validation = await inspector.validateDataStructure(
        'sqp.weekly_summary',
        'sqp.monthly_summary',
        'laptop stand',
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );

      expect(validation).toMatchObject({
        isValid: expect.any(Boolean),
        sourceTable: 'sqp.weekly_summary',
        targetTable: 'sqp.monthly_summary',
        issues: expect.any(Array),
        metrics: expect.any(Object),
      });
    });
  });
});