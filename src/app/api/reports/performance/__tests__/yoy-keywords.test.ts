import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../yoy-keywords/route';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('YoY Keywords Performance API', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
      rpc: vi.fn(),
    };

    vi.mocked(createClient).mockReturnValue(mockSupabase);
  });

  it('should return YoY keyword performance data', async () => {
    const mockData = [
      {
        query: 'laptop stand',
        year: 2025,
        total_impressions: 50000,
        total_clicks: 5000,
        total_purchases: 500,
        avg_ctr: 0.1,
        avg_cvr: 0.1,
        yoy_impressions_change: 15.5,
        yoy_clicks_change: 20.2,
        yoy_purchases_change: 25.0,
        yoy_ctr_change: 4.1,
        yoy_cvr_change: 3.8,
      },
      {
        query: 'laptop stand',
        year: 2024,
        total_impressions: 43225,
        total_clicks: 4160,
        total_purchases: 400,
        avg_ctr: 0.096,
        avg_cvr: 0.096,
      },
    ];

    mockSupabase.rpc.mockResolvedValueOnce({ data: mockData, error: null });

    // Create request
    const request = new NextRequest('http://localhost/api/reports/performance/yoy-keywords?year=2025&keywords=laptop%20stand');
    
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('data');
    expect(data.data).toHaveLength(2);
    expect(data.data[0]).toHaveProperty('yoy_impressions_change');
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_yoy_keyword_performance', 
      expect.objectContaining({
        p_year: 2025,
        p_keywords: ['laptop stand']
      })
    );
  });

  it('should handle multiple keywords', async () => {
    const mockData = [
      { query: 'laptop stand', year: 2025, total_impressions: 50000 },
      { query: 'laptop riser', year: 2025, total_impressions: 30000 },
    ];

    mockSupabase.rpc.mockResolvedValueOnce({ data: mockData, error: null });

    const request = new NextRequest(
      'http://localhost/api/reports/performance/yoy-keywords?year=2025&keywords=laptop%20stand,laptop%20riser'
    );
    
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_yoy_keyword_performance', 
      expect.objectContaining({
        p_keywords: ['laptop stand', 'laptop riser']
      })
    );
  });

  it('should return current and previous year by default', async () => {
    const request = new NextRequest('http://localhost/api/reports/performance/yoy-keywords');
    
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_yoy_keyword_performance', 
      expect.objectContaining({
        p_year: new Date().getFullYear()
      })
    );
  });

  it('should handle limit parameter', async () => {
    const request = new NextRequest(
      'http://localhost/api/reports/performance/yoy-keywords?limit=10'
    );
    
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_yoy_keyword_performance', 
      expect.objectContaining({
        p_limit: 10
      })
    );
  });

  it('should handle errors gracefully', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ 
      data: null, 
      error: { message: 'Database error' } 
    });

    const request = new NextRequest('http://localhost/api/reports/performance/yoy-keywords');
    
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toHaveProperty('success', false);
    expect(data).toHaveProperty('error');
  });

  it('should validate year parameter', async () => {
    const request = new NextRequest(
      'http://localhost/api/reports/performance/yoy-keywords?year=invalid'
    );
    
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('success', false);
    expect(data.error).toContain('Invalid year');
  });

  it('should support sorting options', async () => {
    const request = new NextRequest(
      'http://localhost/api/reports/performance/yoy-keywords?sort=purchases_change&order=desc'
    );
    
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_yoy_keyword_performance', 
      expect.objectContaining({
        p_sort_by: 'purchases_change',
        p_sort_order: 'desc'
      })
    );
  });

  it('should calculate YoY changes correctly', async () => {
    const mockData = [
      {
        query: 'test keyword',
        year: 2025,
        total_impressions: 1000,
        total_purchases: 100,
        previous_year_impressions: 800,
        previous_year_purchases: 80,
      },
    ];

    mockSupabase.rpc.mockResolvedValueOnce({ data: mockData, error: null });

    const request = new NextRequest('http://localhost/api/reports/performance/yoy-keywords');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // YoY change = ((1000 - 800) / 800) * 100 = 25%
    expect(data.data[0].yoy_impressions_change).toBeCloseTo(25, 1);
  });
});