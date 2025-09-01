import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getASINDataAvailability,
  getASINMonthlyDataAvailability,
  DailyDataAvailability,
  DataGranularity,
  getDataAvailabilityCache
} from '../asin-data-availability';
import { createClient } from '@/lib/supabase/server';
import { format, startOfMonth, endOfMonth } from 'date-fns';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn()
}));

describe('ASIN Daily Data Availability', () => {
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

  describe('getASINDataAvailability with daily granularity', () => {
    it('should return daily-level data when granularity is set to daily', async () => {
      const mockData = [
        { start_date: '2024-08-01', end_date: '2024-08-01', search_query: 'query1' },
        { start_date: '2024-08-01', end_date: '2024-08-01', search_query: 'query2' },
        { start_date: '2024-08-02', end_date: '2024-08-02', search_query: 'query1' },
        { start_date: '2024-08-03', end_date: '2024-08-03', search_query: 'query1' },
        { start_date: '2024-08-03', end_date: '2024-08-03', search_query: 'query2' },
        { start_date: '2024-08-03', end_date: '2024-08-03', search_query: 'query3' }
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      const result = await getASINDataAvailability('B08XVYZ1Y5', { 
        granularity: 'daily' as DataGranularity
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('sqp.search_performance_summary');
      expect(mockSupabase.select).toHaveBeenCalledWith('start_date, end_date');
      expect(mockSupabase.eq).toHaveBeenCalledWith('asin', 'B08XVYZ1Y5');
      
      // Should group by date and return daily counts
      expect(result).toEqual([
        { start_date: '2024-08-01', end_date: '2024-08-01', record_count: 2 },
        { start_date: '2024-08-02', end_date: '2024-08-02', record_count: 1 },
        { start_date: '2024-08-03', end_date: '2024-08-03', record_count: 3 }
      ]);
    });

    it('should maintain weekly granularity by default', async () => {
      const mockData = [
        { start_date: '2024-08-01', end_date: '2024-08-07' },
        { start_date: '2024-08-08', end_date: '2024-08-14' }
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      const result = await getASINDataAvailability('B08XVYZ1Y5');

      expect(result).toEqual([
        { start_date: '2024-08-01', end_date: '2024-08-07', record_count: 1 },
        { start_date: '2024-08-08', end_date: '2024-08-14', record_count: 1 }
      ]);
    });

    it('should handle date range filters with daily granularity', async () => {
      const mockData = [
        { start_date: '2024-08-01', end_date: '2024-08-01', search_query: 'query1' },
        { start_date: '2024-08-02', end_date: '2024-08-02', search_query: 'query1' },
        { start_date: '2024-08-03', end_date: '2024-08-03', search_query: 'query1' }
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      const result = await getASINDataAvailability('B08XVYZ1Y5', { 
        granularity: 'daily' as DataGranularity,
        startDate: '2024-08-01',
        endDate: '2024-08-03'
      });

      expect(mockSupabase.gte).toHaveBeenCalledWith('start_date', '2024-08-01');
      expect(mockSupabase.lte).toHaveBeenCalledWith('end_date', '2024-08-03');
      expect(result.length).toBe(3);
    });

    it('should cache daily granularity results separately from weekly', async () => {
      const mockWeeklyData = [
        { start_date: '2024-08-01', end_date: '2024-08-07' }
      ];
      const mockDailyData = [
        { start_date: '2024-08-01', end_date: '2024-08-01' },
        { start_date: '2024-08-02', end_date: '2024-08-02' }
      ];

      mockSupabase.order
        .mockResolvedValueOnce({ data: mockWeeklyData, error: null })
        .mockResolvedValueOnce({ data: mockDailyData, error: null });

      // First call - weekly
      const weeklyResult = await getASINDataAvailability('B08XVYZ1Y5');
      
      // Second call - daily (should not use weekly cache)
      const dailyResult = await getASINDataAvailability('B08XVYZ1Y5', { 
        granularity: 'daily' as DataGranularity 
      });

      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
      expect(weeklyResult.length).toBe(1);
      expect(dailyResult.length).toBe(2);
    });
  });

  describe('getASINMonthlyDataAvailability', () => {
    it('should fetch daily data for a specific month', async () => {
      const asin = 'B08XVYZ1Y5';
      const year = 2024;
      const month = 8;
      const monthStart = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');

      const mockData = [
        { start_date: '2024-08-01', end_date: '2024-08-01' },
        { start_date: '2024-08-01', end_date: '2024-08-01' }, // duplicate date
        { start_date: '2024-08-02', end_date: '2024-08-02' },
        { start_date: '2024-08-05', end_date: '2024-08-05' },
        { start_date: '2024-08-05', end_date: '2024-08-05' },
        { start_date: '2024-08-05', end_date: '2024-08-05' }, // triplicate
        { start_date: '2024-08-10', end_date: '2024-08-10' },
        { start_date: '2024-08-15', end_date: '2024-08-15' },
        { start_date: '2024-08-20', end_date: '2024-08-20' },
        { start_date: '2024-08-25', end_date: '2024-08-25' },
        { start_date: '2024-08-31', end_date: '2024-08-31' }
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      const result: DailyDataAvailability = await getASINMonthlyDataAvailability(asin, year, month);

      expect(mockSupabase.from).toHaveBeenCalledWith('sqp.search_performance_summary');
      expect(mockSupabase.select).toHaveBeenCalledWith('start_date, end_date');
      expect(mockSupabase.eq).toHaveBeenCalledWith('asin', asin);
      expect(mockSupabase.gte).toHaveBeenCalledWith('start_date', monthStart);
      expect(mockSupabase.lte).toHaveBeenCalledWith('end_date', monthEnd);

      expect(result).toEqual({
        asin,
        year,
        month,
        dailyData: {
          '2024-08-01': 2,
          '2024-08-02': 1,
          '2024-08-05': 3,
          '2024-08-10': 1,
          '2024-08-15': 1,
          '2024-08-20': 1,
          '2024-08-25': 1,
          '2024-08-31': 1
        },
        summary: {
          totalDays: 8,
          totalRecords: 11,
          density: 8 / 31, // 8 days with data out of 31 days in August
          hasData: true
        }
      });
    });

    it('should handle months with no data', async () => {
      const asin = 'B08XVYZ1Y5';
      const year = 2024;
      const month = 7;

      mockSupabase.order.mockResolvedValue({ data: [], error: null });

      const result = await getASINMonthlyDataAvailability(asin, year, month);

      expect(result).toEqual({
        asin,
        year,
        month,
        dailyData: {},
        summary: {
          totalDays: 0,
          totalRecords: 0,
          density: 0,
          hasData: false
        }
      });
    });

    it('should handle database errors', async () => {
      mockSupabase.order.mockResolvedValue({ 
        data: null, 
        error: new Error('Database connection failed') 
      });

      await expect(
        getASINMonthlyDataAvailability('B08XVYZ1Y5', 2024, 8)
      ).rejects.toThrow('Database connection failed');
    });

    it('should use cache for repeated requests', async () => {
      const mockData = [
        { start_date: '2024-08-01', end_date: '2024-08-01' },
        { start_date: '2024-08-02', end_date: '2024-08-02' }
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      // First call
      await getASINMonthlyDataAvailability('B08XVYZ1Y5', 2024, 8);
      
      // Second call should use cache
      const result = await getASINMonthlyDataAvailability('B08XVYZ1Y5', 2024, 8);

      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
      expect(result.summary.totalDays).toBe(2);
    });

    it('should calculate density correctly for sparse data', async () => {
      const mockData = [
        { start_date: '2024-02-01', end_date: '2024-02-01' },
        { start_date: '2024-02-15', end_date: '2024-02-15' },
        { start_date: '2024-02-28', end_date: '2024-02-28' }
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      const result = await getASINMonthlyDataAvailability('B08XVYZ1Y5', 2024, 2);

      // February 2024 has 29 days (leap year)
      expect(result.summary.density).toBeCloseTo(3 / 29, 4);
      expect(result.summary.totalDays).toBe(3);
    });

    it('should handle date formatting edge cases', async () => {
      const mockData = [
        { start_date: '2024-08-01T00:00:00.000Z', end_date: '2024-08-01T00:00:00.000Z' },
        { start_date: '2024-08-31T23:59:59.999Z', end_date: '2024-08-31T23:59:59.999Z' }
      ];

      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      const result = await getASINMonthlyDataAvailability('B08XVYZ1Y5', 2024, 8);

      expect(result.dailyData).toHaveProperty('2024-08-01');
      expect(result.dailyData).toHaveProperty('2024-08-31');
      expect(result.summary.totalDays).toBe(2);
    });
  });

  describe('Cache key generation', () => {
    it('should generate unique cache keys for different options', async () => {
      const mockData = [{ start_date: '2024-08-01', end_date: '2024-08-01' }];
      mockSupabase.order.mockResolvedValue({ data: mockData, error: null });

      // Different ASINs
      await getASINDataAvailability('ASIN1', { granularity: 'daily' as DataGranularity });
      await getASINDataAvailability('ASIN2', { granularity: 'daily' as DataGranularity });
      
      // Different granularities
      await getASINDataAvailability('ASIN3');
      await getASINDataAvailability('ASIN3', { granularity: 'daily' as DataGranularity });
      
      // Different date ranges
      await getASINDataAvailability('ASIN4', { 
        granularity: 'daily' as DataGranularity,
        startDate: '2024-08-01',
        endDate: '2024-08-07'
      });
      await getASINDataAvailability('ASIN4', { 
        granularity: 'daily' as DataGranularity,
        startDate: '2024-08-08',
        endDate: '2024-08-14'
      });

      // Each unique combination should trigger a new database call
      expect(mockSupabase.from).toHaveBeenCalledTimes(6);
    });
  });
});