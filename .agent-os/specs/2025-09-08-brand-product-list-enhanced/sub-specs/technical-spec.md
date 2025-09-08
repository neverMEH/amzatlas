# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-08-brand-product-list-enhanced/spec.md

> Created: 2025-09-08
> Version: 1.0.0

## Technical Requirements

### 1. Component Architecture

#### Enhanced ProductTable Component Structure
```typescript
interface ExpandableProductTableProps {
  products: Product[]
  showComparison: boolean
  dateRange: { startDate: string; endDate: string }
  compareRange?: { startDate: string; endDate: string; enabled: boolean }
  onProductClick: (asin: string) => void
  expandedRows: Set<string>
  onRowExpand: (asin: string) => void
}

interface ProductWithSegments extends Product {
  expandedData?: {
    weeklySegments: WeeklySegment[]
    monthlySegments: MonthlySegment[]
    loading: boolean
    error?: string
  }
}

interface DateSegment {
  period: string // "2025-08-25 to 2025-08-31" or "Aug 2025"
  startDate: string
  endDate: string
  impressions: number
  clicks: number
  cartAdds: number
  purchases: number
  ctr: number
  cvr: number
  impressionShare: number
  ctrShare: number
  cvrShare: number
  cartAddShare: number
  purchaseShare: number
  comparisonMetrics?: ComparisonSegment
}
```

#### Expandable Row Implementation
- Use React state management for `expandedRows: Set<string>`
- Implement `ExpandableProductRow` component with smooth CSS transitions
- Create `DateSegmentTable` sub-component for weekly/monthly breakdowns
- Add loading states and skeleton UI for expanding rows
- Implement error handling for failed segment data fetches

### 2. Data Layer Enhancements

#### API Endpoint Modifications

**New Endpoint: `/api/brands/[brandId]/products/[asin]/segments`**
```typescript
interface SegmentRequest {
  asin: string
  dateFrom: string
  dateTo: string
  segmentType: 'weekly' | 'monthly'
  comparisonDateFrom?: string
  comparisonDateTo?: string
}

interface SegmentResponse {
  segments: DateSegment[]
  meta: {
    asin: string
    productName?: string
    totalPeriods: number
    segmentType: 'weekly' | 'monthly'
  }
}
```

**Enhanced Brand Dashboard API**
- Extend existing `/api/brands/[brandId]/dashboard/route.ts`
- Add `includeSegmentMetadata: boolean` parameter
- Pre-calculate segment availability for products
- Include segment count indicators in product data

#### Database Query Optimizations

**New Materialized View: `brand_product_segments`**
```sql
CREATE MATERIALIZED VIEW brand_product_segments AS
SELECT 
  abm.brand_id,
  sps.asin,
  date_trunc('week', sps.start_date) as week_start,
  date_trunc('month', sps.start_date) as month_start,
  SUM(sps.total_query_impression_count) as total_impressions,
  SUM(sps.asin_click_count) as total_clicks,
  SUM(sps.asin_cart_add_count) as total_cart_adds,
  SUM(sps.asin_purchase_count) as total_purchases,
  -- Calculate share metrics within each segment
  ROUND(
    SUM(sps.total_query_impression_count) * 100.0 / 
    SUM(SUM(sps.total_query_impression_count)) OVER (
      PARTITION BY date_trunc('week', sps.start_date)
    ), 2
  ) as weekly_impression_share,
  -- Similar calculations for monthly and other share metrics
FROM search_performance_summary sps
JOIN asin_brand_mapping abm ON sps.asin = abm.asin
GROUP BY abm.brand_id, sps.asin, date_trunc('week', sps.start_date), date_trunc('month', sps.start_date);
```

**Optimized Segment Queries**
```sql
-- Weekly segments query with share calculations
SELECT 
  week_start as start_date,
  week_start + interval '6 days' as end_date,
  total_impressions,
  total_clicks,
  total_cart_adds,
  total_purchases,
  ROUND(total_clicks * 100.0 / NULLIF(total_impressions, 0), 2) as ctr,
  ROUND(total_purchases * 100.0 / NULLIF(total_clicks, 0), 2) as cvr,
  weekly_impression_share,
  -- Calculate relative share metrics for comparison periods
FROM brand_product_segments 
WHERE brand_id = $1 AND asin = $2 
  AND week_start BETWEEN $3 AND $4
ORDER BY week_start;
```

### 3. State Management

#### React Query Integration
```typescript
// Enhanced caching strategy for segment data
const useProductSegments = (
  brandId: string, 
  asin: string, 
  dateRange: { startDate: string; endDate: string },
  segmentType: 'weekly' | 'monthly',
  comparisonRange?: { startDate: string; endDate: string },
  enabled: boolean = false
) => {
  return useQuery({
    queryKey: ['product-segments', brandId, asin, dateRange, segmentType, comparisonRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        date_from: dateRange.startDate,
        date_to: dateRange.endDate,
        segment_type: segmentType
      })
      
      if (comparisonRange) {
        params.append('comparison_date_from', comparisonRange.startDate)
        params.append('comparison_date_to', comparisonRange.endDate)
      }
      
      const response = await fetch(`/api/brands/${brandId}/products/${asin}/segments?${params}`)
      if (!response.ok) throw new Error('Failed to fetch segments')
      return response.json()
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (React Query v5)
  })
}

// Prefetch strategy for likely expansions
const usePrefetchSegments = (visibleProducts: Product[], brandId: string, dateRange: any) => {
  const queryClient = useQueryClient()
  
  useEffect(() => {
    // Prefetch segments for top 3 products by impressions
    const topProducts = visibleProducts
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 3)
    
    topProducts.forEach(product => {
      queryClient.prefetchQuery({
        queryKey: ['product-segments', brandId, product.childAsin, dateRange, 'weekly'],
        queryFn: () => fetchProductSegments(brandId, product.childAsin, dateRange, 'weekly'),
        staleTime: 5 * 60 * 1000
      })
    })
  }, [visibleProducts, brandId, dateRange, queryClient])
}
```

#### Local State Management
```typescript
interface ProductTableState {
  expandedRows: Set<string>
  segmentTypes: Map<string, 'weekly' | 'monthly'> // Per ASIN segment preference
  loadingSegments: Set<string>
  segmentErrors: Map<string, string>
}

const useProductTableState = () => {
  const [state, setState] = useState<ProductTableState>({
    expandedRows: new Set(),
    segmentTypes: new Map(),
    loadingSegments: new Set(),
    segmentErrors: new Map()
  })
  
  const toggleExpanded = useCallback((asin: string) => {
    setState(prev => {
      const newExpanded = new Set(prev.expandedRows)
      if (newExpanded.has(asin)) {
        newExpanded.delete(asin)
      } else {
        newExpanded.add(asin)
      }
      return { ...prev, expandedRows: newExpanded }
    })
  }, [])
  
  return { state, toggleExpanded, setState }
}
```

### 4. UI/UX Implementation

#### Expandable Row Design
```typescript
const ExpandableProductRow: React.FC<{
  product: Product
  isExpanded: boolean
  onToggle: () => void
  segmentData?: DateSegment[]
  loading: boolean
}> = ({ product, isExpanded, onToggle, segmentData, loading }) => {
  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <td className="px-3 py-4">
          <ChevronRight 
            className={`w-4 h-4 transition-transform duration-200 ${
              isExpanded ? 'rotate-90' : ''
            }`} 
          />
        </td>
        {/* Existing product row columns */}
      </tr>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.tr
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <td colSpan={13} className="px-3 py-0">
              <div className="border-l-4 border-blue-500 pl-4 py-4 bg-gray-50">
                {loading ? (
                  <SegmentSkeleton />
                ) : (
                  <DateSegmentTable segments={segmentData || []} />
                )}
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  )
}
```

#### Comparison Indicators
```typescript
const ComparisonCell: React.FC<{
  current: number
  comparison?: number
  formatter?: (value: number) => string
}> = ({ current, comparison, formatter = (v) => v.toString() }) => {
  if (!comparison) return <span>{formatter(current)}</span>
  
  const change = ((current - comparison) / comparison) * 100
  const isPositive = change > 0
  
  return (
    <div className="flex items-center gap-2">
      <span>{formatter(current)}</span>
      <div className={`flex items-center text-xs ${
        isPositive ? 'text-green-600' : 'text-red-600'
      }`}>
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        <span>{Math.abs(change).toFixed(1)}%</span>
      </div>
    </div>
  )
}
```

#### Navigation Preservation
```typescript
const useNavigationState = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const navigateToASIN = useCallback((asin: string) => {
    const currentParams = new URLSearchParams(searchParams)
    currentParams.set('asin', asin)
    
    // Preserve current state
    const preservedState = {
      dateFrom: currentParams.get('date_from'),
      dateTo: currentParams.get('date_to'),
      comparisonDateFrom: currentParams.get('comparison_date_from'),
      comparisonDateTo: currentParams.get('comparison_date_to'),
      brandId: currentParams.get('brand_id')
    }
    
    const targetUrl = `/?${currentParams.toString()}`
    router.push(targetUrl)
  }, [router, searchParams])
  
  return { navigateToASIN }
}
```

### 5. Performance Considerations

#### Efficient Loading Strategy
- **Lazy Loading**: Only fetch segment data when rows are expanded
- **Batch Prefetching**: Prefetch segments for top 3 products by performance
- **Memory Management**: Automatically cleanup segment data for collapsed rows after 5 minutes
- **Pagination Optimization**: Maintain expanded state across page changes

#### Large Dataset Handling
```typescript
// Virtualization for large product lists (204k+ records)
const useVirtualizedProductTable = (products: Product[], itemHeight = 60) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 })
  
  const visibleProducts = useMemo(() => 
    products.slice(visibleRange.start, visibleRange.end),
    [products, visibleRange]
  )
  
  // Intersection observer for infinite scrolling
  const loadMore = useCallback(() => {
    setVisibleRange(prev => ({
      start: prev.start,
      end: Math.min(prev.end + 25, products.length)
    }))
  }, [products.length])
  
  return { visibleProducts, loadMore, hasMore: visibleRange.end < products.length }
}
```

#### Database Performance
- **Indexed Queries**: Ensure composite indexes on `(brand_id, asin, start_date)` for segment queries
- **Connection Pooling**: Implement connection pooling for segment API endpoints
- **Query Batching**: Batch multiple segment requests when possible
- **Materialized View Refresh**: Schedule hourly refresh of `brand_product_segments` view

### 6. Navigation Integration

#### URL State Management
```typescript
interface BrandDashboardURLState {
  brandId: string
  dateFrom: string
  dateTo: string
  comparisonDateFrom?: string
  comparisonDateTo?: string
  expandedASINs?: string[] // Track expanded rows in URL
  page?: number
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
}

const useBrandDashboardURL = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const updateURL = useCallback((updates: Partial<BrandDashboardURLState>) => {
    const current = new URLSearchParams(searchParams)
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          current.set(key, value.join(','))
        } else {
          current.set(key, value.toString())
        }
      } else {
        current.delete(key)
      }
    })
    
    router.push(`?${current.toString()}`, { scroll: false })
  }, [router, searchParams])
  
  return { updateURL }
}
```

#### ASIN Dashboard Handoff
```typescript
const handleProductClick = (asin: string) => {
  // Preserve all current context for seamless transition
  const contextParams = {
    date_from: dateRange.startDate,
    date_to: dateRange.endDate,
    comparison_date_from: compareRange.enabled ? compareRange.startDate : undefined,
    comparison_date_to: compareRange.enabled ? compareRange.endDate : undefined,
    from_brand: selectedBrand, // Track source for potential back navigation
    asin
  }
  
  const params = new URLSearchParams()
  Object.entries(contextParams).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  
  router.push(`/?${params.toString()}`)
}
```

### 7. TypeScript Interfaces

#### Enhanced Data Structures
```typescript
interface EnhancedProduct extends Product {
  segmentMetadata?: {
    hasWeeklyData: boolean
    hasMonthlyData: boolean
    weekCount: number
    monthCount: number
    earliestDate: string
    latestDate: string
  }
}

interface ProductTableConfig {
  pagination: {
    enabled: boolean
    pageSize: number
    showSizeSelector: boolean
  }
  expansion: {
    defaultSegmentType: 'weekly' | 'monthly'
    autoCollapse: boolean
    maxExpandedRows: number
  }
  performance: {
    virtualScrolling: boolean
    prefetchCount: number
    cacheTimeout: number
  }
}
```

## Approach

### Implementation Phases

**Phase 1: Core Expandable Functionality**
1. Create `ExpandableProductRow` component with smooth animations
2. Implement local state management for expanded rows
3. Add basic segment data fetching with loading states

**Phase 2: Advanced Segment Display**
4. Create `DateSegmentTable` with comparison indicators
5. Implement weekly/monthly toggle functionality
6. Add comprehensive error handling and retry logic

**Phase 3: Performance Optimization**
7. Implement React Query caching strategy
8. Add prefetching for likely expansions
9. Optimize database queries with materialized views

**Phase 4: Navigation Enhancement**
10. Implement URL state preservation
11. Create seamless ASIN dashboard handoff
12. Add browser history management

### Database Migration Strategy
1. Create `brand_product_segments` materialized view
2. Add composite indexes for optimal query performance
3. Implement incremental refresh strategy
4. Monitor query performance and optimize as needed

## External Dependencies

No new external dependencies required beyond the existing tech stack. All functionality can be implemented using:

- **Existing**: React 18, Next.js 14, TypeScript, TailwindCSS, Supabase, React Query, Recharts
- **Animation**: Leverage `framer-motion` (if not already present) or CSS transitions for smooth expansions
- **Icons**: Continue using `lucide-react` for expand/collapse and trend indicators