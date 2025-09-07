import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getASINDataAvailability, getDataAvailabilityCache, findMostRecentCompleteMonth } from '../asin-data-availability';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn()
}));

describe('ASIN Data Availability - Performance', () => {
  const mockSupabaseClient = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getDataAvailabilityCache().clear();
    (createClient as vi.MockedFunction<typeof createClient>).mockReturnValue(mockSupabaseClient as any);
  });

  describe('Query Optimization', () => {
    it('should use minimal columns in query', async () => {
      mockSupabaseClient.order.mockResolvedValue({
        data: [],
        error: null
      });

      await getASINDataAvailability('B08N5WRWNW');

      // Verify only necessary columns are selected
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('start_date, end_date');
    });

    it('should use ascending order for efficient processing', async () => {
      mockSupabaseClient.order.mockResolvedValue({
        data: [],
        error: null
      });

      await getASINDataAvailability('B08N5WRWNW');

      // Verify ascending order is used
      expect(mockSupabaseClient.order).toHaveBeenCalledWith('start_date', { ascending: true });
    });
  });

  describe('Cache Performance', () => {
    it('should serve from cache on repeated requests', async () => {
      const mockData = [
        { start_date: '2025-07-01', end_date: '2025-07-07', record_count: 100 },
        { start_date: '2025-07-08', end_date: '2025-07-14', record_count: 120 }
      ];

      mockSupabaseClient.order.mockResolvedValue({
        data: mockData,
        error: null
      });

      // First call - should hit database
      const result1 = await getASINDataAvailability('B08N5WRWNW');
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await getASINDataAvailability('B08N5WRWNW');
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(1); // Still 1, not 2

      expect(result1).toEqual(result2);
    });

    it('should handle cache size limits', async () => {
      const cache = getDataAvailabilityCache();
      cache.setMaxSize(2);

      // Fill cache with 2 items
      mockSupabaseClient.order.mockResolvedValue({
        data: [{ start_date: '2025-07-01', end_date: '2025-07-07', record_count: 100 }],
        error: null
      });

      await getASINDataAvailability('ASIN1');
      await getASINDataAvailability('ASIN2');

      // Add third item - should evict first
      await getASINDataAvailability('ASIN3');

      // First item should be evicted, requiring new fetch
      mockSupabaseClient.from.mockClear();
      await getASINDataAvailability('ASIN1');
      expect(mockSupabaseClient.from).toHaveBeenCalled();
    });

    it('should respect TTL for cache entries', async () => {
      const cache = getDataAvailabilityCache();
      cache.setTTL(100); // 100ms TTL

      mockSupabaseClient.order.mockResolvedValue({
        data: [{ start_date: '2025-07-01', end_date: '2025-07-07', record_count: 100 }],
        error: null
      });

      // First call
      await getASINDataAvailability('B08N5WRWNW');
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(1);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should fetch again after TTL
      mockSupabaseClient.from.mockClear();
      await getASINDataAvailability('B08N5WRWNW');
      expect(mockSupabaseClient.from).toHaveBeenCalled();

      // Reset TTL to default
      cache.setTTL(5 * 60 * 1000);
    });
  });

  describe('Algorithm Performance', () => {
    it('should efficiently find most recent complete month', async () => {
      // Generate weekly data for past year
      const mockData = [];
      const today = new Date();
      for (let i = 0; i < 52; i++) {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        mockData.push({
          start_date: weekStart.toISOString().split('T')[0],
          end_date: weekEnd.toISOString().split('T')[0]
        });
      }

      mockSupabaseClient.order.mockResolvedValue({
        data: mockData,
        error: null
      });

      const startTime = performance.now();
      const result = await findMostRecentCompleteMonth('B08N5WRWNW');
      const endTime = performance.now();

      // Should complete quickly even with many date ranges
      expect(endTime - startTime).toBeLessThan(50); // 50ms threshold
      // Result may be null if no complete months in test data - that's ok
      // The important thing is the performance
    });

    it('should handle large datasets efficiently', async () => {
      // Simulate 2 years of weekly data
      const mockData = Array.from({ length: 104 }, (_, i) => {
        const weekOffset = 104 - i - 1;
        const date = new Date();
        date.setDate(date.getDate() - (weekOffset * 7));
        const startDate = new Date(date);
        startDate.setDate(startDate.getDate() - startDate.getDay());
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);

        return {
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          record_count: 50 + Math.floor(Math.random() * 100)
        };
      });

      mockSupabaseClient.order.mockResolvedValue({
        data: mockData,
        error: null
      });

      const startTime = performance.now();
      const result = await findMostRecentCompleteMonth('B08N5WRWNW');
      const endTime = performance.now();

      // Should handle large datasets efficiently
      expect(endTime - startTime).toBeLessThan(100); // 100ms threshold
    });
  });

  describe('Memory Usage', () => {
    it('should not accumulate memory with repeated calls', async () => {
      const cache = getDataAvailabilityCache();
      cache.setMaxSize(10);

      mockSupabaseClient.order.mockResolvedValue({
        data: [{ start_date: '2025-07-01', end_date: '2025-07-07', record_count: 100 }],
        error: null
      });

      // Make many calls with different ASINs
      for (let i = 0; i < 20; i++) {
        await getASINDataAvailability(`ASIN${i}`);
      }

      // Cache should not exceed max size
      expect(cache['cache'].size).toBeLessThanOrEqual(10);
    });
  });
});