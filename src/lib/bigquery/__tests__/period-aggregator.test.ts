import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PeriodAggregator } from '../aggregators/period-aggregator';
import { BigQueryConnectionPool } from '../connection-pool';
import { SQPRecord, PeriodType } from '../types';

describe('PeriodAggregator', () => {
  let aggregator: PeriodAggregator;
  let mockPool: BigQueryConnectionPool;
  
  const mockRecords: SQPRecord[] = [
    // Week 1
    {
      query: 'running shoes',
      asin: 'B001',
      impressions: 1000,
      clicks: 100,
      purchases: 10,
      query_date: '2024-01-01T00:00:00Z',
    },
    {
      query: 'running shoes',
      asin: 'B001',
      impressions: 1200,
      clicks: 120,
      purchases: 12,
      query_date: '2024-01-03T00:00:00Z',
    },
    // Week 2
    {
      query: 'running shoes',
      asin: 'B001',
      impressions: 1100,
      clicks: 110,
      purchases: 11,
      query_date: '2024-01-08T00:00:00Z',
    },
    {
      query: 'running shoes',
      asin: 'B001',
      impressions: 1300,
      clicks: 130,
      purchases: 13,
      query_date: '2024-01-10T00:00:00Z',
    },
    // Different ASIN
    {
      query: 'running shoes',
      asin: 'B002',
      impressions: 800,
      clicks: 80,
      purchases: 8,
      query_date: '2024-01-01T00:00:00Z',
    },
    // Different month
    {
      query: 'running shoes',
      asin: 'B001',
      impressions: 1400,
      clicks: 140,
      purchases: 14,
      query_date: '2024-02-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    mockPool = {
      withClient: vi.fn(),
    } as any;
    aggregator = new PeriodAggregator(mockPool);
  });

  describe('aggregateByPeriod', () => {
    it('should aggregate data by week', async () => {
      const result = await aggregator.aggregateByPeriod(mockRecords, 'weekly');
      
      expect(result).toHaveLength(4); // 3 weeks for B001, 1 week for B002
      
      const week1B001 = result.find(r => 
        r.query === 'running shoes' && 
        r.asin === 'B001' && 
        r.date === '2023-12-31' // Sunday start of week
      );
      
      expect(week1B001).toBeDefined();
      expect(week1B001?.totalImpressions).toBe(2200); // 1000 + 1200
      expect(week1B001?.totalClicks).toBe(220); // 100 + 120
      expect(week1B001?.totalPurchases).toBe(22); // 10 + 12
      expect(week1B001?.avgCTR).toBeCloseTo(0.1);
      expect(week1B001?.avgCVR).toBeCloseTo(0.1);
    });

    it('should aggregate data by month', async () => {
      const result = await aggregator.aggregateByPeriod(mockRecords, 'monthly');
      
      expect(result).toHaveLength(3); // Jan B001, Jan B002, Feb B001
      
      const janB001 = result.find(r => 
        r.query === 'running shoes' && 
        r.asin === 'B001' && 
        r.date === '2024-01'
      );
      
      expect(janB001).toBeDefined();
      expect(janB001?.totalImpressions).toBe(4600); // All January impressions for B001
      expect(janB001?.totalClicks).toBe(460);
      expect(janB001?.totalPurchases).toBe(46);
    });

    it('should aggregate data by quarter', async () => {
      const result = await aggregator.aggregateByPeriod(mockRecords, 'quarterly');
      
      expect(result).toHaveLength(2); // Q1 B001, Q1 B002
      
      const q1B001 = result.find(r => 
        r.query === 'running shoes' && 
        r.asin === 'B001' && 
        r.date === '2024-Q1'
      );
      
      expect(q1B001).toBeDefined();
      expect(q1B001?.totalImpressions).toBe(6000); // All Q1 impressions for B001
      expect(q1B001?.totalClicks).toBe(600);
      expect(q1B001?.totalPurchases).toBe(60);
    });

    it('should aggregate data by year', async () => {
      const result = await aggregator.aggregateByPeriod(mockRecords, 'yearly');
      
      expect(result).toHaveLength(2); // 2024 B001, 2024 B002
      
      const year2024B001 = result.find(r => 
        r.query === 'running shoes' && 
        r.asin === 'B001' && 
        r.date === '2024'
      );
      
      expect(year2024B001).toBeDefined();
      expect(year2024B001?.totalImpressions).toBe(6000); // All 2024 impressions for B001
    });

    it('should calculate share metrics when requested', async () => {
      const result = await aggregator.aggregateByPeriod(
        mockRecords, 
        'weekly',
        { includeShareMetrics: true }
      );
      
      const week1B001 = result.find(r => 
        r.query === 'running shoes' && 
        r.asin === 'B001' && 
        r.date === '2023-12-31'
      );
      
      const week1B002 = result.find(r => 
        r.query === 'running shoes' && 
        r.asin === 'B002' && 
        r.date === '2023-12-31'
      );
      
      expect(week1B001?.impressionShare).toBeCloseTo(0.733); // 2200 / 3000
      expect(week1B002?.impressionShare).toBeCloseTo(0.267); // 800 / 3000
    });

    it('should handle empty records', async () => {
      const result = await aggregator.aggregateByPeriod([], 'weekly');
      expect(result).toEqual([]);
    });
  });

  describe('calculatePeriodComparison', () => {
    it('should calculate period-over-period comparisons', async () => {
      const currentPeriodData = [
        {
          date: '2024-01-07',
          query: 'running shoes',
          asin: 'B001',
          totalImpressions: 2400,
          totalClicks: 240,
          totalPurchases: 24,
          avgCTR: 0.1,
          avgCVR: 0.1,
        },
      ];

      const previousPeriodData = {
        date: '2023-12-31',
        query: 'running shoes',
        asin: 'B001',
        totalImpressions: 2200,
        totalClicks: 220,
        totalPurchases: 22,
        avgCTR: 0.1,
        avgCVR: 0.1,
      };

      mockPool.withClient = vi.fn().mockResolvedValue(previousPeriodData);

      const result = await aggregator.calculatePeriodComparison(
        currentPeriodData as any,
        'weekly'
      );

      expect(result).toHaveLength(1);
      expect(result[0].changes.impressions).toBe(200);
      expect(result[0].changes.impressionsPercent).toBeCloseTo(9.09);
      expect(result[0].changes.purchases).toBe(2);
      expect(result[0].changes.purchasesPercent).toBeCloseTo(9.09);
    });
  });

  describe('persistToBigQuery', () => {
    it('should persist weekly aggregations', async () => {
      const mockQuery = vi.fn().mockResolvedValue([]);
      mockPool.withClient = vi.fn().mockImplementation(async (fn) => 
        fn({ query: mockQuery })
      );

      await aggregator.persistToBigQuery('weekly', '2024-01-01', '2024-01-07');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        expect.objectContaining({
          startDate: '2024-01-01',
          endDate: '2024-01-07',
        })
      );
    });

    it('should persist monthly aggregations', async () => {
      const mockQuery = vi.fn().mockResolvedValue([]);
      mockPool.withClient = vi.fn().mockImplementation(async (fn) => 
        fn({ query: mockQuery })
      );

      await aggregator.persistToBigQuery('monthly', '2024-01-01', '2024-01-31');

      expect(mockQuery).toHaveBeenCalled();
      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall[0]).toContain('sqp_monthly_summary');
      expect(queryCall[1]).toEqual({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });
    });
  });

  describe('createPeriodComparisonTable', () => {
    it('should create period comparison table', async () => {
      const mockQuery = vi.fn().mockResolvedValue([]);
      mockPool.withClient = vi.fn().mockImplementation(async (fn) => 
        fn({ query: mockQuery })
      );

      await aggregator.createPeriodComparisonTable('weekly');

      expect(mockQuery).toHaveBeenCalled();
      const queryCall = mockQuery.mock.calls[0];
      expect(queryCall[0]).toContain('CREATE OR REPLACE TABLE');
      expect(queryCall[0]).toContain('sqp_weekly_comparison');
    });
  });

  describe('period key generation', () => {
    it('should generate correct period keys', async () => {
      const testCases: Array<{date: string, period: PeriodType, expectedKey: string}> = [
        { date: '2024-01-15', period: 'weekly', expectedKey: '2024-01-14' }, // Sunday
        { date: '2024-01-15', period: 'monthly', expectedKey: '2024-01' },
        { date: '2024-01-15', period: 'quarterly', expectedKey: '2024-Q1' },
        { date: '2024-01-15', period: 'yearly', expectedKey: '2024' },
        { date: '2024-04-15', period: 'quarterly', expectedKey: '2024-Q2' },
        { date: '2024-10-15', period: 'quarterly', expectedKey: '2024-Q4' },
      ];

      for (const testCase of testCases) {
        const records = [{
          query: 'test',
          asin: 'TEST001',
          impressions: 100,
          clicks: 10,
          purchases: 1,
          query_date: testCase.date,
        }];

        const result = await aggregator.aggregateByPeriod(records, testCase.period);
        expect(result[0].date).toBe(testCase.expectedKey);
      }
    });
  });
});