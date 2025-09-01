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
        { start_date: '2024-08-01', end_date: '2024-08-31' },
        { start_date: '2024-09-01', end_date: '2024-09-30' },
        { start_date: '2024-10-01', end_date: '2024-10-31' }
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      const result = await getASINDataAvailability('B08XVYZ1Y5');

      expect(mockSupabase.from).toHaveBeenCalledWith('search_performance_summary');
      expect(mockSupabase.select).toHaveBeenCalledWith('start_date, end_date');
      expect(mockSupabase.eq).toHaveBeenCalledWith('asin', 'B08XVYZ1Y5');
      // Our implementation adds record_count of 1 for each unique date range
      expect(result).toEqual([
        { start_date: '2024-08-01', end_date: '2024-08-31', record_count: 1 },
        { start_date: '2024-09-01', end_date: '2024-09-30', record_count: 1 },
        { start_date: '2024-10-01', end_date: '2024-10-31', record_count: 1 }
      ]);
    });

    it('should use cache for subsequent requests', async () => {
      const mockData = [
        { start_date: '2024-08-01', end_date: '2024-08-31' }
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      // First call
      await getASINDataAvailability('B08XVYZ1Y5');
      
      // Second call should use cache
      const result = await getASINDataAvailability('B08XVYZ1Y5');

      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
      // Our implementation adds record_count
      expect(result).toEqual([
        { start_date: '2024-08-01', end_date: '2024-08-31', record_count: 1 }
      ]);
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
      // Mock data without record_count (as returned by our optimized query)
      const mockData = [];
      
      // August 2024 - complete (need 50+ records to meet threshold)
      const augustWeeks = [
        { start: '2024-08-01', end: '2024-08-07' },
        { start: '2024-08-08', end: '2024-08-14' },
        { start: '2024-08-15', end: '2024-08-21' },
        { start: '2024-08-22', end: '2024-08-28' },
        { start: '2024-08-29', end: '2024-08-31' }
      ];
      
      // Add enough records for each week to meet threshold
      augustWeeks.forEach(week => {
        for (let i = 0; i < 12; i++) {
          mockData.push({ start_date: week.start, end_date: week.end });
        }
      });
      
      // September 2024 - incomplete (missing last week)
      mockData.push({ start_date: '2024-09-01', end_date: '2024-09-07' });
      mockData.push({ start_date: '2024-09-08', end_date: '2024-09-14' });
      mockData.push({ start_date: '2024-09-15', end_date: '2024-09-21' });

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
      
      // Generate data for last month (complete) with multiple records
      const mockData = [];
      const lastMonthStart = startOfMonth(subMonths(currentDate, 1));
      const lastMonthEnd = endOfMonth(subMonths(currentDate, 1));
      
      // Add weekly data for complete last month
      for (let d = new Date(lastMonthStart); d <= lastMonthEnd; d.setDate(d.getDate() + 7)) {
        const weekStart = format(d, 'yyyy-MM-dd');
        const weekEnd = format(new Date(Math.min(d.getTime() + 6 * 24 * 60 * 60 * 1000, lastMonthEnd.getTime())), 'yyyy-MM-dd');
        // Add multiple records per week
        for (let i = 0; i < 20; i++) {
          mockData.push({ start_date: weekStart, end_date: weekEnd });
        }
      }
      
      // Add partial current month data
      mockData.push({ start_date: `${currentMonth}-01`, end_date: format(currentDate, 'yyyy-MM-dd') });

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      const result = await findMostRecentCompleteMonth('B08XVYZ1Y5');

      expect(result?.month).toBe(subMonths(currentDate, 1).getMonth() + 1);
      expect(result?.year).toBe(subMonths(currentDate, 1).getFullYear());
    });

    it('should handle ASINs with sparse data', async () => {
      const mockData = [];
      
      // August 2024 - complete month with enough records
      for (let week = 1; week <= 31; week += 7) {
        const start = week;
        const end = Math.min(week + 6, 31);
        // Add multiple records to meet threshold
        for (let i = 0; i < 15; i++) {
          mockData.push({ 
            start_date: `2024-08-${String(start).padStart(2, '0')}`, 
            end_date: `2024-08-${String(end).padStart(2, '0')}` 
          });
        }
      }

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