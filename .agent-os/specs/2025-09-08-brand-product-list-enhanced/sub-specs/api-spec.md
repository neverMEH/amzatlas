# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-08-brand-product-list-enhanced/spec.md

> Created: 2025-09-08
> Version: 1.0.0

## Enhanced Brand Products API

### GET /api/brands/[brandId]/products

Enhanced version of the existing brand products endpoint to support the new expandable date segments functionality.

**Path Parameters:**
- `brandId` (string, required): UUID of the brand

**Query Parameters:**
- `startDate` (string, required): Start date in YYYY-MM-DD format
- `endDate` (string, required): End date in YYYY-MM-DD format
- `compareStartDate` (string, optional): Comparison period start date
- `compareEndDate` (string, optional): Comparison period end date
- `includePerformance` (boolean, optional): Include performance metrics (default: true)
- `includeSegments` (boolean, optional): Include date segment summaries (default: false)
- `sortBy` (string, optional): Sort field - asin, title, impressions, clicks, purchases, revenue (default: revenue)
- `order` (string, optional): Sort order - asc, desc (default: desc)
- `limit` (number, optional): Maximum number of products to return (default: 50)
- `offset` (number, optional): Pagination offset (default: 0)

**Request Example:**
```
GET /api/brands/123e4567-e89b-12d3-a456-426614174000/products?startDate=2025-08-01&endDate=2025-08-31&compareStartDate=2025-07-01&compareEndDate=2025-07-31&includeSegments=true&sortBy=revenue&order=desc&limit=25
```

**Response Format:**
```typescript
interface BrandProductsResponse {
  brandId: string
  brandName: string
  dateRange: {
    start: string
    end: string
  }
  comparisonDateRange?: {
    start: string
    end: string
  }
  products: ProductWithMetrics[]
  totalCount: number
  pagination: {
    limit: number
    offset: number
    hasMore: boolean
  }
  aggregatedMetrics: BrandAggregatedMetrics
}

interface ProductWithMetrics {
  asin: string
  productTitle: string
  brand: string
  // Core metrics
  impressions: number
  clicks: number
  cartAdds: number
  purchases: number
  revenue: number
  // Calculated rates
  clickThroughRate: number
  cartAddRate: number
  purchaseRate: number
  overallConversionRate: number
  // Share metrics
  impressionShare: number
  clickShare: number
  cartAddShare: number
  purchaseShare: number
  // Comparison data (if comparison period provided)
  comparison?: {
    impressions: { value: number; change: number; changePercent: number }
    clicks: { value: number; change: number; changePercent: number }
    cartAdds: { value: number; change: number; changePercent: number }
    purchases: { value: number; change: number; changePercent: number }
    revenue: { value: number; change: number; changePercent: number }
    rates: {
      clickThroughRate: { value: number; change: number }
      cartAddRate: { value: number; change: number }
      purchaseRate: { value: number; change: number }
      overallConversionRate: { value: number; change: number }
    }
  }
  // Date segment summaries (if includeSegments=true)
  segments?: ProductSegmentSummary[]
}

interface ProductSegmentSummary {
  segmentType: 'weekly' | 'monthly'
  segmentLabel: string // e.g., "Week 1", "August 2025"
  startDate: string
  endDate: string
  impressions: number
  clicks: number
  cartAdds: number
  purchases: number
  revenue: number
  hasDetailedData: boolean // true if can be expanded for full segment data
}

interface BrandAggregatedMetrics {
  totalProducts: number
  totalImpressions: number
  totalClicks: number
  totalCartAdds: number
  totalPurchases: number
  totalRevenue: number
  averageClickThroughRate: number
  averageConversionRate: number
  totalMarketShare: {
    impression: number
    click: number
    purchase: number
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid brand ID format or missing required parameters
- `404 Not Found`: Brand not found
- `500 Internal Server Error`: Database or server error

---

## New Segment Data API

### GET /api/brands/[brandId]/products/[asin]/segments

New endpoint to fetch detailed segment data for expandable date views.

**Path Parameters:**
- `brandId` (string, required): UUID of the brand
- `asin` (string, required): Product ASIN

**Query Parameters:**
- `startDate` (string, required): Start date in YYYY-MM-DD format
- `endDate` (string, required): End date in YYYY-MM-DD format
- `segmentType` (string, required): Type of segments - weekly, monthly, daily
- `compareStartDate` (string, optional): Comparison period start date
- `compareEndDate` (string, optional): Comparison period end date

**Request Example:**
```
GET /api/brands/123e4567-e89b-12d3-a456-426614174000/products/B08XYZ123/segments?startDate=2025-08-01&endDate=2025-08-31&segmentType=weekly&compareStartDate=2025-07-01&compareEndDate=2025-07-31
```

**Response Format:**
```typescript
interface ProductSegmentDataResponse {
  asin: string
  productTitle: string
  brandId: string
  brandName: string
  dateRange: {
    start: string
    end: string
  }
  comparisonDateRange?: {
    start: string
    end: string
  }
  segmentType: 'weekly' | 'monthly' | 'daily'
  segments: DetailedProductSegment[]
}

interface DetailedProductSegment {
  segmentLabel: string // e.g., "Week 1 (Aug 1-7)", "August 2025"
  startDate: string
  endDate: string
  impressions: number
  clicks: number
  cartAdds: number
  purchases: number
  revenue: number
  // Calculated rates
  clickThroughRate: number
  cartAddRate: number
  purchaseRate: number
  overallConversionRate: number
  // Share metrics
  impressionShare: number
  clickShare: number
  cartAddShare: number
  purchaseShare: number
  // Comparison data (if comparison period provided)
  comparison?: {
    impressions: { value: number; change: number; changePercent: number }
    clicks: { value: number; change: number; changePercent: number }
    cartAdds: { value: number; change: number; changePercent: number }
    purchases: { value: number; change: number; changePercent: number }
    revenue: { value: number; change: number; changePercent: number }
    rates: {
      clickThroughRate: { value: number; change: number }
      cartAddRate: { value: number; change: number }
      purchaseRate: { value: number; change: number }
      overallConversionRate: { value: number; change: number }
    }
  }
  // Top performing search queries for this segment
  topQueries: SegmentQuery[]
}

interface SegmentQuery {
  searchQuery: string
  impressions: number
  clicks: number
  purchases: number
  clickThroughRate: number
  conversionRate: number
}
```

**Error Responses:**
- `400 Bad Request`: Invalid parameters or unsupported segment type
- `404 Not Found`: Brand or ASIN not found
- `500 Internal Server Error`: Database or server error

---

## Enhanced Share Metrics Calculation

### Share Metrics Enhancement

The enhanced APIs calculate share metrics using improved aggregation logic:

**Click Share Calculation:**
```sql
-- Enhanced click share with market context
SELECT 
  asin,
  SUM(asin_click_count) as total_clicks,
  SUM(asin_click_count) / NULLIF(SUM(SUM(asin_click_count)) OVER (PARTITION BY search_query), 0) as click_share_by_query,
  AVG(click_share_by_query) as overall_click_share
FROM search_query_performance 
WHERE start_date >= ? AND end_date <= ?
GROUP BY asin, search_query
```

**Cart Add Share Calculation:**
```sql
-- New cart add share metric
SELECT 
  asin,
  SUM(asin_cart_add_count) as total_cart_adds,
  SUM(asin_cart_add_count) / NULLIF(SUM(SUM(asin_cart_add_count)) OVER (PARTITION BY search_query), 0) as cart_add_share_by_query,
  AVG(cart_add_share_by_query) as overall_cart_add_share
FROM search_query_performance 
WHERE start_date >= ? AND end_date <= ?
GROUP BY asin, search_query
```

**Purchase Share Calculation:**
```sql
-- Enhanced purchase share with market context
SELECT 
  asin,
  SUM(asin_purchase_count) as total_purchases,
  SUM(asin_purchase_count) / NULLIF(SUM(SUM(asin_purchase_count)) OVER (PARTITION BY search_query), 0) as purchase_share_by_query,
  AVG(purchase_share_by_query) as overall_purchase_share
FROM search_query_performance 
WHERE start_date >= ? AND end_date <= ?
GROUP BY asin, search_query
```

---

## Navigation State API

### GET /api/brands/navigation/context

Endpoint for preserving user context during ASIN navigation.

**Query Parameters:**
- `fromPage` (string, required): Source page - brand-dashboard, asin-performance
- `brandId` (string, optional): Current brand ID
- `dateRange` (string, optional): JSON-encoded date range object
- `comparisonRange` (string, optional): JSON-encoded comparison range object
- `filters` (string, optional): JSON-encoded active filters

**Request Example:**
```
GET /api/brands/navigation/context?fromPage=brand-dashboard&brandId=123e4567-e89b-12d3-a456-426614174000&dateRange={"start":"2025-08-01","end":"2025-08-31"}&comparisonRange={"start":"2025-07-01","end":"2025-07-31"}
```

**Response Format:**
```typescript
interface NavigationContextResponse {
  contextId: string // UUID for this navigation context
  fromPage: string
  brandId?: string
  brandName?: string
  dateRange?: {
    start: string
    end: string
  }
  comparisonRange?: {
    start: string
    end: string
  }
  filters?: Record<string, any>
  expiresAt: string // ISO timestamp
  returnUrl: string // URL to return to brand dashboard with context
}
```

### POST /api/brands/navigation/context

Store navigation context for ASIN transitions.

**Request Body:**
```typescript
interface StoreNavigationContextRequest {
  fromPage: string
  brandId?: string
  dateRange?: {
    start: string
    end: string
  }
  comparisonRange?: {
    start: string
    end: string
  }
  filters?: Record<string, any>
  targetAsin?: string
}
```

**Response Format:**
```typescript
interface StoreNavigationContextResponse {
  contextId: string
  navigationUrl: string // URL to navigate to with context preserved
}
```

---

## Integration with Existing v2 API Patterns

### Authentication & Authorization
All endpoints follow the existing Supabase Row Level Security (RLS) patterns:
- Use `createClient()` from `@/lib/supabase/server`
- All brand data access respects existing brand permission rules
- No additional authentication required - leverages existing session management

### Error Handling
Consistent with existing v2 API error format:
```typescript
interface APIError {
  error: string
  details?: Record<string, any>
  code?: string
}
```

### Response Headers
All endpoints include standard headers:
```
Content-Type: application/json
Cache-Control: public, max-age=300 // 5 minute cache for most endpoints
ETag: <response-hash> // For conditional requests
```

---

## Caching Strategies with React Query

### Query Keys Structure
```typescript
// Brand products list
const brandProductsQueryKey = ['brands', brandId, 'products', { startDate, endDate, compareStartDate, compareEndDate, includeSegments }]

// Product segment data
const productSegmentQueryKey = ['brands', brandId, 'products', asin, 'segments', { startDate, endDate, segmentType, compareStartDate, compareEndDate }]

// Navigation context
const navigationContextQueryKey = ['navigation', 'context', contextId]
```

### Cache Configuration
```typescript
// Brand products - 5 minute cache with background refresh
useQuery({
  queryKey: brandProductsQueryKey,
  queryFn: fetchBrandProducts,
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 15 * 60 * 1000, // 15 minutes
  refetchOnWindowFocus: false
})

// Segment data - 10 minute cache (more stable)
useQuery({
  queryKey: productSegmentQueryKey,
  queryFn: fetchProductSegments,
  staleTime: 10 * 60 * 1000, // 10 minutes
  gcTime: 30 * 60 * 1000, // 30 minutes
  refetchOnWindowFocus: false
})

// Navigation context - Session cache only
useQuery({
  queryKey: navigationContextQueryKey,
  queryFn: fetchNavigationContext,
  staleTime: Infinity, // Don't refetch automatically
  gcTime: 60 * 60 * 1000, // 1 hour
  refetchOnWindowFocus: false,
  enabled: !!contextId
})
```

### Cache Invalidation Strategy
```typescript
// After updating brand data
queryClient.invalidateQueries({ queryKey: ['brands', brandId] })

// After navigating between pages
queryClient.setQueryData(navigationContextQueryKey, newContext)

// After date range changes
queryClient.invalidateQueries({ 
  queryKey: ['brands', brandId, 'products'],
  predicate: (query) => {
    // Invalidate queries with different date ranges
    const params = query.queryKey[3] as any
    return params.startDate !== newStartDate || params.endDate !== newEndDate
  }
})
```

---

## Performance Considerations

### Database Query Optimization
- All endpoints use indexed columns for filtering (asin, brand_id, start_date, end_date)
- Share metric calculations use window functions for efficiency
- Segment data uses date-partitioned queries to minimize scan costs
- Connection pooling handles concurrent requests efficiently

### Rate Limiting
- Standard rate limits apply: 100 requests per minute per IP
- Authenticated users: 500 requests per minute
- Burst allowance: 20 requests per 10-second window

### Response Size Management
- Product lists paginated with configurable limits (default: 50, max: 100)
- Segment data limited to 52 weeks or 12 months maximum
- Large responses use streaming JSON for better performance
- Optional fields (segments, comparisons) only included when requested

### Monitoring & Alerting
- All endpoints report metrics to existing monitoring dashboard
- Slow query alerts trigger at >2 second response times
- Error rate monitoring with alerts at >5% error rate
- Cache hit rate monitoring for optimization opportunities