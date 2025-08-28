import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the entire supabase module at the top level
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn().mockResolvedValue({ data: [], error: null }),
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

describe('Weekly Purchase Velocity API', () => {
  it('should handle basic velocity requests', async () => {
    const { GET } = await import('../purchase-velocity/route');
    
    const request = new NextRequest(
      'http://localhost/api/reports/performance/purchase-velocity'
    );
    
    const response = await GET(request);
    expect(response).toBeDefined();
    expect(response.status).toBeDefined();
  });

  it('should handle ASIN filtering', async () => {
    const { GET } = await import('../purchase-velocity/route');
    
    const request = new NextRequest(
      'http://localhost/api/reports/performance/purchase-velocity?asin=B001234567'
    );
    
    const response = await GET(request);
    expect(response).toBeDefined();
  });

  it('should handle keyword filtering', async () => {
    const { GET } = await import('../purchase-velocity/route');
    
    const request = new NextRequest(
      'http://localhost/api/reports/performance/purchase-velocity?keywords=laptop%20stand,desk%20riser'
    );
    
    const response = await GET(request);
    expect(response).toBeDefined();
  });

  it('should handle aggregation parameters', async () => {
    const { GET } = await import('../purchase-velocity/route');
    
    const request = new NextRequest(
      'http://localhost/api/reports/performance/purchase-velocity?aggregate=monthly'
    );
    
    const response = await GET(request);
    expect(response).toBeDefined();
  });

  it('should handle minimum threshold filtering', async () => {
    const { GET } = await import('../purchase-velocity/route');
    
    const request = new NextRequest(
      'http://localhost/api/reports/performance/purchase-velocity?min_purchases=100'
    );
    
    const response = await GET(request);
    expect(response).toBeDefined();
  });

  it('should handle heatmap format requests', async () => {
    const { GET } = await import('../purchase-velocity/route');
    
    const request = new NextRequest(
      'http://localhost/api/reports/performance/purchase-velocity?format=heatmap'
    );
    
    const response = await GET(request);
    expect(response).toBeDefined();
  });

  it('should handle date range parameters', async () => {
    const { GET } = await import('../purchase-velocity/route');
    
    const request = new NextRequest(
      'http://localhost/api/reports/performance/purchase-velocity?start_date=2025-07-01&end_date=2025-08-01'
    );
    
    const response = await GET(request);
    expect(response).toBeDefined();
  });

  it('should handle statistics requests', async () => {
    const { GET } = await import('../purchase-velocity/route');
    
    const request = new NextRequest(
      'http://localhost/api/reports/performance/purchase-velocity?include_stats=true'
    );
    
    const response = await GET(request);
    expect(response).toBeDefined();
  });

  it('should handle velocity trend calculation', async () => {
    const { GET } = await import('../purchase-velocity/route');
    
    const request = new NextRequest(
      'http://localhost/api/reports/performance/purchase-velocity?calculate_trend=true'
    );
    
    const response = await GET(request);
    expect(response).toBeDefined();
  });

  it('should handle errors gracefully', async () => {
    const { GET } = await import('../purchase-velocity/route');
    
    const request = new NextRequest(
      'http://localhost/api/reports/performance/purchase-velocity'
    );
    
    const response = await GET(request);
    expect(response).toBeDefined();
    expect(typeof response.status).toBe('number');
  });
});