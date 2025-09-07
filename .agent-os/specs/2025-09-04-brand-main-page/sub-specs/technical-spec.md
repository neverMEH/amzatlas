# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-04-brand-main-page/spec.md

> Created: 2025-09-04
> Version: 1.0.0

## Technical Requirements

### Implementation Reference

**Complete UI Implementation**: @.agent-os/specs/2025-09-04-brand-main-page/sample-dash/

The sample dashboard provides fully functional React/TypeScript components that serve as the implementation blueprint for this specification. All components include proper styling, state management, and interaction patterns that should be adapted for the main application.

### Architecture Overview

- **Single Page Dashboard**: Transform root route (`/`) to brand-centric dashboard
- **Component Structure**: Header with brand selector, KPI cards, product table, search query table
- **State Management**: React Context for brand selection and comparison mode
- **Data Flow**: Brand selection → API calls → Component updates
- **Component Reuse**: Adapt sample dashboard components to work with existing AMZ Atlas data layer

### Frontend Components

#### Header Component
**Reference Implementation**: `sample-dash/src/components/Header.tsx`

- **Brand Selector Dropdown**: 
  - Displays current brand with chevron indicator
  - Dropdown shows all available brands from API
  - Persists selection in localStorage
  - Updates all dashboard components on change
  - **Implementation**: Use sample Header.tsx dropdown logic with real brand API data

#### KPI Module Components
**Reference Implementation**: `sample-dash/src/components/KpiModules.tsx`

- **Metric Cards**: 4 cards for Impressions, Clicks, Cart Adds, Purchases
- **Sparkline Visualizations**: Mini charts showing trend over last 20 data points
- **Comparison Indicators**: Green/red percentage badges when comparison enabled
- **Number Formatting**: Locale-aware number formatting (e.g., 24,500)
- **Implementation**: Adapt KpiModules.tsx sparkline generation and ComparisonIndicator.tsx

#### Product List Table
**Reference Implementation**: `sample-dash/src/components/ProductList.tsx` and `ProductListItem.tsx`

- **Columns**: 
  - Checkbox, Product Name, Child ASIN
  - Impressions, Clicks, Cart Adds, Purchases
  - CTR, CVR
  - Share metrics: Impression Share, CVR Share, CTR Share, Cart Add Share, Purchase Share
- **Comparison Mode**: Shows percentage change indicators for each metric
- **Sorting**: Client-side sortable columns
- **Pagination**: 7-10 items per page with navigation controls
- **Row Actions**: Click product name/ASIN to navigate to detailed dashboard
- **Implementation**: Use ProductList.tsx table structure with AMZ Atlas product data schema

#### Search Query Table
**Reference Implementation**: `sample-dash/src/components/SearchQueryList.tsx` and `SearchQueryListItem.tsx`

- **Aggregation**: Shows keywords across all brand ASINs
- **Columns**: Same structure as product table but for search queries
- **Top Keywords**: Default sort by impressions descending
- **Implementation**: Adapt SearchQueryList.tsx for brand-level keyword aggregation

#### Date Range & Comparison
**Reference Implementation**: `sample-dash/src/components/DateRangeSelector.tsx`

- **Date Selection**: Integrate with existing DateRangePickerV2.tsx component
- **Comparison Toggle**: Enable/disable comparison mode functionality
- **State Propagation**: Callback pattern to update all dashboard components
- **Implementation**: Replace sample DateRangeSelector with enhanced DateRangePickerV2 from existing codebase

### API Requirements

#### GET /api/brands
- Returns list of all brands for dropdown
- Response: `[{id, display_name}]`
- **Implementation**: Create new endpoint querying `sqp.brands` table

#### GET /api/brands/[brandId]/dashboard
- Returns complete dashboard data for selected brand
- Includes: KPI totals, product list, search queries
- Query params: `date_from`, `date_to`, `comparison_date_from`, `comparison_date_to`
- **Implementation**: Aggregate data from existing asin-performance APIs filtered by brand

#### Integration with Existing APIs
- **Leverage**: `/api/dashboard/v2/asin-overview` for individual ASIN data
- **Aggregate**: Brand-level metrics from multiple ASIN responses
- **Reuse**: Existing search query aggregation logic from keyword analysis

### Data Structure

```typescript
interface DashboardData {
  kpis: {
    impressions: { value: number; trend: number[]; comparison?: number };
    clicks: { value: number; trend: number[]; comparison?: number };
    cartAdds: { value: number; trend: number[]; comparison?: number };
    purchases: { value: number; trend: number[]; comparison?: number };
  };
  products: ProductMetrics[];
  searchQueries: SearchQueryMetrics[];
}

interface ProductMetrics {
  id: string;
  name: string;
  childAsin: string;
  image?: string;
  impressions: number;
  impressionsComparison?: number;
  clicks: number;
  clicksComparison?: number;
  cartAdds: number;
  cartAddsComparison?: number;
  purchases: number;
  purchasesComparison?: number;
  ctr: string;
  ctrComparison?: number;
  cvr: string;
  cvrComparison?: number;
  impressionShare: string;
  impressionShareComparison?: number;
  cvrShare: string;
  cvrShareComparison?: number;
  ctrShare: string;
  ctrShareComparison?: number;
  cartAddShare: string;
  cartAddShareComparison?: number;
  purchaseShare: string;
  purchaseShareComparison?: number;
}

interface SearchQueryMetrics {
  // Same structure as ProductMetrics but with search_query instead of childAsin
  searchQuery: string;
  impressions: number;
  impressionsComparison?: number;
  clicks: number;
  clicksComparison?: number;
  cartAdds: number;
  cartAddsComparison?: number;
  purchases: number;
  purchasesComparison?: number;
  ctr: string;
  ctrComparison?: number;
  cvr: string;
  cvrComparison?: number;
  // Share metrics calculated at brand level
  impressionShare: string;
  impressionShareComparison?: number;
  cvrShare: string;
  cvrShareComparison?: number;
  ctrShare: string;
  ctrShareComparison?: number;
  cartAddShare: string;
  cartAddShareComparison?: number;
  purchaseShare: string;
  purchaseShareComparison?: number;
}
```

### Component Integration Strategy

#### Existing Component Reuse
- **ASINSelector**: Adapt to BrandSelector functionality
- **MetricsCards**: Extend for brand-level aggregation
- **DateRangePickerV2**: Use as-is for date/comparison selection
- **SearchQueryTable**: Modify for brand-level aggregation

#### New Component Development
- **BrandProductList**: New table component based on sample ProductList.tsx
- **BrandHeader**: New header with brand selector based on sample Header.tsx
- **BrandKPIs**: New KPI cards with sparklines based on sample KpiModules.tsx

#### Sample Dashboard Adaptation Workflow
1. **Copy Sample Components**: Import sample-dash components as starting templates
2. **API Integration**: Replace mock data with real API calls to brand endpoints
3. **Styling Alignment**: Ensure TailwindCSS classes match existing design system
4. **Type Safety**: Add proper TypeScript interfaces for brand data structures
5. **State Management**: Integrate with existing React Query patterns for data fetching
6. **Navigation**: Add click handlers to navigate to existing ASIN performance pages

### Performance Optimization

- **Data Caching**: Cache dashboard data for 2 minutes using React Query
- **Lazy Loading**: Load product images on scroll using existing patterns
- **Virtual Scrolling**: Not needed (pagination handles large lists)
- **Debouncing**: Brand selector change debounced by 100ms
- **Component Memoization**: Use React.memo for expensive table renders

### Styling Requirements

**Reference**: Sample dashboard provides complete styling implementation

- **Design System**: TailwindCSS classes matching sample dashboard
- **Colors**: 
  - Primary blue: `text-blue-600`, `bg-blue-100`
  - Success green: `bg-green-50`, `text-green-600`
  - Error red: `bg-red-50`, `text-red-600`
- **Spacing**: Consistent padding/margins per sample components
- **Shadows**: `shadow-sm` for cards, `shadow-lg` for dropdowns
- **Component Consistency**: Maintain visual continuity with existing ASIN performance dashboard

### Database Requirements

#### Brand Data Access
- **Query**: `SELECT DISTINCT brand_name FROM sqp.asin_performance_data WHERE brand_name IS NOT NULL`
- **Aggregation**: Brand-level metrics aggregated from individual ASIN records
- **Filtering**: All existing date range and comparison logic applies at brand level

#### Data Aggregation Queries
- **KPI Totals**: `SUM()` aggregation across all ASINs for selected brand
- **Product List**: Individual ASIN records filtered by brand with calculated shares
- **Search Queries**: Aggregate keyword performance across brand's ASINs
- **Trend Data**: Historical data for sparkline generation (last 20 data points)

### Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- No IE11 support required

### Development Timeline

#### Phase 1: Component Setup (Estimated: 3-4 hours)
- Import and adapt sample dashboard components
- Create brand API endpoints
- Set up basic routing and navigation

#### Phase 2: Data Integration (Estimated: 4-5 hours)
- Implement brand data aggregation
- Connect components to real APIs
- Add proper error handling and loading states

#### Phase 3: Polish & Testing (Estimated: 2-3 hours)
- Ensure styling consistency
- Add comprehensive test coverage
- Performance optimization and caching

**Total Estimated Development Time**: 9-12 hours

### Testing Strategy

#### Component Testing
- **Unit Tests**: Each sample component should be tested after adaptation
- **Integration Tests**: Brand selector → data loading → component updates
- **Visual Tests**: Screenshot comparison with sample dashboard

#### Data Testing  
- **API Tests**: Brand endpoints return expected data structures
- **Aggregation Tests**: Brand-level calculations are mathematically correct
- **Performance Tests**: Large brand datasets load within acceptable times