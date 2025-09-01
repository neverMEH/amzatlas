import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';
import * as asinDataAvailability from '@/lib/date-utils/asin-data-availability';

vi.mock('@/lib/date-utils/asin-data-availability', () => ({
  getASINDataAvailability: vi.fn(),
  findMostRecentCompleteMonth: vi.fn(),
  getFallbackDateRange: vi.fn()
}));

describe('ASIN Data Availability API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if ASIN is not provided', async () => {
    const request = new NextRequest('http://localhost:3000/api/dashboard/v2/asin-data-availability');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('ASIN parameter is required');
  });

  it('should return data availability for a valid ASIN', async () => {
    const mockDateRanges = [
      { start_date: '2024-08-01', end_date: '2024-08-07', record_count: 500 },
      { start_date: '2024-08-08', end_date: '2024-08-14', record_count: 600 }
    ];
    
    const mockCompleteMonth = {
      year: 2024,
      month: 8,
      startDate: '2024-08-01',
      endDate: '2024-08-31'
    };

    (asinDataAvailability.getASINDataAvailability as any).mockResolvedValue(mockDateRanges);
    (asinDataAvailability.findMostRecentCompleteMonth as any).mockResolvedValue(mockCompleteMonth);
    (asinDataAvailability.getFallbackDateRange as any).mockReturnValue(null);

    const request = new NextRequest('http://localhost:3000/api/dashboard/v2/asin-data-availability?asin=B08XVYZ1Y5');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      asin: 'B08XVYZ1Y5',
      dateRanges: mockDateRanges,
      mostRecentCompleteMonth: mockCompleteMonth,
      fallbackRange: null,
      summary: {
        totalRecords: 1100,
        dateRangeCount: 2,
        earliestDate: '2024-08-01',
        latestDate: '2024-08-14'
      }
    });
  });

  it('should return fallback range when no complete month is available', async () => {
    const mockDateRanges = [
      { start_date: '2024-09-15', end_date: '2024-09-21', record_count: 300 }
    ];
    
    const mockFallbackRange = {
      startDate: '2024-09-15',
      endDate: '2024-09-21'
    };

    (asinDataAvailability.getASINDataAvailability as any).mockResolvedValue(mockDateRanges);
    (asinDataAvailability.findMostRecentCompleteMonth as any).mockResolvedValue(null);
    (asinDataAvailability.getFallbackDateRange as any).mockReturnValue(mockFallbackRange);

    const request = new NextRequest('http://localhost:3000/api/dashboard/v2/asin-data-availability?asin=B08XVYZ1Y5');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.mostRecentCompleteMonth).toBeNull();
    expect(data.fallbackRange).toEqual(mockFallbackRange);
  });

  it('should handle empty data gracefully', async () => {
    (asinDataAvailability.getASINDataAvailability as any).mockResolvedValue([]);
    (asinDataAvailability.findMostRecentCompleteMonth as any).mockResolvedValue(null);
    (asinDataAvailability.getFallbackDateRange as any).mockReturnValue(null);

    const request = new NextRequest('http://localhost:3000/api/dashboard/v2/asin-data-availability?asin=NEW_ASIN');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      asin: 'NEW_ASIN',
      dateRanges: [],
      mostRecentCompleteMonth: null,
      fallbackRange: null,
      summary: {
        totalRecords: 0,
        dateRangeCount: 0,
        earliestDate: null,
        latestDate: null
      }
    });
  });

  it('should handle errors gracefully', async () => {
    (asinDataAvailability.getASINDataAvailability as any).mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/dashboard/v2/asin-data-availability?asin=B08XVYZ1Y5');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch ASIN data availability');
  });
});