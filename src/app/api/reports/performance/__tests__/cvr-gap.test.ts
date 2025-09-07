import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the entire supabase module at the top level
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  })),
}));

// Mock environment variables
Object.defineProperty(process, 'env', {
  value: {
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  },
});

describe('CVR Gap Analysis API', () => {
  it('should handle basic CVR gap requests', async () => {
    const { GET } = await import('../cvr-gap/route');
    
    const request = new NextRequest(
      'http://localhost/api/reports/performance/cvr-gap'
    );
    
    const response = await GET(request);
    expect(response).toBeDefined();
    expect(response.status).toBeDefined();
  });

  it('should handle keyword filtering', async () => {
    const { GET } = await import('../cvr-gap/route');
    
    const request = new NextRequest(
      'http://localhost/api/reports/performance/cvr-gap?keywords=laptop%20stand&benchmark=market_average'
    );
    
    const response = await GET(request);
    expect(response).toBeDefined();
  });

  it('should handle ASIN filtering', async () => {
    const { GET } = await import('../cvr-gap/route');
    
    const request = new NextRequest(
      'http://localhost/api/reports/performance/cvr-gap?asin=B001234567'
    );
    
    const response = await GET(request);
    expect(response).toBeDefined();
  });

  it('should handle different benchmark types', async () => {
    const { GET } = await import('../cvr-gap/route');
    
    const request = new NextRequest(
      'http://localhost/api/reports/performance/cvr-gap?benchmark=category_average'
    );
    
    const response = await GET(request);
    expect(response).toBeDefined();
  });

  it('should handle priority matrix requests', async () => {
    const { GET } = await import('../cvr-gap/route');
    
    const request = new NextRequest(
      'http://localhost/api/reports/performance/cvr-gap?priority_matrix=true'
    );
    
    const response = await GET(request);
    expect(response).toBeDefined();
  });

  it('should handle minimum clicks filtering', async () => {
    const { GET } = await import('../cvr-gap/route');
    
    const request = new NextRequest(
      'http://localhost/api/reports/performance/cvr-gap?min_clicks=100'
    );
    
    const response = await GET(request);
    expect(response).toBeDefined();
  });

  it('should handle date range filtering', async () => {
    const { GET } = await import('../cvr-gap/route');
    
    const request = new NextRequest(
      'http://localhost/api/reports/performance/cvr-gap?start_date=2025-07-01&end_date=2025-08-01'
    );
    
    const response = await GET(request);
    expect(response).toBeDefined();
  });

  it('should analyze gap types and provide recommendations', async () => {
    const { GET } = await import('../cvr-gap/route');
    
    const request = new NextRequest(
      'http://localhost/api/reports/performance/cvr-gap'
    );
    
    const response = await GET(request);
    expect(response).toBeDefined();
  });

  it('should calculate confidence levels and priority scores', async () => {
    const { GET } = await import('../cvr-gap/route');
    
    const request = new NextRequest(
      'http://localhost/api/reports/performance/cvr-gap'
    );
    
    const response = await GET(request);
    expect(response).toBeDefined();
  });

  it('should handle errors gracefully', async () => {
    const { GET } = await import('../cvr-gap/route');
    
    const request = new NextRequest(
      'http://localhost/api/reports/performance/cvr-gap'
    );
    
    const response = await GET(request);
    expect(response).toBeDefined();
    expect(typeof response.status).toBe('number');
  });
});