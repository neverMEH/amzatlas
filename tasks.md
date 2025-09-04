# Keyword Comparison Enhancement Tasks

These are the tasks to be completed for enhancing the keyword comparison functionality in the SQP Intelligence application.

> Created: 2025-09-04
> Status: Ready for Implementation

## Tasks

### Task 1: Full-Width Keyword Comparison Layout ✅
**Priority:** High  
**Estimated Time:** 4-6 hours  
**Status:** COMPLETED (2025-09-04)

#### 1.1 Update Keyword Analysis Page Layout ✅
- [x] Remove the 3-column grid layout (`grid-cols-3`) from `/src/app/keyword-analysis/page.tsx`
- [x] Create full-width layout for comparison view mode
- [x] Move MultiKeywordSelector to top of the page above KeywordComparisonView
- [x] Update responsive design to handle full-width layout
- [x] Test layout on different screen sizes

**Files modified:**
- `/src/app/keyword-analysis/page.tsx` (lines 415-438) - Changed from `grid grid-cols-3 gap-6` to `space-y-6`

**Test criteria met:**
- ✅ Comparison view uses full page width
- ✅ Selector appears above comparison view
- ✅ Layout is responsive and doesn't break on smaller screens

#### 1.2 Update Layout CSS Classes ✅
- [x] Remove grid constraints from comparison view container
- [x] Add proper spacing between selector and comparison view
- [x] Ensure consistent padding and margins
- [x] Updated funnel grid from 2 cols to responsive (2-4 cols)
- [x] Increased visible funnels from 4 to 8

**Additional improvements:**
- Enhanced responsive grid in KeywordComparisonView (lines 289)
- Updated error state container from max-w-4xl to max-w-6xl

### Task 2: Enhance MultiKeywordSelector with KPIs ✅
**Priority:** High  
**Estimated Time:** 6-8 hours  
**Status:** COMPLETED (2025-09-04)

#### 2.1 Add KPI Data to Keyword Selector ✅
- [x] Create API endpoint to fetch keyword performance metrics
- [x] Extend `useASINKeywords` hook to include performance data
- [x] Add KPI display to each keyword item in selector
- [x] Include metrics: impressions, clicks, purchases, CTR, CVR

**Files created/modified:**
- `/src/app/api/dashboard/v2/keyword-metrics/route.ts` (created new API endpoint)
- `/src/lib/api/keyword-analysis.ts` (added KeywordKPI types, fetchKeywordMetrics function, and useKeywordMetrics hook)
- `/src/components/asin-performance/MultiKeywordSelector.tsx` (completely redesigned)

**KPI metrics implemented:**
```typescript
interface KeywordKPI {
  keyword: string
  impressions: number
  clicks: number
  cartAdds: number
  purchases: number
  ctr: number
  cvr: number
  cartAddRate: number
  purchaseShare: number
}
```

#### 2.2 Update Selector UI Design ✅
- [x] Add KPI cards/badges to each keyword item
- [x] Include sortable options: performance, alphabetical, market share
- [x] Add filter options: minimum impressions, minimum purchases
- [x] Make selector full-width when in comparison mode
- [x] Add loading states for KPI data

**UI enhancements implemented:**
- 5-column KPI grid for each keyword (impressions, clicks, purchases, CTR, CVR)
- Sortable dropdown with 6 sort options
- Collapsible filter panel with min impressions/purchases inputs
- Full-width design with improved spacing
- Loading spinner and skeleton states
- Updated tests with React Query support

### Task 3: Replace Funnel Chart with Filterable Bar Chart
**Priority:** Medium  
**Estimated Time:** 4-5 hours

#### 3.1 Create New Bar Chart Component
- [ ] Create `FilterableBarChart.tsx` component
- [ ] Add metric filter dropdown (impressions, clicks, purchases, ctr, cvr)
- [ ] Implement sortable bars by metric value
- [ ] Add interactive tooltips with detailed metrics

**Files to create:**
- `/src/components/asin-performance/FilterableBarChart.tsx`

**Chart requirements:**
- Support for multiple metrics display
- Color-coded bars by performance level
- Responsive design for various screen sizes
- Export functionality for chart data

#### 3.2 Integrate Bar Chart into Market Share Tab
- [ ] Replace current funnel display in KeywordComparisonView
- [ ] Update "market-share" tab content in `KeywordComparisonView.tsx`
- [ ] Add metric selector controls above chart
- [ ] Maintain existing market share data structure

**Files to modify:**
- `/src/components/asin-performance/KeywordComparisonView.tsx` (lines 324-352)

### Task 4: Fix Waterfall Chart Usability Issues
**Priority:** Medium  
**Estimated Time:** 3-4 hours

#### 4.1 Identify and Fix Current Issues
- [ ] Conduct usability testing of current waterfall chart
- [ ] Document specific issues with user interactions
- [ ] Fix tooltip positioning and responsiveness
- [ ] Improve chart responsiveness on different screen sizes

**Current issues to investigate:**
- Chart rendering problems
- Tooltip display issues
- Sort functionality problems
- Mobile responsiveness

#### 4.2 Enhance Waterfall Chart Features
- [ ] Add better error handling and loading states
- [ ] Improve chart accessibility (keyboard navigation)
- [ ] Add export functionality for waterfall data
- [ ] Optimize performance for large datasets

**Files to modify:**
- `/src/components/asin-performance/WaterfallChart.tsx`

#### 4.3 Add Chart Interactions
- [ ] Click-to-drill-down functionality
- [ ] Better legend and color coding
- [ ] Responsive tooltip positioning
- [ ] Zoom and pan capabilities for large datasets

### Task 5: Create Comprehensive Test Suite
**Priority:** High  
**Estimated Time:** 6-8 hours

#### 5.1 Component Unit Tests
- [ ] Test MultiKeywordSelector with KPI data
- [ ] Test FilterableBarChart with different metrics
- [ ] Test WaterfallChart interactions and sorting
- [ ] Test full-width layout responsiveness

**Files to create:**
- `/src/components/asin-performance/__tests__/MultiKeywordSelector.test.tsx`
- `/src/components/asin-performance/__tests__/FilterableBarChart.test.tsx`
- `/src/components/asin-performance/__tests__/WaterfallChart.test.tsx`
- `/src/app/__tests__/keyword-analysis-layout.test.tsx`

#### 5.2 Integration Tests
- [ ] Test keyword selection to comparison flow
- [ ] Test metric filtering and sorting across components
- [ ] Test API integration with new KPI endpoint
- [ ] Test responsive behavior on different screen sizes

#### 5.3 Performance Tests
- [ ] Test with large datasets (1000+ keywords)
- [ ] Measure chart rendering performance
- [ ] Test memory usage with multiple comparisons
- [ ] Optimize slow interactions

### Task 6: API Enhancements
**Priority:** Medium  
**Estimated Time:** 3-4 hours

#### 6.1 New Keyword Metrics API
- [ ] Create `/api/dashboard/v2/keyword-metrics` endpoint
- [ ] Return aggregated KPI data for keyword selector
- [ ] Include caching for performance optimization
- [ ] Add error handling and validation

**API response structure:**
```typescript
interface KeywordMetricsResponse {
  keywords: KeywordKPI[]
  totalKeywords: number
  dateRange: { start: string; end: string }
}
```

#### 6.2 Enhance Existing APIs
- [ ] Update keyword-comparison API for bar chart data
- [ ] Optimize queries for full-width layout (more data)
- [ ] Add pagination support for large keyword lists
- [ ] Improve error handling and response times

### Task 7: Documentation and Cleanup
**Priority:** Low  
**Estimated Time:** 2-3 hours

#### 7.1 Update Component Documentation
- [ ] Document new KPI display patterns
- [ ] Create usage examples for FilterableBarChart
- [ ] Update KeywordComparisonView documentation
- [ ] Add troubleshooting guide for common issues

#### 7.2 Code Cleanup
- [ ] Remove unused CSS classes from grid layout
- [ ] Clean up console.log statements
- [ ] Optimize import statements
- [ ] Update TypeScript types for new components

**Files to update:**
- `/src/components/asin-performance/README.md`
- Component prop documentation
- Type definition files

## Success Criteria

### Primary Goals
1. **Full-Width Layout**: Keyword comparison uses entire page width effectively
2. **Smart Keyword Selection**: Users can make informed keyword choices using KPI data
3. **Flexible Bar Charts**: Market share data displayed with filterable metrics
4. **Reliable Waterfall Chart**: No usability issues, smooth interactions

### Performance Targets
- Page load time < 2 seconds with 50 keywords
- Chart rendering < 500ms for up to 20 keywords
- Smooth scrolling and interactions on all screen sizes
- API response times < 300ms for KPI data

### User Experience Goals
- Intuitive keyword selection with performance insights
- Clear visual hierarchy in full-width layout
- Responsive design working on all desktop screen sizes
- Consistent interaction patterns across all charts

## Implementation Notes

### Development Approach
1. **Test-Driven Development**: Write tests before implementation
2. **Incremental Changes**: Deploy each task separately for testing
3. **Performance Monitoring**: Track metrics throughout development
4. **User Feedback**: Gather feedback after each major change

### Technical Considerations
- Maintain backward compatibility with existing APIs
- Use existing design system patterns and colors
- Follow established naming conventions
- Ensure proper TypeScript typing throughout

### Risk Mitigation
- Create feature flags for major layout changes
- Maintain rollback capability for each task
- Test with production-like data volumes
- Monitor performance impact of new features