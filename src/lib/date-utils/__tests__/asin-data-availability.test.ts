import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getASINDataAvailability,
  findMostRecentCompleteMonth,
  isCompleteMonth,
  getDataAvailabilityCache
} from '../asin-data-availability';
import { createClient } from '@/lib/supabase/server';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn()
}));

describe('ASIN Data Availability', () => {
  const mockSupabase = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
    limit: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up chaining
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.gte.mockReturnValue(mockSupabase);
    mockSupabase.lte.mockReturnValue(mockSupabase);
    mockSupabase.order.mockReturnValue(mockSupabase);
    mockSupabase.limit.mockReturnValue(mockSupabase);
    
    (createClient as any).mockReturnValue(mockSupabase);
    getDataAvailabilityCache().clear();
  });

  describe('getASINDataAvailability', () => {
    it('should fetch date ranges for a given ASIN', async () => {
      const mockData = [
        { start_date: '2024-08-01', end_date: '2024-08-31', record_count: 1500 },
        { start_date: '2024-09-01', end_date: '2024-09-30', record_count: 1200 },
        { start_date: '2024-10-01', end_date: '2024-10-31', record_count: 1800 }
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      const result = await getASINDataAvailability('B08XVYZ1Y5');

      expect(mockSupabase.from).toHaveBeenCalledWith('sqp.search_performance_summary');
      expect(mockSupabase.select).toHaveBeenCalledWith('start_date, end_date, COUNT(*) as record_count');
      expect(mockSupabase.eq).toHaveBeenCalledWith('asin', 'B08XVYZ1Y5');
      expect(result).toEqual(mockData);
    });

    it('should use cache for subsequent requests', async () => {
      const mockData = [
        { start_date: '2024-08-01', end_date: '2024-08-31', record_count: 1500 }
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      // First call
      await getASINDataAvailability('B08XVYZ1Y5');
      
      // Second call should use cache
      const result = await getASINDataAvailability('B08XVYZ1Y5');

      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockData);
    });

    it('should handle errors gracefully', async () => {
      mockSupabase.order.mockResolvedValue({ 
        data: null, 
        error: new Error('Database error') 
      });

      await expect(getASINDataAvailability('B08XVYZ1Y5')).rejects.toThrow('Database error');
    });
  });

  describe('isCompleteMonth', () => {
    it('should identify a complete month with all days having data', () => {
      const dateRanges = [
        { start_date: '2024-08-01', end_date: '2024-08-07', record_count: 500 },
        { start_date: '2024-08-08', end_date: '2024-08-14', record_count: 500 },
        { start_date: '2024-08-15', end_date: '2024-08-21', record_count: 500 },
        { start_date: '2024-08-22', end_date: '2024-08-28', record_count: 500 },
        { start_date: '2024-08-29', end_date: '2024-08-31', record_count: 300 }
      ];

      const result = isCompleteMonth(2024, 8, dateRanges);
      expect(result).toBe(true);
    });

    it('should identify an incomplete month with missing days', () => {
      const dateRanges = [
        { start_date: '2024-08-01', end_date: '2024-08-07', record_count: 500 },
        { start_date: '2024-08-15', end_date: '2024-08-21', record_count: 500 }
      ];

      const result = isCompleteMonth(2024, 8, dateRanges);
      expect(result).toBe(false);
    });

    it('should handle months with no data', () => {
      const result = isCompleteMonth(2024, 8, []);
      expect(result).toBe(false);
    });

    it('should require minimum records threshold', () => {
      const dateRanges = [
        { start_date: '2024-08-01', end_date: '2024-08-31', record_count: 10 }
      ];

      const result = isCompleteMonth(2024, 8, dateRanges, 100);
      expect(result).toBe(false);
    });
  });

  describe('findMostRecentCompleteMonth', () => {
    it('should find the most recent complete month', async () => {
      const mockData = [
        // August 2024 - complete
        { start_date: '2024-08-01', end_date: '2024-08-07', record_count: 500 },
        { start_date: '2024-08-08', end_date: '2024-08-14', record_count: 500 },
        { start_date: '2024-08-15', end_date: '2024-08-21', record_count: 500 },
        { start_date: '2024-08-22', end_date: '2024-08-28', record_count: 500 },
        { start_date: '2024-08-29', end_date: '2024-08-31', record_count: 300 },
        // September 2024 - incomplete (missing last week)
        { start_date: '2024-09-01', end_date: '2024-09-07', record_count: 500 },
        { start_date: '2024-09-08', end_date: '2024-09-14', record_count: 500 },
        { start_date: '2024-09-15', end_date: '2024-09-21', record_count: 500 }
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      const result = await findMostRecentCompleteMonth('B08XVYZ1Y5');

      expect(result).toEqual({
        year: 2024,
        month: 8,
        startDate: '2024-08-01',
        endDate: '2024-08-31'
      });
    });

    it('should return null if no complete months found', async () => {
      const mockData = [
        // Only partial data
        { start_date: '2024-09-15', end_date: '2024-09-21', record_count: 500 }
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      const result = await findMostRecentCompleteMonth('B08XVYZ1Y5');

      expect(result).toBeNull();
    });

    it('should skip the current month if incomplete', async () => {
      const currentDate = new Date();
      const currentMonth = format(currentDate, 'yyyy-MM');
      const lastMonth = format(subMonths(currentDate, 1), 'yyyy-MM');
      
      const mockData = [
        // Last month - complete
        { start_date: `${lastMonth}-01`, end_date: format(endOfMonth(subMonths(currentDate, 1)), 'yyyy-MM-dd'), record_count: 2000 },
        // Current month - partial
        { start_date: `${currentMonth}-01`, end_date: format(currentDate, 'yyyy-MM-dd'), record_count: 500 }
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      const result = await findMostRecentCompleteMonth('B08XVYZ1Y5');

      expect(result?.month).toBe(subMonths(currentDate, 1).getMonth() + 1);
      expect(result?.year).toBe(subMonths(currentDate, 1).getFullYear());
    });

    it('should handle ASINs with sparse data', async () => {
      const mockData = [
        // January 2024 - complete
        { start_date: '2024-01-01', end_date: '2024-01-31', record_count: 1500 },
        // March 2024 - complete (February missing)
        { start_date: '2024-03-01', end_date: '2024-03-31', record_count: 1800 },
        // August 2024 - complete
        { start_date: '2024-08-01', end_date: '2024-08-31', record_count: 2000 }
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      const result = await findMostRecentCompleteMonth('B08XVYZ1Y5');

      expect(result).toEqual({
        year: 2024,
        month: 8,
        startDate: '2024-08-01',
        endDate: '2024-08-31'
      });
    });
  });

  describe('Cache functionality', () => {
    it('should expire cache entries after TTL', async () => {
      const mockData = [
        { start_date: '2024-08-01', end_date: '2024-08-31', record_count: 1500 }
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      // Set cache TTL to 100ms for testing
      const cache = getDataAvailabilityCache();
      cache.setTTL(100);

      // First call
      await getASINDataAvailability('B08XVYZ1Y5');
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Second call should hit the database again
      await getASINDataAvailability('B08XVYZ1Y5');

      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    });

    it('should handle cache size limits', async () => {
      const cache = getDataAvailabilityCache();
      cache.setMaxSize(2);

      const mockData = [
        { start_date: '2024-08-01', end_date: '2024-08-31', record_count: 1500 }
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      // Fill cache
      await getASINDataAvailability('ASIN1');
      await getASINDataAvailability('ASIN2');
      await getASINDataAvailability('ASIN3'); // Should evict ASIN1

      // ASIN1 should no longer be in cache
      cache.clear(); // Reset cache state
      await getASINDataAvailability('ASIN1');

      expect(mockSupabase.from).toHaveBeenCalledTimes(4);
    });
  });
});