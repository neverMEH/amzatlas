import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';
import { getASINMonthlyDataAvailability } from '@/lib/date-utils/asin-data-availability';

vi.mock('@/lib/date-utils/asin-data-availability', () => ({
  getASINMonthlyDataAvailability: vi.fn()
}));

describe('GET /api/dashboard/v2/asin-monthly-availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 when ASIN is missing', async () => {
    const request = new NextRequest('http://localhost/api/dashboard/v2/asin-monthly-availability');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing required parameters: asin, year, month');
  });

  it('should return 400 when year is missing', async () => {
    const request = new NextRequest('http://localhost/api/dashboard/v2/asin-monthly-availability?asin=B08XVYZ1Y5&month=8');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing required parameters: year');
  });

  it('should return 400 when month is missing', async () => {
    const request = new NextRequest('http://localhost/api/dashboard/v2/asin-monthly-availability?asin=B08XVYZ1Y5&year=2024');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing required parameters: month');
  });

  it('should return 400 for invalid year', async () => {
    const request = new NextRequest('http://localhost/api/dashboard/v2/asin-monthly-availability?asin=B08XVYZ1Y5&year=abc&month=8');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid year parameter');
  });

  it('should return 400 for invalid month', async () => {
    const request = new NextRequest('http://localhost/api/dashboard/v2/asin-monthly-availability?asin=B08XVYZ1Y5&year=2024&month=13');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid month parameter. Must be between 1 and 12');
  });

  it('should return monthly data availability for valid parameters', async () => {
    const mockData = {
      asin: 'B08XVYZ1Y5',
      year: 2024,
      month: 8,
      dailyData: {
        '2024-08-01': 5,
        '2024-08-02': 3,
        '2024-08-05': 7,
        '2024-08-10': 2,
        '2024-08-15': 4,
        '2024-08-20': 6,
        '2024-08-25': 3,
        '2024-08-31': 1
      },
      summary: {
        totalDays: 8,
        totalRecords: 31,
        density: 0.2581,
        hasData: true
      }
    };

    (getASINMonthlyDataAvailability as any).mockResolvedValue(mockData);

    const request = new NextRequest('http://localhost/api/dashboard/v2/asin-monthly-availability?asin=B08XVYZ1Y5&year=2024&month=8');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(getASINMonthlyDataAvailability).toHaveBeenCalledWith('B08XVYZ1Y5', 2024, 8);
    expect(data).toEqual(mockData);
  });

  it('should handle leading zeros in month parameter', async () => {
    const mockData = {
      asin: 'B08XVYZ1Y5',
      year: 2024,
      month: 3,
      dailyData: { '2024-03-15': 5 },
      summary: { totalDays: 1, totalRecords: 5, density: 0.0323, hasData: true }
    };

    (getASINMonthlyDataAvailability as any).mockResolvedValue(mockData);

    const request = new NextRequest('http://localhost/api/dashboard/v2/asin-monthly-availability?asin=B08XVYZ1Y5&year=2024&month=03');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(getASINMonthlyDataAvailability).toHaveBeenCalledWith('B08XVYZ1Y5', 2024, 3);
  });

  it('should handle database errors gracefully', async () => {
    (getASINMonthlyDataAvailability as any).mockRejectedValue(new Error('Database connection failed'));

    const request = new NextRequest('http://localhost/api/dashboard/v2/asin-monthly-availability?asin=B08XVYZ1Y5&year=2024&month=8');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch monthly data availability');
  });

  it('should handle empty data response', async () => {
    const mockData = {
      asin: 'B08XVYZ1Y5',
      year: 2024,
      month: 8,
      dailyData: {},
      summary: {
        totalDays: 0,
        totalRecords: 0,
        density: 0,
        hasData: false
      }
    };

    (getASINMonthlyDataAvailability as any).mockResolvedValue(mockData);

    const request = new NextRequest('http://localhost/api/dashboard/v2/asin-monthly-availability?asin=B08XVYZ1Y5&year=2024&month=8');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.summary.hasData).toBe(false);
    expect(Object.keys(data.dailyData).length).toBe(0);
  });

  it('should validate year is reasonable', async () => {
    const request = new NextRequest('http://localhost/api/dashboard/v2/asin-monthly-availability?asin=B08XVYZ1Y5&year=1900&month=8');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid year parameter. Must be between 2000 and current year + 1');
  });

  it('should allow current year + 1 for future planning', async () => {
    const currentYear = new Date().getFullYear();
    const futureYear = currentYear + 1;
    
    const mockData = {
      asin: 'B08XVYZ1Y5',
      year: futureYear,
      month: 1,
      dailyData: {},
      summary: { totalDays: 0, totalRecords: 0, density: 0, hasData: false }
    };

    (getASINMonthlyDataAvailability as any).mockResolvedValue(mockData);

    const request = new NextRequest(`http://localhost/api/dashboard/v2/asin-monthly-availability?asin=B08XVYZ1Y5&year=${futureYear}&month=1`);
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(getASINMonthlyDataAvailability).toHaveBeenCalledWith('B08XVYZ1Y5', futureYear, 1);
  });

  it('should reject years too far in the future', async () => {
    const currentYear = new Date().getFullYear();
    const tooFutureYear = currentYear + 2;

    const request = new NextRequest(`http://localhost/api/dashboard/v2/asin-monthly-availability?asin=B08XVYZ1Y5&year=${tooFutureYear}&month=1`);
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid year parameter. Must be between 2000 and current year + 1');
  });

  it('should include cache headers in response', async () => {
    const mockData = {
      asin: 'B08XVYZ1Y5',
      year: 2024,
      month: 8,
      dailyData: { '2024-08-01': 5 },
      summary: { totalDays: 1, totalRecords: 5, density: 0.0323, hasData: true }
    };

    (getASINMonthlyDataAvailability as any).mockResolvedValue(mockData);

    const request = new NextRequest('http://localhost/api/dashboard/v2/asin-monthly-availability?asin=B08XVYZ1Y5&year=2024&month=8');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=300, stale-while-revalidate=60');
  });
});