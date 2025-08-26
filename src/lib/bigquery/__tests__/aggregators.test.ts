import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DailyAggregator } from '../aggregators/daily-aggregator';
import { WeeklyAggregator } from '../aggregators/weekly-aggregator';
import { MetricsAggregator } from '../aggregators/metrics-aggregator';
import { SQPRecord } from '../types';

describe('Aggregators', () => {
  describe('DailyAggregator', () => {
    let aggregator: DailyAggregator;
    const mockPool = {
      withClient: vi.fn((callback) => callback({ query: vi.fn() })),
    };

    beforeEach(() => {
      aggregator = new DailyAggregator(mockPool as any);
    });

    it('should aggregate by date and key dimensions', async () => {
      const data: SQPRecord[] = [
        {
          query: 'yoga mat',
          asin: 'B001',
          impressions: 100,
          clicks: 10,
          purchases: 1,
          query_date: '2024-01-15',
        },
        {
          query: 'yoga mat',
          asin: 'B001',
          impressions: 150,
          clicks: 15,
          purchases: 2,
          query_date: '2024-01-15',
        },
      ];

      const result = await aggregator.aggregate(data);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        date: '2024-01-15',
        query: 'yoga mat',
        asin: 'B001',
        impressions: 250,
        clicks: 25,
        purchases: 3,
      });
    });

    it('should calculate statistical measures', async () => {
      const data = generateHourlyData();
      
      const result = await aggregator.aggregate(data, {
        includeStats: true,
      });

      // Stats are returned through aggregateWithStats method, not aggregate
      const statsResult = await aggregator.aggregateWithStats(data, {
        dimensions: ['date', 'query', 'asin'],
        metrics: ['impressions', 'clicks', 'purchases'],
        includeStats: true,
      });
      
      expect(statsResult[0].metrics.impressions).toMatchObject({
        min: expect.any(Number),
        max: expect.any(Number),
        avg: expect.any(Number),
        stddev: expect.any(Number),
        median: expect.any(Number),
      });
    });

    it('should handle custom aggregation functions', async () => {
      const customAgg = {
        highestCTR: (records: SQPRecord[]) => {
          return Math.max(...records.map(r => r.clicks / r.impressions));
        },
      };

      const data = generateHourlyData();
      const result = await aggregator.aggregate(data, {
        customAggregations: customAgg,
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('custom.highestCTR');
    });

    it('should persist aggregations to BigQuery', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue([]),
        dataset: vi.fn().mockReturnValue({
          table: vi.fn().mockReturnValue({
            insert: vi.fn().mockResolvedValue([]),
          }),
        }),
      };

      mockPool.withClient.mockImplementation((callback) => callback(mockClient));

      await aggregator.persistToBigQuery('2024-01-15');

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO'),
        expect.any(Object)
      );
    });
  });

  describe('WeeklyAggregator', () => {
    let aggregator: WeeklyAggregator;

    beforeEach(() => {
      aggregator = new WeeklyAggregator({} as any);
    });

    it('should aggregate by ISO week', async () => {
      const data = [
        { date: '2024-01-01', impressions: 100 }, // Week 1
        { date: '2024-01-07', impressions: 150 }, // Week 1
        { date: '2024-01-08', impressions: 200 }, // Week 2
      ];

      const result = await aggregator.aggregateByWeek(data);

      expect(result).toMatchObject({
        '2024-W01': { impressions: 250 },
        '2024-W02': { impressions: 200 },
      });
    });

    it('should calculate week-over-week changes', async () => {
      const weeklyData = {
        '2024-W01': { impressions: 1000, clicks: 50, purchases: 5 },
        '2024-W02': { impressions: 1200, clicks: 55, purchases: 7 },
        '2024-W03': { impressions: 1100, clicks: 60, purchases: 6 },
      };

      const trends = aggregator.calculateWeekOverWeek(weeklyData);

      expect(trends['2024-W02']).toMatchObject({
        impressions: { value: 1200, change: 200, changePercent: 20 },
        clicks: { value: 55, change: 5, changePercent: 10 },
        purchases: { value: 7, change: 2, changePercent: 40 },
      });

      expect(trends['2024-W03'].impressions.changePercent).toBeCloseTo(-8.33, 2);
    });

    it('should identify seasonal patterns', async () => {
      const yearData = generateYearData();
      
      const patterns = await aggregator.detectSeasonalPatterns(yearData);

      expect(patterns).toHaveProperty('weeklySeasonality');
      expect(patterns).toHaveProperty('monthlySeasonality');
      expect(patterns.peakWeeks).toBeInstanceOf(Array);
      expect(patterns.lowWeeks).toBeInstanceOf(Array);
    });
  });

  describe('MetricsAggregator', () => {
    let aggregator: MetricsAggregator;

    beforeEach(() => {
      aggregator = new MetricsAggregator();
    });

    it('should aggregate multiple metrics efficiently', async () => {
      const metrics = {
        impressions: [100, 200, 300],
        clicks: [10, 20, 30],
        purchases: [1, 2, 3],
      };

      const result = aggregator.aggregateMetrics(metrics);

      expect(result).toMatchObject({
        impressions: { sum: 600, avg: 200, min: 100, max: 300 },
        clicks: { sum: 60, avg: 20, min: 10, max: 30 },
        purchases: { sum: 6, avg: 2, min: 1, max: 3 },
      });
    });

    it('should calculate percentiles', async () => {
      const values = Array.from({ length: 100 }, (_, i) => i);
      
      const percentiles = aggregator.calculatePercentiles(values);

      expect(percentiles).toMatchObject({
        p25: 24.75,
        p50: 49.5,
        p75: 74.25,
        p90: expect.closeTo(89.1, 1),
        p95: 94.05,
        p99: 98.01,
      });
    });

    it('should handle weighted aggregations', async () => {
      const data = [
        { value: 100, weight: 0.5 },
        { value: 200, weight: 1.5 },
        { value: 300, weight: 1.0 },
      ];

      const weightedAvg = aggregator.weightedAverage(data);
      
      expect(weightedAvg).toBeCloseTo(216.67, 2);
    });

    it('should compute rolling aggregations', async () => {
      const timeSeries = Array.from({ length: 10 }, (_, i) => ({
        date: `2024-01-${(i + 1).toString().padStart(2, '0')}`,
        value: 100 + i * 10,
      }));

      const rolling = aggregator.rollingAggregate(timeSeries, 3);

      expect(rolling[2]).toMatchObject({
        date: '2024-01-03',
        value: 120,
        rolling3DayAvg: 110,
        rolling3DaySum: 330,
      });
    });
  });
});

// Helper functions
function generateHourlyData(): SQPRecord[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    query: 'test',
    asin: 'B001',
    impressions: 100 + Math.floor(Math.random() * 50),
    clicks: 5 + Math.floor(Math.random() * 5),
    purchases: Math.floor(Math.random() * 3),
    query_date: `2024-01-15T${hour.toString().padStart(2, '0')}:00:00`,
  }));
}

function generateYearData() {
  const data: any = {};
  for (let week = 1; week <= 52; week++) {
    // Simulate seasonal pattern with peaks around weeks 47-50 (Black Friday/Holiday)
    const seasonalMultiplier = 
      week >= 47 && week <= 50 ? 2.5 :
      week >= 20 && week <= 30 ? 1.3 : // Summer peak
      1.0;
    
    data[`2024-W${week.toString().padStart(2, '0')}`] = {
      impressions: Math.floor(1000 * seasonalMultiplier + Math.random() * 200),
      purchases: Math.floor(10 * seasonalMultiplier + Math.random() * 5),
    };
  }
  return data;
}