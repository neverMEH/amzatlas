import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseService } from '../client';
import { config } from '@/config/supabase.config';

// Mock the Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => {
    const chainableMethods = {
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(() => Promise.resolve({ error: null })),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    };

    // Make select return the chainable object
    chainableMethods.select.mockReturnValue(chainableMethods);

    return {
      from: vi.fn(() => chainableMethods),
      rpc: vi.fn(() => Promise.resolve({ error: null })),
    };
  }),
}));

describe('SupabaseService', () => {
  let service: SupabaseService;

  beforeEach(() => {
    // Set up test environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

    service = new SupabaseService();
  });

  describe('Configuration', () => {
    it('should throw error if SUPABASE_URL is not set', () => {
      delete process.env.SUPABASE_URL;
      expect(() => config.getSupabaseConfig()).toThrow('SUPABASE_URL environment variable is required');
    });

    it('should throw error if SUPABASE_ANON_KEY is not set', () => {
      delete process.env.SUPABASE_ANON_KEY;
      expect(() => config.getSupabaseConfig()).toThrow('SUPABASE_ANON_KEY environment variable is required');
    });
  });

  describe('Weekly Summary Operations', () => {
    it('should upsert weekly summary data', async () => {
      const testData = {
        period_start: '2024-01-01',
        period_end: '2024-01-07',
        query: 'test query',
        asin: 'TEST001',
        total_impressions: 1000,
        total_clicks: 100,
        total_purchases: 10,
        avg_ctr: 0.1,
        avg_cvr: 0.1,
        purchases_per_impression: 0.01,
        impression_share: 0.5,
        click_share: 0.5,
        purchase_share: 0.5,
      };

      const result = await service.upsertWeeklySummary(testData);
      expect(result.error).toBeNull();
    });

    it('should retrieve weekly summaries with filters', async () => {
      const result = await service.getWeeklySummaries({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        query: 'test query',
        limit: 10,
      });

      expect(result).toBeDefined();
    });
  });

  describe('Monthly Summary Operations', () => {
    it('should upsert monthly summary data', async () => {
      const testData = {
        period_start: '2024-01-01',
        period_end: '2024-01-31',
        year: 2024,
        month: 1,
        query: 'test query',
        asin: 'TEST001',
        total_impressions: 10000,
        total_clicks: 1000,
        total_purchases: 100,
        avg_ctr: 0.1,
        avg_cvr: 0.1,
        purchases_per_impression: 0.01,
        impression_share: 0.5,
        click_share: 0.5,
        purchase_share: 0.5,
        active_weeks: 4,
      };

      const result = await service.upsertMonthlySummary(testData);
      expect(result.error).toBeNull();
    });
  });

  describe('Period Comparison Operations', () => {
    it('should upsert period comparison data', async () => {
      const testData = {
        period_type: 'weekly' as const,
        current_period_start: '2024-01-08',
        current_period_end: '2024-01-14',
        previous_period_start: '2024-01-01',
        previous_period_end: '2024-01-07',
        query: 'test query',
        asin: 'TEST001',
        current_impressions: 1100,
        current_clicks: 110,
        current_purchases: 11,
        current_ctr: 0.1,
        current_cvr: 0.1,
        previous_impressions: 1000,
        previous_clicks: 100,
        previous_purchases: 10,
        previous_ctr: 0.1,
        previous_cvr: 0.1,
        impressions_change: 100,
        clicks_change: 10,
        purchases_change: 1,
        ctr_change: 0,
        cvr_change: 0,
        impressions_change_pct: 10,
        clicks_change_pct: 10,
        purchases_change_pct: 10,
      };

      const result = await service.upsertPeriodComparison(testData);
      expect(result.error).toBeNull();
    });
  });

  describe('Connection Testing', () => {
    it('should test connection successfully', async () => {
      const isConnected = await service.testConnection();
      expect(isConnected).toBe(true);
    });
  });
});