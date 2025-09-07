import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SQPDataTransformer } from '../transformers/sqp-data-transformer';
import { DailyAggregator } from '../aggregators/daily-aggregator';
import { TrendCalculator } from '../transformers/trend-calculator';
import { PerformanceScorer } from '../transformers/performance-scorer';
import { MarketShareCalculator } from '../transformers/market-share-calculator';
import { MetricsCalculator } from '../transformers/metrics-calculator';
import { SQPRecord } from '../types';

describe('SQPDataTransformer', () => {
  let transformer: SQPDataTransformer;
  const mockClient = {
    query: vi.fn(),
  };
  const mockPool = {
    withClient: vi.fn((callback) => callback(mockClient)),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    transformer = new SQPDataTransformer(mockPool as any);
  });

  describe('Daily Aggregations', () => {
    it('should aggregate daily metrics correctly', async () => {
      const mockData: SQPRecord[] = [
        {
          query: 'yoga mat',
          asin: 'B001234567',
          impressions: 1000,
          clicks: 50,
          purchases: 5,
          query_date: '2024-01-15',
        },
        {
          query: 'yoga mat',
          asin: 'B001234567',
          impressions: 1200,
          clicks: 60,
          purchases: 7,
          query_date: '2024-01-15',
        },
      ];

      const result = await transformer.aggregateDailyMetrics(mockData);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        date: '2024-01-15',
        query: 'yoga mat',
        asin: 'B001234567',
        totalImpressions: 2200,
        totalClicks: 110,
        totalPurchases: 12,
      });
    });

    it('should handle multiple ASINs and keywords', async () => {
      const mockData: SQPRecord[] = [
        {
          query: 'yoga mat',
          asin: 'B001234567',
          impressions: 1000,
          clicks: 50,
          purchases: 5,
          query_date: '2024-01-15',
        },
        {
          query: 'exercise mat',
          asin: 'B001234567',
          impressions: 800,
          clicks: 40,
          purchases: 4,
          query_date: '2024-01-15',
        },
        {
          query: 'yoga mat',
          asin: 'B007654321',
          impressions: 600,
          clicks: 30,
          purchases: 2,
          query_date: '2024-01-15',
        },
      ];

      const result = await transformer.aggregateDailyMetrics(mockData);

      expect(result).toHaveLength(3);
      expect(result.map(r => `${r.query}-${r.asin}`)).toEqual([
        'yoga mat-B001234567',
        'exercise mat-B001234567',
        'yoga mat-B007654321',
      ]);
    });

    it('should calculate share metrics correctly', async () => {
      const mockData: SQPRecord[] = [
        {
          query: 'yoga mat',
          asin: 'B001234567',
          impressions: 1000,
          clicks: 100,
          purchases: 10,
          query_date: '2024-01-15',
        },
        {
          query: 'yoga mat',
          asin: 'B007654321',
          impressions: 2000,
          clicks: 150,
          purchases: 15,
          query_date: '2024-01-15',
        },
      ];

      const result = await transformer.aggregateDailyMetrics(mockData, {
        includeShareMetrics: true,
      });

      expect(result[0].impressionShare).toBeCloseTo(0.333, 3);
      expect(result[0].clickShare).toBeCloseTo(0.4, 3);
      expect(result[0].purchaseShare).toBeCloseTo(0.4, 3);
      expect(result[1].impressionShare).toBeCloseTo(0.667, 3);
    });
  });

  describe('Weekly Trends', () => {
    it('should calculate week-over-week trends', async () => {
      // Mock the query results for weekly trends
      mockClient.query.mockResolvedValue([
        {
          week: '2024-01-01',
          impressions: 1000,
          clicks: 50,
          purchases: 5,
          unique_queries: 10,
          impressions_growth: null,
          clicks_growth: null,
          purchases_growth: null,
          ctr: 0.05,
          cvr: 0.1,
          purchases_per_impression: 0.005,
        },
        {
          week: '2024-01-08',
          impressions: 1200,
          clicks: 60,
          purchases: 7,
          unique_queries: 12,
          impressions_growth: 20,
          clicks_growth: 20,
          purchases_growth: 40,
          ctr: 0.05,
          cvr: 0.117,
          purchases_per_impression: 0.0058,
        },
      ]);
      
      const trends = await transformer.calculateWeeklyTrends({
        asin: 'B001234567',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(trends).toHaveLength(2);
      expect(trends[1]).toMatchObject({
        week: '2024-01-08',
        impressions: 1200,
        impressionsGrowth: 20,
      });
    });

    it('should identify trend direction', async () => {
      mockClient.query.mockResolvedValue([
        {
          week: '2024-01-01',
          impressions: 1000,
          clicks: 50,
          purchases: 5,
          unique_queries: 10,
          impressions_growth: null,
          clicks_growth: null,
          purchases_growth: null,
          ctr: 0.05,
          cvr: 0.1,
          purchases_per_impression: 0.005,
        },
      ]);
      
      const trends = await transformer.calculateWeeklyTrends({
        asin: 'B001234567',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(trends).toBeDefined();
      expect(trends[0].week).toBe('2024-01-01');
    });

    it('should calculate moving averages', async () => {
      const mockTrends = Array.from({ length: 8 }, (_, i) => ({
        week: `2024-01-${String((i + 1) * 7).padStart(2, '0')}`,
        impressions: 1000 + i * 100,
        clicks: 50 + i * 5,
        purchases: 5 + i,
        unique_queries: 10,
        impressions_growth: i > 0 ? 10 : null,
        clicks_growth: i > 0 ? 10 : null,
        purchases_growth: i > 0 ? 20 : null,
        ctr: 0.05,
        cvr: 0.1,
        purchases_per_impression: 0.005,
      }));
      
      mockClient.query.mockResolvedValue(mockTrends);
      
      const trends = await transformer.calculateWeeklyTrends({
        asin: 'B001234567',
        startDate: '2024-01-01',
        endDate: '2024-03-31',
        movingAveragePeriod: 4,
      });

      expect(trends.length).toBeGreaterThan(4);
      expect(trends[4]).toHaveProperty('purchasesMA');
    });
  });

  describe('Keyword Performance Scoring', () => {
    it('should calculate performance scores', async () => {
      const keywords = [
        {
          query: 'high value keyword',
          impressions: 10000,
          clicks: 500,
          purchases: 50,
          revenue: 2500,
        },
        {
          query: 'low value keyword',
          impressions: 10000,
          clicks: 100,
          purchases: 2,
          revenue: 50,
        },
      ];

      const scores = await transformer.scoreKeywordPerformance(keywords);

      expect(scores[0].performanceScore).toBeGreaterThan(scores[1].performanceScore);
      expect(scores[0].tier).toBe('top');
      expect(scores[1].tier).toMatch(/^(low|bottom)$/);
    });

    it('should consider multiple factors in scoring', async () => {
      const keyword = {
        query: 'test keyword',
        impressions: 5000,
        clicks: 250,
        purchases: 25,
        revenue: 1000,
      };

      const score = await transformer.scoreKeywordPerformance([keyword]);

      expect(score[0]).toMatchObject({
        query: 'test keyword',
        performanceScore: expect.any(Number),
        tier: expect.any(String),
      });
    });

    it('should rank keywords by performance', async () => {
      const keywords = generateTestKeywords(10);
      
      const scores = await transformer.scoreKeywordPerformance(keywords, {
        includeRanking: true,
      });

      expect(scores[0].rank).toBe(1);
      expect(scores[scores.length - 1].rank).toBe(10);
      
      // Verify descending order by score
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i].performanceScore).toBeLessThanOrEqual(scores[i-1].performanceScore);
      }
    });
  });

  describe('Market Share Calculations', () => {
    it('should calculate market share by keyword', async () => {
      const competitorData = [
        {
          query: 'yoga mat',
          asin: 'B001234567', // Our ASIN
          purchases: 100,
        },
        {
          query: 'yoga mat',
          asin: 'B007654321', // Competitor 1
          purchases: 150,
        },
        {
          query: 'yoga mat',
          asin: 'B009876543', // Competitor 2
          purchases: 50,
        },
      ];

      const marketShare = await transformer.calculateMarketShare(competitorData);

      expect(marketShare.sharesByKeyword).toMatchObject({
        'yoga mat': {
          'B001234567': expect.closeTo(0.333, 3),
          'B007654321': expect.closeTo(0.5, 3),
          'B009876543': expect.closeTo(0.167, 3),
        },
      });
    });

    it('should track share changes over time', async () => {
      const historicalData = [
        // Week 1
        { query: 'yoga mat', asin: 'B001234567', purchases: 100, week: '2024-W01' },
        { query: 'yoga mat', asin: 'B007654321', purchases: 200, week: '2024-W01' },
        // Week 2
        { query: 'yoga mat', asin: 'B001234567', purchases: 150, week: '2024-W02' },
        { query: 'yoga mat', asin: 'B007654321', purchases: 180, week: '2024-W02' },
      ];

      const sharetrends = await transformer.calculateMarketShareTrends(historicalData);

      expect(sharetrends['yoga mat']).toBeDefined();
      expect(sharetrends['yoga mat']['2024-W01']).toBeDefined();
      expect(sharetrends['yoga mat']['2024-W01']['B001234567']).toBeCloseTo(0.333, 3);
    });

    it('should identify market opportunities', async () => {
      mockClient.query.mockResolvedValue([]);
      
      const opportunities = await transformer.identifyMarketOpportunities({
        minMarketSize: 1000,
        maxCurrentShare: 0.1,
        minGrowthRate: 0.1,
      });

      expect(opportunities).toBeInstanceOf(Array);
    });
  });

  describe('Derived Metrics', () => {
    it('should calculate all derived metrics', async () => {
      const record: SQPRecord = {
        query: 'yoga mat',
        asin: 'B001234567',
        impressions: 1000,
        clicks: 50,
        purchases: 5,
        query_date: '2024-01-15',
      };

      const metrics = transformer.calculateDerivedMetrics(record);

      expect(metrics).toMatchObject({
        ctr: 0.05,
        cvr: 0.1,
        purchasesPerImpression: 0.005,
      });
    });

    it('should handle edge cases gracefully', async () => {
      const edgeCases = [
        { impressions: 0, clicks: 0, purchases: 0 },
        { impressions: 1000, clicks: 0, purchases: 0 },
        { impressions: 1000, clicks: 50, purchases: 0 },
      ];

      edgeCases.forEach(record => {
        const metrics = transformer.calculateDerivedMetrics({
          ...record,
          query: 'test',
          asin: 'B001234567',
          query_date: '2024-01-15',
        });

        expect(metrics.ctr).toBeGreaterThanOrEqual(0);
        expect(metrics.cvr).toBeGreaterThanOrEqual(0);
        expect(metrics).not.toHaveProperty('NaN');
        expect(metrics).not.toHaveProperty('Infinity');
      });
    });

    it('should calculate advanced metrics', async () => {
      const data = {
        query: 'premium yoga mat',
        asin: 'B001234567',
        impressions: 10000,
        clicks: 300,
        purchases: 30,
        revenue: 1500,
        adSpend: 150,
      };

      const metrics = transformer.calculateAdvancedMetrics(data);

      expect(metrics.metrics).toMatchObject({
        roas: 10, // Revenue / Ad Spend
        acos: 10, // Ad Spend / Revenue * 100
        cpc: 0.5,
        cpa: 5, // Cost per acquisition
      });
    });
  });

  describe('Data Quality Monitoring', () => {
    it('should detect data quality issues', async () => {
      mockClient.query.mockResolvedValue([
        { date: '2024-01-01', asins: ['B001'], asin_count: 1 },
        { date: '2024-01-02', asins: null, asin_count: 0 },
        { date: '2024-01-03', asins: ['B001'], asin_count: 1 },
      ]);
      
      const report = await transformer.monitorDataQuality({
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
      });

      expect(report).toMatchObject({
        missingDates: expect.any(Array),
        anomalies: expect.any(Array),
        qualityScore: expect.any(Number),
      });
    });

    it('should identify missing data patterns', async () => {
      const mockData = [
        { date: '2024-01-10', asin: 'B001', impressions: 1000 },
        { date: '2024-01-11', asin: 'B001', impressions: 1100 },
        { date: '2024-01-13', asin: 'B001', impressions: 1200 }, // Missing 01-12
        { date: '2024-01-20', asin: 'B002', impressions: 500 }, // Missing B001 for 01-20
      ];
      
      const result = await transformer.detectMissingDataPatterns(mockData);

      expect(result.missingDates).toContain('2024-01-12');
      expect(result.coverageScore).toBeLessThan(1);
    });

    it('should monitor metric consistency', async () => {
      const inconsistentData = [
        { date: '2024-01-15', asin: 'B001', impressions: 1000, clicks: 1500, purchases: 2000 }, // Invalid
        { date: '2024-01-16', asin: 'B001', impressions: 1000, clicks: 50, purchases: 5 },
      ];

      const consistency = await transformer.checkMetricConsistency(inconsistentData);

      expect(consistency.issues).toHaveLength(4); // 2 exceed checks + 2 suspiciously high rate checks
      
      // Check for the main issues
      const exceedIssues = consistency.issues.filter(issue => issue.severity === 'high');
      expect(exceedIssues).toHaveLength(2);
      expect(exceedIssues[0]).toMatchObject({
        date: '2024-01-15',
        issue: 'Clicks exceed impressions',
        severity: 'high',
      });
      expect(exceedIssues[1]).toMatchObject({
        date: '2024-01-15',
        issue: 'Purchases exceed clicks',
        severity: 'high',
      });
    });
  });

  describe('Batch Processing', () => {
    it('should process large datasets in batches', async () => {
      const largeDataset = generateTestRecords(10000);
      
      const processed = await transformer.batchProcess(largeDataset, {
        batchSize: 1000,
        operation: 'aggregate',
      });

      expect(processed.batchesProcessed).toBe(10);
      expect(processed.totalRecords).toBe(10000);
      expect(processed.errors).toHaveLength(0);
    });

    it('should handle batch failures gracefully', async () => {
      const problematicData = generateTestRecords(5000);
      // Insert bad data in batch 3
      problematicData[2500] = { ...problematicData[2500], impressions: -1000 };

      const processed = await transformer.batchProcess(problematicData, {
        batchSize: 1000,
        operation: 'transform',
        continueOnError: true,
      });

      expect(processed.errors).toHaveLength(0);
      expect(processed.successfulBatches).toBe(5);
    });
  });
});

// Helper functions
function generateWeeklyData() {
  return Array.from({ length: 28 }, (_, i) => ({
    date: new Date(2024, 0, i + 1).toISOString().split('T')[0],
    impressions: 1000 + Math.random() * 500,
    clicks: 50 + Math.random() * 25,
    purchases: 5 + Math.random() * 3,
  }));
}

function generateTestKeywords(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    query: `keyword${i}`,
    impressions: Math.floor(Math.random() * 10000),
    clicks: Math.floor(Math.random() * 500),
    purchases: Math.floor(Math.random() * 50),
    revenue: Math.floor(Math.random() * 2000),
  }));
}

function generateTestRecords(count: number): SQPRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    query: `keyword${i % 100}`,
    asin: `B00${(i % 10).toString().padStart(7, '0')}`,
    impressions: Math.floor(Math.random() * 1000),
    clicks: Math.floor(Math.random() * 50),
    purchases: Math.floor(Math.random() * 5),
    query_date: '2024-01-15',
  }));
}

function generateDataWithGaps() {
  const dates = ['2024-01-10', '2024-01-11', '2024-01-13', '2024-01-14', '2024-01-16'];
  return dates.map(date => ({
    date,
    asin: 'B001234567',
    impressions: 1000,
    clicks: 50,
    purchases: 5,
  }));
}