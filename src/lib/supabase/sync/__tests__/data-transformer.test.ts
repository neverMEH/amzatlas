import { describe, it, expect } from 'vitest';
import { BigQueryToSupabaseTransformer } from '../data-transformer';
import { BigQuerySQPData, SupabaseWeeklySummary } from '../types';

describe('BigQueryToSupabaseTransformer', () => {
  const transformer = new BigQueryToSupabaseTransformer();

  describe('Weekly Summary Transformation', () => {
    it('should transform BigQuery SQP data to Supabase weekly summary format', () => {
      const bigQueryData: BigQuerySQPData = {
        search_query: 'laptop stand',
        asin: 'B001234567',
        product_name: 'Adjustable Laptop Stand',
        date: '2025-08-21',
        impressions: 10000,
        clicks: 500,
        purchases: 50,
        ctr: 0.05,
        cvr: 0.1,
        marketplace: 'US',
        category: 'Electronics',
      };

      const result = transformer.toWeeklySummary(bigQueryData, {
        periodStart: '2025-08-14',
        periodEnd: '2025-08-21',
      });

      expect(result).toMatchObject({
        period_start: '2025-08-14',
        period_end: '2025-08-21',
        query: 'laptop stand',
        asin: 'B001234567',
        total_impressions: 10000,
        total_clicks: 500,
        total_purchases: 50,
        avg_ctr: 0.05,
        avg_cvr: 0.1,
        purchases_per_impression: 0.005,
      });
    });

    it('should handle null values with appropriate defaults', () => {
      const bigQueryData: Partial<BigQuerySQPData> = {
        search_query: 'laptop stand',
        asin: 'B001234567',
        impressions: null,
        clicks: null,
        purchases: null,
        ctr: null,
        cvr: null,
      };

      const result = transformer.toWeeklySummary(bigQueryData as BigQuerySQPData, {
        periodStart: '2025-08-14',
        periodEnd: '2025-08-21',
      });

      expect(result.total_impressions).toBe(0);
      expect(result.total_clicks).toBe(0);
      expect(result.total_purchases).toBe(0);
      expect(result.avg_ctr).toBe(0);
      expect(result.avg_cvr).toBe(0);
    });

    it('should calculate share metrics correctly', () => {
      const weeklyData: BigQuerySQPData[] = [
        {
          search_query: 'laptop stand',
          asin: 'B001234567',
          date: '2025-08-21',
          impressions: 6000,
          clicks: 300,
          purchases: 30,
        },
        {
          search_query: 'laptop stand',
          asin: 'B002234567',
          date: '2025-08-21',
          impressions: 4000,
          clicks: 200,
          purchases: 20,
        },
      ] as BigQuerySQPData[];

      const results = transformer.calculateShareMetrics(weeklyData);

      expect(results[0]).toMatchObject({
        impression_share: 0.6, // 6000/10000
        click_share: 0.6, // 300/500
        purchase_share: 0.6, // 30/50
      });

      expect(results[1]).toMatchObject({
        impression_share: 0.4,
        click_share: 0.4,
        purchase_share: 0.4,
      });
    });
  });

  describe('Date Handling', () => {
    it('should handle BigQuery date format variations', () => {
      const dates = [
        { value: '2025-08-21' },
        '2025-08-21T00:00:00',
        '2025-08-21T00:00:00.000Z',
        new Date('2025-08-21'),
      ];

      dates.forEach(date => {
        const result = transformer.parseDate(date);
        expect(result).toBe('2025-08-21');
      });
    });

    it('should determine correct week boundaries', () => {
      const date = '2025-08-21'; // Wednesday
      const boundaries = transformer.getWeekBoundaries(date);

      expect(boundaries).toEqual({
        periodStart: '2025-08-18', // Monday
        periodEnd: '2025-08-24', // Sunday
      });
    });
  });

  describe('Batch Transformation', () => {
    it('should transform batch of records efficiently', () => {
      const batchData: BigQuerySQPData[] = Array.from({ length: 100 }, (_, i) => ({
        search_query: `query_${i % 10}`,
        asin: `B${String(i).padStart(9, '0')}`,
        impressions: 1000 + i,
        clicks: 50 + i,
        purchases: 5 + Math.floor(i / 10),
        date: '2025-08-21',
      })) as BigQuerySQPData[];

      const results = transformer.transformBatch(batchData, {
        periodStart: '2025-08-14',
        periodEnd: '2025-08-21',
        calculateShares: true,
      });

      expect(results).toHaveLength(100);
      expect(results[0]).toHaveProperty('impression_share');
      expect(results[0]).toHaveProperty('query');
      expect(results[0]).toHaveProperty('asin');
    });
  });

  describe('Data Validation', () => {
    it('should validate transformed data meets Supabase schema requirements', () => {
      const validData: SupabaseWeeklySummary = {
        period_start: '2025-08-14',
        period_end: '2025-08-21',
        query: 'laptop stand',
        asin: 'B001234567',
        total_impressions: 10000,
        total_clicks: 500,
        total_purchases: 50,
        avg_ctr: 0.05,
        avg_cvr: 0.1,
        purchases_per_impression: 0.005,
        impression_share: 0.6,
        click_share: 0.6,
        purchase_share: 0.6,
      };

      const validation = transformer.validateWeeklySummary(validData);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should catch validation errors', () => {
      const invalidData: Partial<SupabaseWeeklySummary> = {
        period_start: '2025-08-14',
        // Missing required fields
        query: '',
        asin: 'INVALID', // Too short
        total_impressions: -100, // Negative
      };

      const validation = transformer.validateWeeklySummary(invalidData as SupabaseWeeklySummary);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Query cannot be empty');
      expect(validation.errors).toContain('ASIN must be 10 characters');
      expect(validation.errors).toContain('Impressions cannot be negative');
    });
  });

  describe('Statistical Calculations', () => {
    it('should calculate statistical metrics for weekly data', () => {
      const weekData: number[] = [1000, 1200, 900, 1100, 1050, 950, 1000];
      
      const stats = transformer.calculateStatistics(weekData);
      
      expect(stats).toMatchObject({
        min: 900,
        max: 1200,
        avg: expect.closeTo(1028.57, 2),
        stddev: expect.any(Number),
      });
    });

    it('should handle edge cases in calculations', () => {
      // Division by zero
      const zeroCTR = transformer.calculateCTR(0, 0);
      expect(zeroCTR).toBe(0);

      // Very small numbers
      const smallCVR = transformer.calculateCVR(1, 1000000);
      expect(smallCVR).toBeCloseTo(0.000001, 6);
    });
  });

  describe('Aggregation', () => {
    it('should aggregate daily data into weekly summary', () => {
      const dailyData: BigQuerySQPData[] = [
        { date: '2025-08-14', impressions: 1000, clicks: 50, purchases: 5 },
        { date: '2025-08-15', impressions: 1200, clicks: 60, purchases: 6 },
        { date: '2025-08-16', impressions: 900, clicks: 45, purchases: 4 },
        { date: '2025-08-17', impressions: 1100, clicks: 55, purchases: 5 },
        { date: '2025-08-18', impressions: 1050, clicks: 52, purchases: 5 },
        { date: '2025-08-19', impressions: 950, clicks: 47, purchases: 4 },
        { date: '2025-08-20', impressions: 1000, clicks: 50, purchases: 5 },
      ].map(d => ({
        ...d,
        search_query: 'laptop stand',
        asin: 'B001234567',
      })) as BigQuerySQPData[];

      const weekly = transformer.aggregateToWeekly(dailyData);

      expect(weekly).toMatchObject({
        total_impressions: 7200,
        total_clicks: 359,
        total_purchases: 34,
        avg_ctr: expect.closeTo(0.0499, 4),
        avg_cvr: expect.closeTo(0.0947, 4),
      });
    });
  });

  describe('Type Conversions', () => {
    it('should handle BigQuery numeric types', () => {
      const bigQueryNumeric = { value: '123.456789' };
      const result = transformer.parseNumeric(bigQueryNumeric, 6);
      expect(result).toBe(123.456789);
    });

    it('should handle string to number conversions safely', () => {
      expect(transformer.safeParseInt('123')).toBe(123);
      expect(transformer.safeParseInt('invalid')).toBe(0);
      expect(transformer.safeParseInt(null)).toBe(0);
      expect(transformer.safeParseInt(undefined)).toBe(0);
    });
  });

  describe('Performance', () => {
    it('should transform large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        search_query: `query_${i % 100}`,
        asin: `B${String(i).padStart(9, '0')}`,
        impressions: Math.floor(Math.random() * 10000),
        clicks: Math.floor(Math.random() * 500),
        purchases: Math.floor(Math.random() * 50),
        date: '2025-08-21',
      })) as BigQuerySQPData[];

      const startTime = performance.now();
      const results = transformer.transformBatch(largeDataset, {
        periodStart: '2025-08-14',
        periodEnd: '2025-08-21',
      });
      const endTime = performance.now();

      expect(results).toHaveLength(10000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second
    });
  });
});